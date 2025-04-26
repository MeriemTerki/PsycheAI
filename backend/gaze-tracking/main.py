from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import cv2
import numpy as np
import base64
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EyeTrackingRequest(BaseModel):
    frame: str
    session_id: str

def ensure_serializable(obj):
    """Recursively convert NumPy types to Python types."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, list):
        return [ensure_serializable(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: ensure_serializable(value) for key, value in obj.items()}
    return obj

@app.post("/capture-eye-tracking")
async def capture_eye_tracking(request: EyeTrackingRequest):
    try:
        # Decode base64 image
        if not request.frame.startswith("data:image/jpeg;base64,"):
            raise HTTPException(status_code=400, detail="Invalid image format")
        frame_data = base64.b64decode(request.frame.split(",")[1])
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="Failed to decode image data")
        
        # Placeholder eye-tracking logic (replace with actual implementation)
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
        if eye_cascade.empty():
            raise HTTPException(status_code=500, detail="Failed to load eye cascade classifier")
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        # Convert eye count to Python int
        eye_count = int(len(eyes))
        
        # Generate gaze points
        gaze_points = []
        for (x, y, w, h) in eyes:
            gaze_points.append({"x": int(x + w / 2), "y": int(y + h / 2)})
        
        # Prepare response
        response = {
            "session_id": request.session_id,
            "timestamp": datetime.now().isoformat(),
            "eye_count": eye_count,
            "gaze_points": gaze_points,
            "data": {
                "processed": True,
                "frame_shape": [int(dim) for dim in frame.shape]
            }
        }
        
        # Log response for debugging
        logger.debug("Response before serialization: %s", response)
        
        # Ensure all fields are serializable
        serializable_response = ensure_serializable(response)
        
        # Log serialized response
        logger.debug("Serialized response: %s", serializable_response)
        
        return serializable_response
        
    except Exception as e:
        logger.error("Error in capture_eye_tracking: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Eye tracking error: {str(e)}",
            headers={"Access-Control-Allow-Origin": "*"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)