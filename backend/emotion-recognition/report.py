import os
import pandas as pd
from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_community.embeddings import CohereEmbeddings
from groq import AsyncGroq
from rich.console import Console

# Load environment variables
load_dotenv()

# Settings
CSV_PATH = "emotion_predictions.csv"
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

# Step 1: Load CSV
def load_emotion_data():
    return pd.read_csv(CSV_PATH)

# Step 2: Summarize the CSV
def summarize_csv(df):
    summary = f"The dataset contains {len(df)} rows and {len(df.columns)} columns:\n"
    summary += f"Columns: {', '.join(df.columns)}\n\n"
    summary += "Sample data:\n"
    summary += df.head(5).to_string(index=False)
    return summary

# Step 2.5: Analyze emotion data numerically
def analyze_emotion_data(df):
    analysis = []

    if 'emotion' in df.columns:
        top_emotions = df['emotion'].value_counts().nlargest(3).to_dict()
        emotion_freq = ", ".join(f"{k}: {v} times" for k, v in top_emotions.items())
        analysis.append(f"- Most frequent emotions: {emotion_freq}")

    if 'confidence' in df.columns:
        avg_conf = df['confidence'].mean()
        max_conf = df['confidence'].max()
        min_conf = df['confidence'].min()
        analysis.append(f"- Average confidence: {avg_conf:.2f}")
        analysis.append(f"- Confidence range: {min_conf:.2f} to {max_conf:.2f}")

    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df['hour'] = df['timestamp'].dt.hour
        emotion_by_time = df.groupby('hour')['emotion'].apply(lambda x: x.value_counts().idxmax())
        time_based = ", ".join(f"{hour}: {emotion}" for hour, emotion in emotion_by_time.items())
        analysis.append(f"- Emotion pattern by hour: {time_based}")

    return "\n".join(analysis)

# Step 3: Retrieve context with RAG
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

# Step 4: Get interpretation from Groq
async def interpret_with_groq(csv_summary: str, stats_summary: str, rag_context: str, model="llama3-8b-8192") -> str:
    try:
        final_prompt = SYSTEM_PROMPT.format(context=rag_context)
        messages = [
            {"role": "system", "content": final_prompt},
            {"role": "user", "content": f"""Here is the individual's emotion detection data summary and analysis:

CSV Summary:
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

# Main async function
async def main():
    df = load_emotion_data()
    csv_summary = summarize_csv(df)
    stats_summary = analyze_emotion_data(df)
    rag_context = await get_rag_context("psychological interpretation of emotion data from facial recognition")
    interpretation = await interpret_with_groq(csv_summary, stats_summary, rag_context)
    
    console.print("🧠 [bold green]Psychological Interpretation:[/bold green]\n")
    console.print(interpretation, style="cyan")

# Run the async orchestrator
if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
