import os
import pandas as pd
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_community.embeddings import CohereEmbeddings
from groq import AsyncGroq
from rich.console import Console

# Load environment variables
load_dotenv()

# App initialization
app = FastAPI()
console = Console()

# Config
CSV_PATH = "eye_tracking_data_media.csv"
SYSTEM_PROMPT = """
You are a psychological data analyst. Your job is to:
1. Use evidence-based insights from psychology research to interpret eye-tracking data.
2. Relate findings to cognitive or behavioral implications.
3. Be concise and professional. Use context when available.

Context (if any):
{context}
"""

# Initialize clients
groq = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
pinecone_client = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pinecone_client.Index(os.getenv("PINECONE_INDEX_NAME"))

# Initialize embeddings
embeddings = CohereEmbeddings(
    cohere_api_key=os.getenv("COHERE_API_KEY"),
    model="embed-english-v2.0",
    user_agent="eye-tracking-app"
)

# Load data
def load_eye_tracking_data():
    return pd.read_csv(CSV_PATH)

# Summarize dataset
def summarize_csv(df):
    summary = f"The dataset contains {len(df)} rows and {len(df.columns)} columns:\n"
    summary += f"Columns: {', '.join(df.columns)}\n\n"
    summary += "Sample data:\n"
    summary += df.head(5).to_string()
    return summary

# Analyze dataset
def analyze_eye_tracking_data(df):
    analysis = []

    if 'fixation_duration' in df.columns:
        avg_fix = df['fixation_duration'].mean()
        analysis.append(f"- Average fixation duration: {avg_fix:.2f} ms")

    if 'blink_rate' in df.columns:
        avg_blink = df['blink_rate'].mean()
        analysis.append(f"- Average blink rate: {avg_blink:.2f} blinks/sec")

    if 'pupil_dilation' in df.columns:
        avg_pupil = df['pupil_dilation'].mean()
        analysis.append(f"- Average pupil dilation: {avg_pupil:.2f}")

    if 'ear_value' in df.columns:
        avg_ear = df['ear_value'].mean()
        analysis.append(f"- Average EAR (Eye Activity Ratio): {avg_ear:.2f}")

    if 'aoi' in df.columns:
        top_aois = df['aoi'].value_counts().nlargest(3).to_dict()
        aois_str = ", ".join(f"{k}: {v} views" for k, v in top_aois.items())
        analysis.append(f"- Most viewed AOIs: {aois_str}")

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

# Run Groq model for interpretation
async def interpret_with_groq(csv_summary: str, stats_summary: str, rag_context: str, model="llama3-8b-8192") -> str:
    try:
        final_prompt = SYSTEM_PROMPT.format(context=rag_context)
        messages = [
            {"role": "system", "content": final_prompt},
            {"role": "user", "content": f"""Here is the individual's eye-tracking data summary and analysis:

CSV Summary:
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

# API endpoint
@app.get("/interpret-eye-tracking")
async def interpret_eye_tracking():
    try:
        df = load_eye_tracking_data()
        csv_summary = summarize_csv(df)
        stats_summary = analyze_eye_tracking_data(df)
        rag_context = await get_rag_context("psychological interpretation of eye-tracking data")
        interpretation = await interpret_with_groq(csv_summary, stats_summary, rag_context)

        return JSONResponse({
            "summary": csv_summary,
            "analysis": stats_summary,
            "interpretation": interpretation
        })

    except Exception as e:
        console.print(f"API Error: {e}", style="red")
        return JSONResponse(content={"error": str(e)}, status_code=500)
