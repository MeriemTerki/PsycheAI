python -m venv venv
venv\Scripts\activate on Windows
pip install --upgrade pip
pip install -r requirements.txt

To chat with the chat agent  execute this command  from this path backend\voiceAgent  : python -m app.voice_agent

To run the api : uvicorn app.main:app --reload 

