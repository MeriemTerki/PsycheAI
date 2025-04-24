import datetime
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import sys
import os
import cv2
import numpy as np
import base64

logger = logging.getLogger("gaze-api")
logging.basicConfig(level=logging.INFO)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_FILE = "eye_tracking_data_media.csv"

class VideoFrame(BaseModel):
    frame: str  # Base64-encoded frame
    session_id: str

def process_frame_for_gaze(frame: np.ndarray, session_id: str) -> dict:
    """
    Placeholder for gaze tracking logic (adapt from eye_tracking.py).
    """
    try:
        logger.info(f"[{session_id}] Processing frame, shape: {frame.shape}")
        # Save frame for debugging
        debug_path = f"debug_gaze_frame_{session_id}.jpg"
        cv2.imwrite(debug_path, frame)
        logger.info(f"[{session_id}] Saved debug frame to {debug_path}")

        # Placeholder logic (replace with eye_tracking.py)
        gaze_points = []
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        gaze_data = {
            "timestamp": timestamp,
            "session_id": session_id,
            "gaze_points": gaze_points
        }
        # Append to CSV
        if not os.path.exists(CSV_FILE):
            with open(CSV_FILE, "w") as f:
                f.write("timestamp,session_id,gaze_points\n")
        with open(CSV_FILE, "a") as f:
            f.write(f"{timestamp},{session_id},{gaze_points}\n")
        return gaze_data
    except Exception as e:
        logger.error(f"[{session_id}] Error processing frame: {str(e)}")
        raise

@app.post("/capture-eye-tracking")
async def capture_eye_tracking(video_frame: VideoFrame):
    session_id = video_frame.session_id or datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    try:
        logger.info(f"[{session_id}] Received /capture-eye-tracking request")
        # Decode base64 frame
        frame_data = base64.b64decode(video_frame.frame.split(",")[1])
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            logger.error(f"[{session_id}] Failed to decode frame")
            raise ValueError("Failed to decode frame")

        # Process frame
        gaze_data = process_frame_for_gaze(frame, session_id)
        logger.info(f"[{session_id}] Eye tracking completed")
        return {
            "message": "✅ Eye tracking data captured",
            "session_id": session_id,
            "gaze_points": gaze_data["gaze_points"]
        }
    except Exception as e:
        logger.error(f"[{session_id}] Eye tracking failed: {str(e)}")
        raise HTTPException(status_code=500, detail={
            "error": "Capture failed",
            "details": str(e),
            "session_id": session_id
        })

@app.get("/generate-eye-tracking-report")
async def generate_report():
    if not os.path.exists(CSV_FILE):
        return {"error": "❌ CSV file not found. Run /capture-eye-tracking first."}

    try:
        result = subprocess.run(
            [sys.executable, "report.py"],
            capture_output=True,
            text=True,
            check=True
        )
        output = result.stdout.strip()
        return {"report": output}
    except subprocess.CalledProcessError as e:
        return {
            "error": "❌ Report generation failed.",
            "details": e.stderr if e.stderr else str(e)
        }
    except Exception as e:
        return {"error": f"❌ Unexpected error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)