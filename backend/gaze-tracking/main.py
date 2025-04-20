from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import sys
import os

app = FastAPI()

# Allow frontend app to access this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update this to your frontend's domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_FILE = "eye_tracking_data_media.csv"

@app.post("/capture-eye-tracking")
async def capture_eye_tracking():
    try:
        # Run the eye tracking script
        subprocess.run([sys.executable, "eye_tracking.py"], check=True)
        return {"message": "✅ Eye tracking data captured successfully."}
    except subprocess.CalledProcessError as e:
        return {
            "error": f"❌ Error running eye tracking script: {e.stderr if e.stderr else str(e)}"
        }

@app.get("/generate-eye-tracking-report")
async def generate_report():
    if not os.path.exists(CSV_FILE):
        return {"error": "❌ CSV file not found. Run /capture-eye-tracking first."}

    try:
        # Run the async report script
        result = subprocess.run([sys.executable, "report.py"], capture_output=True, text=True, check=True)
        output = result.stdout.strip()
        return { "report": output}
    except subprocess.CalledProcessError as e:
        return {
            "error": f"❌ Report generation failed.",
            "details": e.stderr if e.stderr else str(e)
        }
    except Exception as e:
        return {"error": f"❌ Unexpected error: {str(e)}"}
