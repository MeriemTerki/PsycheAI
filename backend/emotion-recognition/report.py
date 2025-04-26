import os
from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_community.embeddings import CohereEmbeddings
from groq import AsyncGroq
from rich.console import Console
from typing import List, Dict, Any

# Load environment variables
load_dotenv()

# Settings
SYSTEM_PROMPT = """
You are a psychological data analyst. Your job is to:
1. Use evidence-based insights from psychology and emotion research to interpret emotional patterns.
2. Relate findings to possible cognitive or behavioral implications.
3. Be concise and professional. Use context when available.

Context (if any):
{context}
"""

# Init clients
console = Console()
groq = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME"))

# Init embeddings
embeddings = CohereEmbeddings(
    cohere_api_key=os.getenv("COHERE_API_KEY"),
    model="embed-english-v2.0",
    user_agent="emotion-analysis-app"
)

# Summarize emotion data
def summarize_emotion_data(emotion_data: List[Dict[str, Any]]) -> str:
    if not emotion_data:
        return "No emotion data available."
    
    summaries = [d.get("summary", "No summary") for d in emotion_data]
    unique_summaries = list(set(summaries))
    
    summary = f"""
Emotion Data Summary:
- Total frames analyzed: {len(emotion_data)}
- Unique emotional states detected: {len(unique_summaries)}
- Sample summaries: {unique_summaries[:3] if unique_summaries else 'None'}
"""
    return summary.strip()

# Analyze emotion data
def analyze_emotion_data(emotion_data: List[Dict[str, Any]]) -> str:
    if not emotion_data:
        return "No analysis possible due to missing data."
    
    analysis = []
    summaries = [d.get("summary", "") for d in emotion_data]
    face_counts = [int(s.split()[1]) if s.startswith("Detected") else 0 for s in summaries]
    
    avg_face_count = sum(face_counts) / len(face_counts) if face_counts else 0
    analysis.append(f"- Average faces detected per frame: {avg_face_count:.2f}")
    
    interpretations = [d.get("interpretation", "") for d in emotion_data]
    unique_interpretations = list(set([i for i in interpretations if i]))
    analysis.append(f"- Emotional interpretations: {', '.join(unique_interpretations[:3]) if unique_interpretations else 'None'}")
    
    return "\n".join(analysis)

# Retrieve context with RAG
async def get_rag_context(query: str, top_k: int = 5) -> str:
    try:
        query_embedding = embeddings.embed_query(query)
        results = index.query(vector=query_embedding, top_k=top_k, include_metadata=True)
        context = ""
        for match in results.matches:
            context += f"{match.metadata.get('text', '')}\n"
        return context.strip()
    except Exception as e:
        console.print(f"Error retrieving context: {e}", style="red")
        return ""

# Get interpretation from Groq
async def interpret_with_groq(csv_summary: str, stats_summary: str, rag_context: str, model="llama3-8b-8192") -> str:
    try:
        final_prompt = SYSTEM_PROMPT.format(context=rag_context)
        messages = [
            {"role": "system", "content": final_prompt},
            {"role": "user", "content": f"""Here is the individual's emotion detection data summary and analysis:

Data Summary:
{csv_summary}

Statistical Analysis:
{stats_summary}

Please provide a psychological interpretation based on this data. Focus on emotional stability, emotional variability, and behavioral implications."""}
        ]
        res = await groq.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.7,
            max_tokens=500
        )
        return res.choices[0].message.content
    except Exception as e:
        console.print(f"Error during Groq call: {e}", style="red")
        return "An error occurred while interpreting the data."

# Main function for testing
async def generate_report(emotion_data: List[Dict[str, Any]]) -> str:
    csv_summary = summarize_emotion_data(emotion_data)
    stats_summary = analyze_emotion_data(emotion_data)
    rag_context = await get_rag_context("psychological interpretation of emotion data from facial recognition")
    interpretation = await interpret_with_groq(csv_summary, stats_summary, rag_context)
    return f"{csv_summary}\n\n{stats_summary}\n\n{interpretation}"

if __name__ == "__main__":
    import asyncio
    # Test with sample data
    sample_data = [
        {"session_id": "test", "summary": "Detected 1 face(s)", "stats": "Face detection confidence: 0.8", "interpretation": "Presence of faces suggests user engagement"}
    ]
    result = asyncio.run(generate_report(sample_data))
    console.print(result, style="cyan")