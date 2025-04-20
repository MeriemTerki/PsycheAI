import sys
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
from typing import List
from app.utils import diagnose_and_treat
from groq import Groq
from rich.console import Console

# Fix path so we can import from voiceAgent
voice_agent_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'voiceAgent'))
if voice_agent_path not in sys.path:
    sys.path.append(voice_agent_path)

# Now we can import from voiceAgent.app
from voiceAgent.app.rag_assistant import transcribe_audio, text_to_speech, SYSTEM_PROMPT, should_end_conversation
from voiceAgent.app.config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Endpoints
EMOTION_API_URL = "http://127.0.0.1:8000/analyze-live-emotion"
EYE_CAPTURE_URL = "http://127.0.0.1:8001/capture-eye-tracking"
EYE_REPORT_URL = "http://127.0.0.1:8001/generate-eye-tracking-report"
CHAT_API_URL = "http://127.0.0.1:8002/chat"
TRANSCRIPT_UPLOAD_URL = "http://127.0.0.1:8002/upload_transcript"

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
console = Console()

async def run_voice_session() -> List[str]:
    system_message = {'role': 'system', 'content': SYSTEM_PROMPT}
    messages = [system_message]
    memory_size = 10
    transcript_log = []
    conversation_active = True

    console.print("[bold green]🎤 Starting voice session...[/bold green]")

    while conversation_active:
        user_msg = await transcribe_audio()
        if not user_msg:
            continue

        messages.append({'role': 'user', 'content': user_msg})
        transcript_log.append(f"User: {user_msg}")

        if should_end_conversation(user_msg):
            goodbye = "Goodbye! Take care."
            text_to_speech(goodbye)
            transcript_log.append(f"Assistant: {goodbye}")
            conversation_active = False
            continue

        if len(messages) > memory_size:
            messages = [system_message] + messages[-(memory_size - 1):]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(CHAT_API_URL, json={"messages": messages})
                assistant_reply = response.json().get("reply", "Sorry, something went wrong.")
        except Exception as e:
            assistant_reply = f"API call failed: {e}"

        messages.append({'role': 'assistant', 'content': assistant_reply})
        transcript_log.append(f"Assistant: {assistant_reply}")
        text_to_speech(assistant_reply)

    # Upload transcript
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(TRANSCRIPT_UPLOAD_URL, json={"transcript": "\n".join(transcript_log)})
            if res.status_code == 200:
                console.print("📝 Transcript uploaded.", style="green")
    except Exception as e:
        console.print(f"❌ Upload failed: {e}", style="red")

    return transcript_log

@app.get("/")
async def root():
    return {"message": "Unified Mental Health Inference API"}

@app.get("/diagnosis-treatment")
async def diagnosis_and_treatment():
    console.print("[bold cyan]🚀 Running full diagnosis pipeline...[/bold cyan]")

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            voice_task = run_voice_session()
            emotion_task = client.get(EMOTION_API_URL)
            eye_task = client.post(EYE_CAPTURE_URL)

            voice_transcript, emotion_response, eye_capture_response = await asyncio.gather(
                voice_task, emotion_task, eye_task
            )

            if not isinstance(voice_transcript, list):
                raise HTTPException(status_code=500, detail="Transcript format error")

            if emotion_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Emotion report failed")
            if eye_capture_response.status_code != 200:
                raise HTTPException(status_code=500, detail="Eye capture failed")

            # Get eye tracking report separately
            try:
                eye_report_response = await client.get(EYE_REPORT_URL)
                if eye_report_response.status_code != 200:
                    raise HTTPException(status_code=500, detail="Eye report fetch failed")
                eye_data = eye_report_response.json()
            except httpx.ReadTimeout:
                console.print("⏰ Eye tracking report request timed out.", style="red")
                eye_data = {"report": "Unavailable due to timeout."}

            emotion_data = emotion_response.json()

            # Defensive casting
            emotion_report = {
                "summary": emotion_data.get("summary", ""),
                "stats": emotion_data.get("stats", ""),
                "interpretation": emotion_data.get("interpretation", "")
            }

            eye_tracking_report = eye_data.get("report", "")
            if not isinstance(eye_tracking_report, str):
                eye_tracking_report = str(eye_tracking_report)

            conversation_transcript = "\n".join(voice_transcript)

            # Call utility
            result = await diagnose_and_treat(
                emotion_report=emotion_report,
                eye_tracking_report=eye_tracking_report,
                conversation_transcript=conversation_transcript,
                groq_client=groq_client
            )

            return {
                "emotion_report": emotion_data,
                "eye_tracking_report": eye_data,
                "transcript": conversation_transcript,
                "diagnosis_and_treatment": result
            }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pipeline failure: {str(e)}")