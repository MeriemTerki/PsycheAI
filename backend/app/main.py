import os
import time
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from groq import Groq

load_dotenv()

# ─── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ─── FastAPI App ───────────────────────────────────────────────────────────
app = FastAPI(
    title="Unified Mental Health Assessment API",
    description="Orchestrates gaze tracking, emotion recognition, voice chat and final report generation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGINS", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Configuration ─────────────────────────────────────────────────────────
GAZE_CAPTURE_URL    = os.getenv("GAZE_CAPTURE_URL",    "http://127.0.0.1:8001/capture-eye-tracking")
GAZE_REPORT_URL     = os.getenv("GAZE_REPORT_URL",     "http://127.0.0.1:8001/generate-eye-tracking-report")
EMOTION_API_URL     = os.getenv("EMOTION_API_URL",     "http://127.0.0.1:8000/analyze-live-emotion")
CHAT_API_URL        = os.getenv("CHAT_API_URL",        "http://127.0.0.1:8002/chat")
TRANSCRIPT_GET_URL  = os.getenv("TRANSCRIPT_GET_URL",  "http://127.0.0.1:8002/transcript")
GROQ_API_KEY        = os.getenv("GROQ_API_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)

# ─── Pydantic Schemas ──────────────────────────────────────────────────────
class SessionRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(..., description="Chat history including system prompt")
    is_post_session: bool = Field(False, description="If true, skip live gaze & emotion")

class GazeData(BaseModel):
    report: Optional[str] = None
    error: Optional[str] = None

class EmotionData(BaseModel):
    summary: Optional[str] = None
    stats: Optional[str] = None
    interpretation: Optional[str] = None
    error: Optional[str] = None

class ChatData(BaseModel):
    reply: Optional[str] = None
    error: Optional[str] = None

class FinalReport(BaseModel):
    report: str
    timestamp: str

class SessionResult(BaseModel):
    session_id: str
    gaze_tracking: GazeData
    emotion_recognition: EmotionData
    voice_chat: ChatData
    transcript: str
    final_report: FinalReport

# ─── System Prompt ─────────────────────────────────────────────────────────
REPORT_SYSTEM_PROMPT = """
You are a psychological data analyst tasked with generating a comprehensive mental health assessment report. Your role is to:
1. Analyze data from gaze tracking, emotion recognition, and voice conversation transcripts.
2. Provide a concise, evidence-based interpretation of emotional stability, cognitive patterns, and behavioral implications.
3. Suggest treatment approaches based on the analysis.
4. Be professional, empathetic, and avoid clinical diagnoses.
5. Structure the output as:
   - Summary: Key findings from each data source.
   - Interpretation: Psychological insights and patterns.
   - Recommended Treatment: Practical suggestions for mental health support.
"""

# ─── Helpers ────────────────────────────────────────────────────────────────
async def generate_final_report(
    gaze_report: str,
    emotion_data: EmotionData,
    transcript: str
) -> FinalReport:
    session_id = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    prompt = f"""
{REPORT_SYSTEM_PROMPT}

**Input Data:**
- **Gaze Tracking Report**: {gaze_report}
- **Emotion Recognition Data**:
  - Summary: {emotion_data.summary or ''}
  - Statistics: {emotion_data.stats or ''}
  - Interpretation: {emotion_data.interpretation or ''}
- **Conversation Transcript**: {transcript}

Please provide a structured report with Summary, Interpretation, and Recommended Treatment.
"""
    # retry logic
    retries, delay = 3, 60
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"[{session_id}] Generating final report (attempt {attempt})")
            resp = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": REPORT_SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt}
                ],
                model="llama3-8b-8192",
                temperature=0.7,
                max_tokens=1000
            )
            content = resp.choices[0].message.content
            return FinalReport(report=content, timestamp=datetime.utcnow().isoformat())
        except Exception as e:
            logger.warning(f"[{session_id}] Report generation error: {e}")
            if attempt < retries and "rate_limit_exceeded" in str(e):
                logger.info(f"[{session_id}] Retrying in {delay}s…")
                time.sleep(delay)
                delay *= 2
            else:
                logger.error(f"[{session_id}] Failed to generate report: {e}")
                return FinalReport(report=f"Error: {e}", timestamp=datetime.utcnow().isoformat())

async def run_session(messages: List[Dict[str, str]], is_post: bool) -> SessionResult:
    session_id = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    logger.info(f"[{session_id}] Starting session (post={is_post})")

    gaze_data    = GazeData(error="Skipped") if is_post else GazeData()
    emotion_data = EmotionData(error="Skipped") if is_post else EmotionData()
    chat_data    = ChatData()
    transcript   = ""

    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1) Gaze
        if not is_post:
            try:
                r = await client.post(GAZE_CAPTURE_URL, json={"frame": "", "session_id": session_id})
                gaze_data = GazeData(**(r.json() if r.status_code == 200 else {"error": r.text}))
                # then fetch report
                rr = await client.get(GAZE_REPORT_URL)
                gaze_data.report = rr.json().get("report") if rr.status_code == 200 else f"Error {rr.status_code}"
            except Exception as e:
                logger.error(f"[{session_id}] Gaze error: {e}")
                gaze_data.error = str(e)

        # 2) Emotion
        if not is_post:
            try:
                r = await client.post(EMOTION_API_URL, json={"frame": "", "session_id": session_id})
                emotion_data = EmotionData(**(r.json() if r.status_code == 200 else {"error": r.text}))
            except Exception as e:
                logger.error(f"[{session_id}] Emotion error: {e}")
                emotion_data.error = str(e)

        # 3) Chat
        try:
            r = await client.post(CHAT_API_URL, json={"messages": messages})
            chat_data = ChatData(**(r.json() if r.status_code == 200 else {"error": r.text}))
        except Exception as e:
            logger.error(f"[{session_id}] Chat error: {e}")
            chat_data.error = str(e)

        # 4) Transcript
        try:
            r = await client.get(TRANSCRIPT_GET_URL)
            transcript = r.json().get("transcript", "") if r.status_code == 200 else ""
        except Exception as e:
            logger.error(f"[{session_id}] Transcript fetch error: {e}")
            transcript = ""

    final_report = await generate_final_report(
        gaze_report=gaze_data.report or "",
        emotion_data=emotion_data,
        transcript=transcript
    )

    logger.info(f"[{session_id}] Session complete")
    return SessionResult(
        session_id=session_id,
        gaze_tracking=gaze_data,
        emotion_recognition=emotion_data,
        voice_chat=chat_data,
        transcript=transcript,
        final_report=final_report
    )

# ─── Routes ────────────────────────────────────────────────────────────────
@app.post("/start-session", response_model=SessionResult)
async def start_session(req: SessionRequest):
    try:
        result = await run_session(req.messages, req.is_post_session)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled error in /start-session")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Unified Mental Health Assessment API"}