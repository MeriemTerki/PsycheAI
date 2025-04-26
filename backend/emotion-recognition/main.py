from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import cv2
import numpy as np
import base64
from datetime import datetime

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EmotionRequest(BaseModel):
    frame: str
    session_id: str

@app.post("/analyze-live-emotion")
async def analyze_emotion(request: EmotionRequest):
    try:
        # Decode base64 image
        frame_data = base64.b64decode(request.frame.split(",")[1])
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image data")
        
        # Here you would add your actual emotion detection logic
        # This is just a placeholder response
        return {
            "session_id": request.session_id,
            "timestamp": datetime.now().isoformat(),
            "summary": "Emotion analysis placeholder",
            "stats": "Sample stats",
            "interpretation": "Sample interpretation"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
            headers={"Access-Control-Allow-Origin": "*"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)