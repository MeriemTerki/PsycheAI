import os
from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_community.embeddings import CohereEmbeddings
from groq import AsyncGroq
from rich.console import Console
from typing import List, Dict, Any

# Load env variables
load_dotenv()

# Settings
SYSTEM_PROMPT = """
You are a psychological data analyst. Your job is to:
1. Use evidence-based insights from psychology research to interpret eye-tracking data.
2. Relate findings to cognitive or behavioral implications.
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
    user_agent="eye-tracking-app"
)

# Summarize gaze data
def summarize_gaze_data(gaze_data: List[Dict[str, Any]]) -> str:
    if not gaze_data:
        return "No gaze data available."
    
    eye_counts = [d.get("eye_count", 0) for d in gaze_data]
    gaze_points = [p for d in gaze_data for p in d.get("gaze_points", [])]
    
    summary = f"""
Gaze Data Summary:
- Total frames processed: {len(gaze_data)}
- Average eyes detected per frame: {sum(eye_counts) / len(eye_counts):.2f} if eye_counts else 0
- Total gaze points: {len(gaze_points)}
- Sample gaze points: {gaze_points[:3] if gaze_points else 'None'}
"""
    return summary.strip()

# Analyze gaze data
def analyze_gaze_data(gaze_data: List[Dict[str, Any]]) -> str:
    if not gaze_data:
        return "No analysis possible due to missing data."
    
    eye_counts = [d.get("eye_count", 0) for d in gaze_data]
    gaze_points = [p for d in gaze_data for p in d.get("gaze_points", [])]
    
    analysis = []
    avg_eye_count = sum(eye_counts) / len(eye_counts) if eye_counts else 0
    analysis.append(f"- Average eye count: {avg_eye_count:.2f}")
    analysis.append(f"- Total gaze points: {len(gaze_points)}")
    
    if gaze_points:
        x_coords = [p["x"] for p in gaze_points]
        y_coords = [p["y"] for p in gaze_points]
        analysis.append(f"- Gaze point range: X({min(x_coords)}-{max(x_coords)}), Y({min(y_coords)}-{max(y_coords)})")
    
    return "\n".join(analysis)

# Get RAG context
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

# Interpret with Groq
async def interpret_with_groq(csv_summary: str, stats_summary: str, rag_context: str, model="llama3-8b-8192") -> str:
    try:
        final_prompt = SYSTEM_PROMPT.format(context=rag_context)
        messages = [
            {"role": "system", "content": final_prompt},
            {"role": "user", "content": f"""Here is the individual's eye-tracking data summary and analysis:

Data Summary:
{csv_summary}

Statistical Analysis:
{stats_summary}

Please provide a personalized psychological interpretation based on these data.
Focus on attention patterns, emotional arousal, cognitive load, and any behavioral tendencies."""}
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
async def generate_report(gaze_data: List[Dict[str, Any]]) -> str:
    csv_summary = summarize_gaze_data(gaze_data)
    stats_summary = analyze_gaze_data(gaze_data)
    rag_context = await get_rag_context("psychological interpretation of eye-tracking data")
    interpretation = await interpret_with_groq(csv_summary, stats_summary, rag_context)
    return f"{csv_summary}\n\n{stats_summary}\n\n{interpretation}"

if __name__ == "__main__":
    import asyncio
    # Test with sample data
    sample_data = [
        {"session_id": "test", "eye_count": 2, "gaze_points": [{"x": 100, "y": 100}, {"x": 200, "y": 200}]}
    ]
    result = asyncio.run(generate_report(sample_data))
    console.print(result, style="cyan")