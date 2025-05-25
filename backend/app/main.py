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

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# FastAPI App
app = FastAPI(
    title="Unified Mental Health Assessment API",
    description="Orchestrates gaze tracking, emotion recognition, voice chat, and final report generation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGINS", "http://localhost:8080")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
GAZE_CAPTURE_URL = os.getenv("GAZE_CAPTURE_URL", "http://localhost:8001/capture-eye-tracking")
GAZE_REPORT_URL = os.getenv("GAZE_REPORT_URL", "http://localhost:8001/generate-eye-tracking-report")
EMOTION_API_URL = os.getenv("EMOTION_API_URL", "http://127.0.0.1:8000/analyze-live-emotion")
CHAT_API_URL = os.getenv("CHAT_API_URL", "http://127.0.0.1:8002/chat")
TRANSCRIPT_GET_URL = os.getenv("TRANSCRIPT_GET_URL", "http://127.0.0.1:8002/transcript")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)

# Pydantic Schemas
class SessionRequest(BaseModel):
    messages: List[Dict[str, str]] = Field(..., description="Chat history including system prompt")
    is_post_session: bool = Field(False, description="If true, use provided gaze and emotion data")
    gaze_data: Optional[List[Dict[str, Any]]] = Field(None, description="Collected gaze tracking data")
    emotion_data: Optional[List[Dict[str, Any]]] = Field(None, description="Collected emotion recognition data")

class GazeData(BaseModel):
    report: Optional[str] = None
    error: Optional[str] = None
    summary: Optional[str] = None
    stats: Optional[str] = None
    interpretation: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None

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

# Store the last generated report
last_generated_report: Optional[FinalReport] = None

# System Prompt
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

# Helpers
async def generate_final_report(
    gaze_report: str,
    emotion_data: EmotionData,
    transcript: str
) -> FinalReport:
    session_id = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    prompt = f"""
{REPORT_SYSTEM_PROMPT}

Input Data:
- Gaze Tracking Report:
{gaze_report}

- Emotion Recognition Data:
  Summary: {emotion_data.summary or 'No data available'}
  Statistics: {emotion_data.stats or 'No data available'}
  Interpretation: {emotion_data.interpretation or 'No data available'}

- Conversation Transcript:
{transcript}

Please provide a structured report in the following format:

Summary:
• Gaze Tracking Report: [key findings]
• Emotion Recognition Data: [key findings]
• User appears [emotional state] based on facial features
• Conversation Transcript: [key points from conversation]
• Assistant provided [type of support]

Recommended Treatment:
1. [Treatment Type]:
   [Description and rationale]
2. [Treatment Type]:
   [Description and rationale]
3. [Treatment Type]:
   [Description and rationale]
4. [Treatment Type]:
   [Description and rationale]

Please ensure each point is clearly separated with bullet points (•) in the Summary section and numbered points in the Recommended Treatment section.
"""

    retries, delay = 3, 60
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"[{session_id}] Generating final report (attempt {attempt})")
            resp = groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": REPORT_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                model="llama3-8b-8192",
                temperature=0.7,
                max_tokens=1000
            )
            content = resp.choices[0].message.content

            # Ensure proper formatting
            if not content.startswith("Summary:"):
                content = "Summary:\n" + content
            if "Recommended Treatment:" not in content:
                content += "\n\nRecommended Treatment:\nNo specific treatment recommendations available."

            return FinalReport(report=content, timestamp=datetime.utcnow().isoformat())
        except Exception as e:
            logger.warning(f"[{session_id}] Report generation error: {str(e)}")
            if attempt < retries and "rate_limit_exceeded" in str(e):
                logger.info(f"[{session_id}] Retrying in {delay}s...")
                time.sleep(delay)
                delay *= 2
            else:
                logger.error(f"[{session_id}] Failed to generate report: {str(e)}")
                return FinalReport(
                    report="Error generating report: " + str(e),
                    timestamp=datetime.utcnow().isoformat()
                )

async def run_session(messages: List[Dict[str, str]], is_post: bool, gaze_data_input: Optional[List[Dict[str, Any]]], emotion_data_input: Optional[List[Dict[str, Any]]]) -> SessionResult:
    session_id = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    logger.info(f"[{session_id}] Starting session (post={is_post})")
    logger.debug(f"[{session_id}] Gaze data: {gaze_data_input}")
    logger.debug(f"[{session_id}] Emotion data: {emotion_data_input}")

    gaze_data = GazeData(error="Skipped") if is_post else GazeData()
    emotion_data = EmotionData(error="Skipped") if is_post else EmotionData()
    chat_data = ChatData()
    transcript = ""

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Process gaze data first if available
        if gaze_data_input:
            try:
                logger.info(f"[{session_id}] Processing gaze data with {len(gaze_data_input)} frames")
                r = await client.post(
                    GAZE_REPORT_URL,
                    json={"session_id": session_id, "gaze_data": gaze_data_input},
                    timeout=30.0
                )
                
                if r.status_code == 200:
                    gaze_report = r.json()
                    logger.info(f"[{session_id}] Successfully received gaze report: {gaze_report}")
                    
                    # Properly structure the gaze tracking result
                    gaze_data = GazeData(
                        summary=gaze_report.get("summary"),
                        stats=gaze_report.get("stats"),
                        interpretation=gaze_report.get("interpretation"),
                        data=gaze_data_input,
                        error=None
                    )
                    logger.info(f"[{session_id}] Structured gaze data: {gaze_data}")
                else:
                    error_msg = f"Gaze report generation failed: {r.text}"
                    logger.error(f"[{session_id}] {error_msg}")
                    try:
                        error_detail = r.json().get("detail", r.text)
                    except:
                        error_detail = r.text
                    gaze_data = GazeData(error=error_detail)
            except Exception as e:
                error_msg = f"Gaze processing error: {str(e)}"
                logger.error(f"[{session_id}] {error_msg}")
                gaze_data = GazeData(error=error_msg)

        # Process emotion data if available
        if emotion_data_input:
            try:
                latest_emotion = emotion_data_input[-1] if emotion_data_input else {}
                emotion_data = EmotionData(
                    summary=latest_emotion.get("summary", "No data"),
                    stats=latest_emotion.get("stats", "No data"),
                    interpretation=latest_emotion.get("interpretation", "No data")
                )
            except Exception as e:
                logger.error(f"[{session_id}] Emotion data processing error: {e}")
                emotion_data.error = str(e)

        # Process chat if messages available
        if messages:
            try:
                r = await client.post(CHAT_API_URL, json={"messages": messages})
                chat_data = ChatData(**(r.json() if r.status_code == 200 else {"error": r.text}))
            except Exception as e:
                logger.error(f"[{session_id}] Chat error: {e}")
                chat_data.error = str(e)

            try:
                r = await client.get(TRANSCRIPT_GET_URL)
                transcript = r.json().get("transcript", "") if r.status_code == 200 else ""
            except Exception as e:
                logger.error(f"[{session_id}] Transcript fetch error: {e}")
                transcript = ""

    # Generate final report
    final_report = await generate_final_report(
        gaze_report=gaze_data.summary or gaze_data.interpretation or "No gaze data available",
        emotion_data=emotion_data,
        transcript=transcript
    )

    # Store the generated report
    global last_generated_report
    last_generated_report = final_report

    # Construct and return session result
    result = SessionResult(
        session_id=session_id,
        gaze_tracking=gaze_data.dict(exclude_none=True),
        emotion_recognition=emotion_data,
        voice_chat=chat_data,
        transcript=transcript,
        final_report=final_report
    )

    logger.info(f"[{session_id}] Session complete with result: {result}")
    return result

# Routes
@app.post("/start-session", response_model=SessionResult)
async def start_session(req: SessionRequest):
    try:
        logger.info("Received /start-session request with payload: %s", req.dict())
        
        if req.is_post_session:
            logger.info("Processing post-session analysis")
            if not req.gaze_data:
                logger.warning("No gaze data provided for post-session analysis")
            if not req.emotion_data:
                logger.warning("No emotion data provided for post-session analysis")
            
            # Ensure we have some data to process
            if not req.messages:
                raise HTTPException(status_code=400, detail="No messages provided for analysis")

        result = await run_session(req.messages, req.is_post_session, req.gaze_data, req.emotion_data)
        
        # Validate result before returning
        if not result:
            raise HTTPException(status_code=500, detail="Failed to generate session results")
        
        if not result.final_report or not result.final_report.report:
            logger.error("Missing final report in session results")
            result.final_report = FinalReport(
                report="Error: Failed to generate comprehensive report",
                timestamp=datetime.utcnow().isoformat()
            )
        
        logger.info("Successfully generated session results: %s", result)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unhandled error in /start-session")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Unified Mental Health Assessment API"}

@app.post("/generate-eye-tracking-report")
async def generate_eye_tracking_report(request: Dict[str, Any]):
    """
    Generate a report from eye tracking data.
    """
    try:
        session_id = request.get("session_id")
        gaze_data = request.get("gaze_data", [])
        
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")
            
        if not gaze_data:
            raise HTTPException(status_code=400, detail="No gaze data provided")

        logger.info(f"Forwarding gaze report request for session {session_id} with {len(gaze_data)} frames")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GAZE_REPORT_URL,
                json={"session_id": session_id, "gaze_data": gaze_data},
                timeout=30.0
            )
            
            if response.status_code != 200:
                error_msg = f"Gaze tracking service error: {response.text}"
                logger.error(f"[{session_id}] {error_msg}")
                raise HTTPException(status_code=response.status_code, detail=error_msg)
                
            return response.json()
            
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error generating eye tracking report: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get-report")
async def get_report():
    """
    Get the last generated report from the session.
    """
    try:
        if last_generated_report is None:
            # Return empty report instead of raising an error
            return {
                "report": "",
                "timestamp": datetime.utcnow().isoformat()
            }
        # Convert FinalReport to dict before returning
        return {
            "report": last_generated_report.report,
            "timestamp": last_generated_report.timestamp
        }
    except Exception as e:
        logger.error(f"Error retrieving report: {e}")
        # Return empty report instead of raising an error
        return {
            "report": "",
            "timestamp": datetime.utcnow().isoformat()
        }