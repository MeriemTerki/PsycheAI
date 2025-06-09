# LLM-Powered Voice-Driven Mental Wellness Assessment with Gaze and Emotion Analysis

This project is an AI-powered mental wellness assessment system that integrates voice conversation analysis with real-time gaze tracking and emotion recognition to provide a comprehensive mental health assessment report.

## Features

- **Conversational AI Assessment**: Engages users in empathetic conversations to evaluate mental well-being.
- **Real-time Gaze Tracking**: Analyzes eye movements to infer attention, focus, and cognitive states.
- **Real-time Emotion Recognition**: Detects and interprets facial expressions to understand emotional states.
- **Comprehensive Assessment Reports**: Generates detailed reports synthesizing data from voice, gaze, and emotion analysis, including personalized recommendations.
- **Supportive and Empathetic AI**: Designed to be a compassionate mental health assistant, avoiding clinical diagnoses.

### APIs
- **Gaze Tracking Service**: Handles real-time eye tracking analysis (e.g., `http://127.0.0.1:8001`).
- **Emotion Recognition Service**: Processes facial expressions for emotion detection (e.g., `http://127.0.0.1:8000`).
- **Voice Chat/TTS Service**: Manages AI conversation and text-to-speech (e.g., `http://127.0.0.1:8002`).

## Setup and Installation

### Prerequisites
- Node.js (with npm or yarn)
- Python 3.9+
- Pip (Python package installer)

### 1. Clone the repository
```bash
git clone <repository_url>
cd ai-mental-health-therapist-app
```

### 2. Backend Setup
Navigate to the `backend` directory:
```bash
cd backend
```
Install Python dependencies:
```bash
pip install -r requirements.txt
```
Create a `.env` file in the `backend/app` directory with the following :
```
GROQ_API_KEY="your_groq_api_key_here"
DEEPGRAM_API_KEY="your_deepgram_api_key_here"
PINECONE_API_KEY="your_pinecone_api_key_here"
PINECONE_INDEX_NAME=ai-agent
COHERE_API_KEY="your_cohere_api_key_here"
GAZE_CAPTURE_URL=http://127.0.0.1:8001/capture-eye-tracking
GAZE_REPORT_URL=http://127.0.0.1:8001/generate-eye-tracking-report
EMOTION_API_URL=http://127.0.0.1:8000/analyze-live-emotion
CHAT_API_URL=http://127.0.0.1:8002/chat
TRANSCRIPT_GET_URL=http://127.0.0.1:8002/transcript
SESSION_API_URL=http://127.0.0.1:8003/start-session
REPORT_GET_URL=http://127.0.0.1:8003/get-report
```
You might also need to configure the URLs for the microservices in the `.env` file if they are not running on the default ports:
```
GAZE_CAPTURE_URL="http://localhost:8001/capture-eye-tracking"
GAZE_REPORT_URL="http://localhost:8001/generate-eye-tracking-report"
EMOTION_API_URL="http://127.0.0.1:8000/analyze-live-emotion"
CHAT_API_URL="http://127.0.0.1:8002/chat"
TRANSCRIPT_GET_URL="http://127.0.0.1:8002/transcript"
```
Run the FastAPI backend:
```bash
uvicorn app.main:app --reload --port 8003
```
(Ensure your gaze tracking, emotion recognition, and voice chat/TTS microservices are also running on their respective ports, e.g., 8000, 8001, 8002.)

### 3. Frontend Setup
Open a new terminal, navigate to the `frontend` directory:
```bash
cd ../frontend
```
Install Node.js dependencies:
```bash
npm install
# or yarn install
```
Start the React development server:
```bash
npm start
# or yarn start
```
The frontend application should open in your browser at `http://localhost:3000`.

## Usage
1. Ensure all backend services (main API, gaze, emotion, voice chat) are running.
2. Open the frontend application in your browser.
3. Click "Start Assessment" to begin the AI-guided conversation.
4. Allow webcam and microphone access when prompted.
5. Engage in conversation with the AI assistant.
6. Click "End Session" to generate the comprehensive report.

## Demo Video

[Link to Demo Video Here](https://www.youtube.com/watch?v=C7LdxG9kUxw)

## Contact

For any questions or issues, please open an issue in the repository.
