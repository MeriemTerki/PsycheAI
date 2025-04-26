from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import cv2
import numpy as np
from typing import Any, Dict, List
from datetime import datetime
import logging
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Eye Tracking API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# In-memory storage for gaze data
gaze_data_storage: Dict[str, List[Dict[str, Any]]] = {}

class FrameRequest(BaseModel):
    frame: str  # Base64-encoded JPEG image
    session_id: str

class GazeResponse(BaseModel):
    session_id: str
    timestamp: str
    eye_count: int
    gaze_points: List[Dict[str, float]]
    error: str | None = None

class GazeReportRequest(BaseModel):
    session_id: str

class GazeReportResponse(BaseModel):
    session_id: str
    data: List[Dict[str, Any]]
    summary: str
    stats: str
    interpretation: str
    error: str | None = None

@app.post("/capture-eye-tracking", response_model=GazeResponse)
async def capture_eye_tracking(request: FrameRequest):
    """
    Analyze a video frame for eye tracking.
    Expects a base64-encoded JPEG image and session ID.
    Returns gaze tracking results or an error.
    """
    try:
        # Decode base64 frame
        frame_data = base64.b64decode(request.frame.split(",")[1])  # Remove "data:image/jpeg;base64,"
        nparr = np.frombuffer(frame_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image")

        # Placeholder for eye tracking logic
        # Replace with actual model inference (e.g., GazeTracking, MediaPipe)
        eye_count = 2  # Mock: Assume two eyes detected
        gaze_points = [
            {"x": 0.5, "y": 0.5},  # Mock: Center of frame
            {"x": 0.6, "y": 0.4},  # Mock: Slightly offset
        ]

        # Store results
        result = {
            "session_id": request.session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "eye_count": eye_count,
            "gaze_points": gaze_points,
        }

        if request.session_id not in gaze_data_storage:
            gaze_data_storage[request.session_id] = []
        gaze_data_storage[request.session_id].append(result)

        logger.info(f"Eye tracking completed for session {request.session_id}")

        return GazeResponse(**result)

    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        return GazeResponse(
            session_id=request.session_id,
            timestamp=datetime.utcnow().isoformat(),
            eye_count=0,
            gaze_points=[],
            error=str(e)
        )

@app.post("/generate-gaze-report", response_model=GazeReportResponse)
async def generate_gaze_report(request: GazeReportRequest):
    """
    Generate a summary report for a session's gaze tracking data
    """
    try:
        if request.session_id not in gaze_data_storage:
            raise HTTPException(status_code=404, detail="Session not found")

        session_data = gaze_data_storage[request.session_id]
        
        if not session_data:
            raise HTTPException(status_code=404, detail="No gaze data available for this session")

        # Calculate summary statistics
        total_frames = len(session_data)
        valid_frames = sum(1 for entry in session_data if entry["eye_count"] > 0)
        avg_gaze_x = sum(p["x"] for entry in session_data for p in entry["gaze_points"]) / (valid_frames * 2)  # 2 eyes
        avg_gaze_y = sum(p["y"] for entry in session_data for p in entry["gaze_points"]) / (valid_frames * 2)

        # Generate report
        report = {
            "session_id": request.session_id,
            "data": session_data,
            "summary": f"Eye tracking analysis completed ({valid_frames}/{total_frames} valid frames)",
            "stats": f"Average gaze position: X={avg_gaze_x:.2f}, Y={avg_gaze_y:.2f}",
            "interpretation": (
                "The user's gaze was generally centered in the frame. "
                "This suggests normal eye movement patterns and engagement with the session."
            )
        }

        return GazeReportResponse(**report)

    except Exception as e:
        logger.error(f"Error generating gaze report: {str(e)}")
        return GazeReportResponse(
            session_id=request.session_id,
            data=[],
            summary="",
            stats="",
            interpretation="",
            error=str(e)
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)