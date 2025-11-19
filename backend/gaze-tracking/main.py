from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import base64
import cv2
import numpy as np
from typing import Any, Dict, List
from datetime import datetime
import logging
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
from scipy.spatial import distance
import json
import os
import re
import time

app = FastAPI(title="Eye Tracking API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Landmark indices
LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
LEFT_IRIS_CENTER = 468
RIGHT_IRIS_CENTER = 473

# File-based storage for gaze data
DATA_DIR = "gaze_data"
os.makedirs(DATA_DIR, exist_ok=True)

def sanitize_session_id(session_id: str) -> str:
    """Sanitize session ID to be safe for filenames on all platforms."""
    # Replace invalid characters (including :, which is invalid on Windows) with _
    # Allow alphanumeric, -, _, and . for compatibility
    sanitized = re.sub(r'[^\w\-\.]', '_', session_id)
    # Remove leading/trailing dots and ensure no double underscores
    sanitized = sanitized.strip('.').replace('__', '_')
    logger.info(f"Sanitized session ID: {session_id} -> {sanitized}")
    return sanitized

def save_gaze_data(session_id: str, data: List[Dict[str, Any]]):
    """Save gaze data to a JSON file with retry logic."""
    max_retries = 3
    sanitized_id = sanitize_session_id(session_id)
    file_path = os.path.join(DATA_DIR, f"{sanitized_id}.json")
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Saving gaze data for session {session_id} to {file_path}, entries: {len(data)} (attempt {attempt})")
            # Check file permissions
            os.makedirs(DATA_DIR, exist_ok=True)
            with open(file_path, "w") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Successfully saved gaze data for session {session_id} to {file_path}")
            return
        except Exception as e:
            logger.error(f"Failed to save gaze data for session {session_id} on attempt {attempt}: {str(e)}")
            if attempt == max_retries:
                raise HTTPException(status_code=500, detail=f"Failed to save gaze data after {max_retries} attempts: {str(e)}")
            time.sleep(1)  # Wait before retrying

def load_gaze_data(session_id: str) -> List[Dict[str, Any]]:
    """Load gaze data from a JSON file."""
    try:
        sanitized_id = sanitize_session_id(session_id)
        file_path = os.path.join(DATA_DIR, f"{sanitized_id}.json")
        logger.info(f"Loading gaze data for session {session_id} from {file_path}")
        if not os.path.exists(file_path):
            logger.warning(f"No gaze data file found for session {session_id} at {file_path}")
            return []
        with open(file_path, "r") as f:
            data = json.load(f)
        logger.info(f"Loaded {len(data)} gaze data entries for session {session_id} from {file_path}")
        return data
    except Exception as e:
        logger.error(f"Failed to load gaze data for session {session_id}: {str(e)}")
        return []

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
    gaze_data: List[Dict[str, Any]] | None = None

class GazeReportResponse(BaseModel):
    session_id: str
    data: List[Dict[str, Any]]
    summary: str
    stats: str
    interpretation: str
    error: str | None = None

def calculate_ear(eye_points):
    """Calculate Eye Aspect Ratio (EAR) for blink detection."""
    v1 = distance.euclidean(eye_points[1], eye_points[5])
    v2 = distance.euclidean(eye_points[2], eye_points[4])
    h = distance.euclidean(eye_points[0], eye_points[3])
    return (v1 + v2) / (2.0 * h) if h > 0 else 0

def get_eye_ear(face_landmarks, eye_indices, frame_width, frame_height):
    """Calculate EAR for a given eye using MediaPipe landmarks."""
    eye_points = []
    for index in eye_indices:
        landmark = face_landmarks.landmark[index]
        x = landmark.x * frame_width
        y = landmark.y * frame_height
        eye_points.append((x, y))
    return calculate_ear(eye_points)

def get_iris_center(face_landmarks, iris_index, frame_width, frame_height):
    """Get the center of the iris using MediaPipe landmarks."""
    landmark = face_landmarks.landmark[iris_index]
    return (landmark.x * frame_width, landmark.y * frame_height)

@app.post("/capture-eye-tracking", response_model=GazeResponse)
async def capture_eye_tracking(request: FrameRequest):
    """
    Analyze a video frame for eye tracking using MediaPipe.
    Expects a base64-encoded JPEG image and session ID.
    Returns gaze tracking results or an error.
    """
    try:
        if not request.session_id:
            raise ValueError("Session ID is required")
        
        logger.info(f"Processing frame for session {request.session_id}")

        # Decode base64 frame
        try:
            frame_data = base64.b64decode(request.frame.split(",")[1])
        except Exception as e:
            raise ValueError(f"Invalid base64 frame data: {str(e)}")
        
        nparr = np.frombuffer(frame_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise ValueError("Failed to decode image")

        # Process frame with MediaPipe
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(img_rgb)
        frame_height, frame_width = img.shape[:2]

        eye_count = 0
        gaze_points = []

        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            
            # Process left eye
            ear_left = get_eye_ear(face_landmarks, LEFT_EYE_INDICES, frame_width, frame_height)
            left_iris = get_iris_center(face_landmarks, LEFT_IRIS_CENTER, frame_width, frame_height)
            
            # Process right eye
            ear_right = get_eye_ear(face_landmarks, RIGHT_EYE_INDICES, frame_width, frame_height)
            right_iris = get_iris_center(face_landmarks, RIGHT_IRIS_CENTER, frame_width, frame_height)

            # Count eyes if detected (EAR > 0.1 for robustness)
            if ear_left > 0.1:
                eye_count += 1
                gaze_points.append({"x": left_iris[0] / frame_width, "y": left_iris[1] / frame_height})
            if ear_right > 0.1:
                eye_count += 1
                gaze_points.append({"x": right_iris[0] / frame_width, "y": right_iris[1] / frame_height})

        # Fallback: add a default gaze point if no eyes detected
        if not gaze_points:
            gaze_points.append({"x": 0.5, "y": 0.5})
            logger.warning(f"No eyes detected for session {request.session_id}, using fallback gaze point")

        # Store results
        result = {
            "session_id": request.session_id,
            "timestamp": datetime.utcnow().isoformat(),
            "eye_count": eye_count,
            "gaze_points": gaze_points,
        }

        try:
            gaze_data = load_gaze_data(request.session_id)
            gaze_data.append(result)
            save_gaze_data(request.session_id, gaze_data)
        except Exception as e:
            logger.error(f"Failed to store gaze data for session {request.session_id}: {str(e)}")
            raise ValueError(f"Data storage error: {str(e)}")

        logger.info(f"Eye tracking completed for session {request.session_id}, eyes detected: {eye_count}, gaze points: {len(gaze_points)}")

        return GazeResponse(**result)

    except Exception as e:
        logger.error(f"Error processing frame for session {request.session_id}: {str(e)}")
        return GazeResponse(
            session_id=request.session_id,
            timestamp=datetime.utcnow().isoformat(),
            eye_count=0,
            gaze_points=[{"x": 0.5, "y": 0.5}],
            error=str(e)
        )

@app.post("/generate-eye-tracking-report", response_model=GazeReportResponse)
async def generate_eye_tracking_report(request: GazeReportRequest):
    """
    Generate a summary report for a session's gaze tracking data with psychological interpretation.
    """
    try:
        if not request.session_id:
            logger.warning("Received empty session ID")
            raise HTTPException(status_code=400, detail="Session ID is required")

        logger.info(f"Generating gaze report for session {request.session_id}")

        # Use provided gaze data if available, otherwise load from file
        session_data = request.gaze_data if request.gaze_data else load_gaze_data(request.session_id)
        
        if not session_data:
            error_msg = f"No gaze data available for session {request.session_id}"
            logger.warning(error_msg)
            raise HTTPException(status_code=404, detail=error_msg)

        # Calculate summary statistics
        total_frames = len(session_data)
        valid_frames = sum(1 for entry in session_data if entry.get("eye_count", 0) > 0)
        
        if valid_frames == 0:
            logger.warning(f"No valid frames with eye detections for session {request.session_id}")
            return GazeReportResponse(
                session_id=request.session_id,
                data=session_data,
                summary="No valid eye tracking data collected",
                stats="No statistics available",
                interpretation="Unable to analyze due to lack of valid eye detections, possibly due to poor lighting or camera positioning.",
                error="No valid frames with eye detections"
            )

        avg_eye_count = sum(entry.get("eye_count", 0) for entry in session_data) / total_frames
        gaze_points = [p for entry in session_data for p in entry.get("gaze_points", [])]
        
        if not gaze_points:
            logger.warning(f"No gaze points found in data for session {request.session_id}")
            return GazeReportResponse(
                session_id=request.session_id,
                data=session_data,
                summary="No valid gaze points collected",
                stats="No statistics available",
                interpretation="Unable to analyze due to lack of valid gaze points.",
                error="No valid gaze points found in data"
            )

        # Calculate gaze metrics
        avg_gaze_x = sum(p.get("x", 0.5) for p in gaze_points) / len(gaze_points)
        avg_gaze_y = sum(p.get("y", 0.5) for p in gaze_points) / len(gaze_points)
        x_range = (min(p.get("x", 0.5) for p in gaze_points), max(p.get("x", 0.5) for p in gaze_points))
        y_range = (min(p.get("y", 0.5) for p in gaze_points), max(p.get("y", 0.5) for p in gaze_points))

        # Calculate gaze stability
        x_std = np.std([p.get("x", 0.5) for p in gaze_points])
        y_std = np.std([p.get("y", 0.5) for p in gaze_points])
        gaze_stability = (x_std + y_std) / 2

        # Generate report sections
        summary = f"Eye tracking analysis completed with {valid_frames} valid frames out of {total_frames} total frames ({(valid_frames/total_frames*100):.1f}% success rate)"
        
        stats = (
            f"Average Eyes Detected: {avg_eye_count:.2f}\n"
            f"Gaze Position (avg): X={avg_gaze_x:.2f}, Y={avg_gaze_y:.2f}\n"
            f"Gaze Range: X={x_range[0]:.2f}-{x_range[1]:.2f}, Y={y_range[0]:.2f}-{y_range[1]:.2f}\n"
            f"Gaze Stability: {gaze_stability:.3f}"
        )

        # Define attention level based on gaze stability
        attention_level = (
            "highly focused attention" if gaze_stability < 0.05
            else "normal engagement" if gaze_stability < 0.1
            else "active visual exploration"
        )

        # Define gaze distribution pattern
        gaze_pattern = (
            "concentrated focus" if max(x_range[1]-x_range[0], y_range[1]-y_range[0]) < 0.3
            else "balanced visual attention" if max(x_range[1]-x_range[0], y_range[1]-y_range[0]) < 0.6
            else "broad visual scanning"
        )

        interpretation = (
            f"Analysis shows {valid_frames} successful eye detections out of {total_frames} frames, "
            f"with an average of {avg_eye_count:.1f} eyes tracked per frame. "
            f"The gaze pattern indicates {attention_level}, "
            f"based on the gaze stability measure of {gaze_stability:.3f}. "
            f"The gaze distribution suggests {gaze_pattern} behavior."
        )

        logger.info(f"Generated gaze report for session {request.session_id}")

        return GazeReportResponse(
            session_id=request.session_id,
            data=session_data,
            summary=summary,
            stats=stats,
            interpretation=interpretation
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating gaze report for session {request.session_id}: {str(e)}")
        return GazeReportResponse(
            session_id=request.session_id,
            data=[],
            summary="",
            stats="",
            interpretation="",
            error=str(e)
        )

@app.get("/debug/sessions")
async def list_sessions():
    """Debug endpoint to list all stored session IDs."""
    try:
        sessions = [f.replace(".json", "") for f in os.listdir(DATA_DIR) if f.endswith(".json")]
        logger.info(f"Listing sessions: {sessions}")
        return {"sessions": sessions}
    except Exception as e:
        logger.error(f"Error listing sessions: {str(e)}")
        return {"error": str(e), "sessions": []}

@app.on_event("startup")
async def startup_event():
    """Log startup and ensure data directory exists."""
    logger.info("Starting Eye Tracking API")
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        os.chmod(DATA_DIR, 0o777)  # Ensure directory is writable
        logger.info(f"Data directory {DATA_DIR} created or exists with correct permissions")
    except Exception as e:
        logger.error(f"Failed to create data directory {DATA_DIR}: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Release MediaPipe resources and clean up."""
    face_mesh.close()
    logger.info("MediaPipe resources released")
    for file in os.listdir(DATA_DIR):
        file_path = os.path.join(DATA_DIR, file)
        try:
            os.remove(file_path)
            logger.info(f"Cleaned up session file {file_path}")
        except Exception as e:
            logger.error(f"Failed to clean up {file_path}: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)