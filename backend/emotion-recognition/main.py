from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import cv2
import numpy as np
from typing import Any, Dict, List
from datetime import datetime
import logging
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Emotion Recognition API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory storage for emotion data
emotion_data_storage: Dict[str, List[Dict[str, Any]]] = {}

class FrameRequest(BaseModel):
    frame: str  # Base64-encoded JPEG image
    session_id: str

class EmotionResponse(BaseModel):
    session_id: str
    timestamp: str
    summary: str
    stats: str
    interpretation: str
    error: str | None = None

@app.post("/analyze-live-emotion", response_model=EmotionResponse)
async def analyze_live_emotion(request: FrameRequest):
    """
    Analyze a video frame for emotion recognition.
    Expects a base64-encoded JPEG image and session ID.
    Returns emotion analysis results or an error.
    """
    try:
        # Decode base64 frame
        frame_data = base64.b64decode(request.frame.split(",")[1])  # Remove "data:image/jpeg;base64,"
        nparr = np.frombuffer(frame_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image")

        # Placeholder for emotion recognition logic
        # Replace with actual model inference (e.g., DeepFace, custom model)
        summary = "Neutral emotion detected"
        stats = "Confidence: 0.8"
        interpretation = "The user appears calm based on facial features."

        # Store results
        result = {
            "session_id": request.session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "summary": summary,
            "stats": stats,
            "interpretation": interpretation,
        }

        if request.session_id not in emotion_data_storage:
            emotion_data_storage[request.session_id] = []
        emotion_data_storage[request.session_id].append(result)

        logger.info(f"Emotion analysis completed for session {request.session_id}")

        return EmotionResponse(**result)

    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        return EmotionResponse(
            session_id=request.session_id,
            timestamp=datetime.utcnow().isoformat(),
            summary="",
            stats="",
            interpretation="",
            error=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)