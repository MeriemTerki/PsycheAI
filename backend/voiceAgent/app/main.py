from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.rag_assistant import assistant_chat, SYSTEM_PROMPT
import asyncio

app = FastAPI()

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory transcript store
current_transcript = ""

class ChatRequest(BaseModel):
    messages: list

class ChatResponse(BaseModel):
    reply: str

class TranscriptUpload(BaseModel):
    transcript: str

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        reply = await assistant_chat(request.messages)
        return {"reply": reply}
    except Exception as e:
        return {"reply": f"Error: {e}"}

@app.post("/upload_transcript")
async def upload_transcript(data: TranscriptUpload):
    global current_transcript
    current_transcript = data.transcript
    return {"message": "Transcript received successfully."}

@app.get("/transcript")
async def get_transcript():
    if not current_transcript:
        return {"transcript": "No transcript available."}
    return {"transcript": current_transcript}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
