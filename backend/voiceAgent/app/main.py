# voiceAgent/main.py
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
from .rag_assistant import assistant_chat, generate_tts_bytes   # <-- import here
from rich.console import Console

app = FastAPI()
console = Console()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]

class TranscriptRequest(BaseModel):
    transcript: str

class TTSRequest(BaseModel):
    text: str   # <-- new model for TTS

# In-memory transcript storage
transcript_storage = ""

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        console.print("Received /chat request", style="bold yellow")
        reply = await assistant_chat(request.messages)
        console.print(f"Chat response: {reply}", style="green")
        return {"reply": reply}
    except Exception as e:
        console.print(f"Error in /chat: {e}", style="red")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload_transcript")
async def upload_transcript(request: TranscriptRequest):
    try:
        console.print("Received /upload_transcript request", style="bold yellow")
        global transcript_storage
        transcript_storage = request.transcript
        console.print("Transcript uploaded successfully", style="green")
        return {"status": "success"}
    except Exception as e:
        console.print(f"Error in /upload_transcript: {e}", style="red")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/transcript")
async def get_transcript():
    try:
        console.print("Received /transcript request", style="bold yellow")
        return {"transcript": transcript_storage}
    except Exception as e:
        console.print(f"Error in /transcript: {e}", style="red")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tts")   # <-- new endpoint
async def tts_endpoint(request: TTSRequest):
    try:
        console.print("Received /tts request", style="bold yellow")
        audio_bytes = generate_tts_bytes(request.text)
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        console.print(f"Error in /tts: {e}", style="red")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8002, reload=True)
