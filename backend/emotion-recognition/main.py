import os
import cv2
import pandas as pd
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pinecone import Pinecone
from langchain_community.embeddings import CohereEmbeddings
from groq import AsyncGroq
from rich.console import Console
from ultralytics import YOLO
import numpy as np
import base64
import pinecone

load_dotenv()

app = FastAPI()
console = Console()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_DIR = "logs"
os.makedirs(CSV_DIR, exist_ok=True)

SYSTEM_PROMPT = """
You are a psychological data analyst. Your job is to:
1. Use evidence-based insights from psychology and emotion research to interpret emotional patterns.
2. Relate findings to possible cognitive or behavioral implications.
3. Be concise and professional. Use context when available.

Context (if any):
{context}
"""

groq = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

# Now check if the index exists or create it if necessary
index_name = os.getenv("PINECONE_INDEX_NAME")
embeddings = CohereEmbeddings(
    cohere_api_key=os.getenv("COHERE_API_KEY"),
    model="embed-english-v2.0",
    user_agent="emotion-analysis-api"
)

MODEL = None
def get_yolo_model():
    global MODEL
    if MODEL is None:
        console.print("Loading YOLO model...", style="cyan")
        MODEL = YOLO("models/best_v2.pt")
        console.print("YOLO model loaded", style="green")
    return MODEL

class VideoFrame(BaseModel):
    frame: str
    session_id: str

def run_emotion_inference(frame: np.ndarray, session_id: str) -> pd.DataFrame:
    model = get_yolo_model()
    data = []

    try:
        if frame is None or frame.size == 0:
            raise ValueError("Invalid frame: empty or None")
        console.print(f"[{session_id}] Frame shape: {frame.shape}", style="yellow")

        debug_path = f"debug_frame_{session_id}.jpg"
        cv2.imwrite(debug_path, frame)
        console.print(f"[{session_id}] Saved debug frame to {debug_path}", style="yellow")

        results = model.predict(source=frame, conf=0.3, stream=False, verbose=True)
        console.print(f"[{session_id}] YOLO results: {len(results)} detections", style="yellow")

        for r in results:
            if r.boxes is not None and len(r.boxes) > 0:
                for box in r.boxes:
                    cls = int(box.cls.item())
                    conf = float(box.conf.item())
                    label = model.names[cls]
                    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    data.append({
                        "timestamp": timestamp,
                        "emotion": label,
                        "confidence": conf,
                        "session_id": session_id
                    })
                    console.print(f"[{session_id}] Detected: {label} (conf={conf:.2f})", style="green")

        if data:
            df = pd.DataFrame(data)
        else:
            console.print(f"[{session_id}] No emotions detected, returning neutral", style="yellow")
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            data.append({
                "timestamp": timestamp,
                "emotion": "neutral",
                "confidence": 0.0,
                "session_id": session_id
            })
            df = pd.DataFrame(data)

        csv_path = os.path.join(CSV_DIR, f"emotion_{session_id}.csv")
        df.to_csv(csv_path, index=False)
        return df
    except Exception as e:
        console.print(f"[{session_id}] Emotion inference error: {e}", style="red")
        raise

def summarize_csv(df: pd.DataFrame) -> str:
    summary = f"The dataset contains {len(df)} rows and {len(df.columns)} columns:\n"
    summary += f"Columns: {', '.join(df.columns)}\n\n"
    summary += "Sample data:\n"
    summary += df.head(5).to_string(index=False)
    return summary

def analyze_emotion_data(df: pd.DataFrame) -> str:
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

@app.post("/analyze-live-emotion")
async def analyze_live_emotion(video_frame: VideoFrame):
    session_id = video_frame.session_id or datetime.now().strftime("%Y%m%d%H%M%S")
    try:
        console.print(f"[{session_id}] Received /analyze-live-emotion request", style="bold yellow")

        # 🔧 Log raw base64 length
        console.print(f"[{session_id}] Frame base64 size: {len(video_frame.frame)}", style="cyan")

        # 🔧 Check base64 prefix safety
        if "," not in video_frame.frame:
            raise ValueError("Base64 data does not contain a header prefix")
        
        prefix, b64data = video_frame.frame.split(",", 1)
        frame_data = base64.b64decode(b64data)
        console.print(f"[{session_id}] Decoded frame size: {len(frame_data)} bytes", style="cyan")

        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError("Failed to decode frame into image")
        
        # 🔧 Save debug image
        debug_frame_path = f"{CSV_DIR}/debug_frame_{session_id}.jpg"
        cv2.imwrite(debug_frame_path, frame)
        console.print(f"[{session_id}] Saved debug frame at {debug_frame_path}", style="yellow")

        # Run YOLO emotion detection
        df = run_emotion_inference(frame, session_id)

        # 🔧 Confirm CSV write
        csv_path = os.path.join(CSV_DIR, f"emotion_{session_id}.csv")
        if os.path.exists(csv_path):
            console.print(f"[{session_id}] Emotion CSV saved: {csv_path}", style="green")
        else:
            console.print(f"[{session_id}] WARNING: Emotion CSV not found!", style="red")

        # Analyze and interpret results
        csv_summary = summarize_csv(df)
        stats_summary = analyze_emotion_data(df)
        rag_context = await get_rag_context("psychological interpretation of emotion data from facial recognition")
        interpretation = await interpret_with_groq(csv_summary, stats_summary, rag_context)

        console.print(f"[{session_id}] Emotion analysis completed", style="green")
        return {
            "session_id": session_id,
            "summary": csv_summary,
            "stats": stats_summary,
            "interpretation": interpretation
        }

    except ValueError as ve:
        console.print(f"[{session_id}] Value error: {ve}", style="red")
        raise HTTPException(status_code=400, detail={
            "session_id": session_id,
            "error": str(ve)
        })

    except Exception as e:
        console.print(f"[{session_id}] Emotion analysis error: {e}", style="red")
        raise HTTPException(status_code=500, detail={
            "session_id": session_id,
            "error": str(e)
        })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)