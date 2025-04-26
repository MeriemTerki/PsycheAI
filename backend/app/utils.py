import os
from dotenv import load_dotenv
from langchain_community.embeddings import CohereEmbeddings
from pinecone import Pinecone

load_dotenv()

# Initialize embeddings and Pinecone
embeddings = CohereEmbeddings(
    cohere_api_key=os.getenv("COHERE_API_KEY"),
    model="embed-english-v2.0",
    user_agent="ai-agent"
)

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = "ai-agent"

SYSTEM_PROMPT = """
You are a compassionate and insightful AI mental health assistant. Your job is to analyze emotional data, eye-tracking reports, and conversation transcripts to form a preliminary diagnosis and suggest possible treatment strategies. Consider psychological best practices and personalized care.
"""

async def get_combined_context(emotion_report: str, eye_tracking: str, transcript: str, top_k: int = 3) -> str:
    try:
        combined_input = f"Emotional Report: {emotion_report}\n\nEye Tracking Report: {eye_tracking}\n\nTranscript: {transcript}"
        query_embedding = embeddings.embed_query(combined_input)

        index = pc.Index(index_name)
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )

        context = ""
        for match in results.matches:
            context += f"{match.metadata.get('text', '')}\n"

        return context.strip()
    except Exception as e:
        print(f"[Error] Failed to retrieve context: {e}")
        return ""

async def diagnose_and_treat(
    emotion_report: dict,
    eye_tracking_report: str,
    conversation_transcript: str,
    model='llama3-8b-8192',
    groq_client=None
) -> str:
    if not groq_client:
        print("[Error] groq_client is None.")
        return "groq_client is not provided."

    try:
        # Debug
        print("DIAGNOSE INPUT TYPES:", type(emotion_report), type(eye_tracking_report), type(conversation_transcript))

        # Format inputs
        emotion_summary = emotion_report.get("summary", "")
        emotion_stats = emotion_report.get("stats", "")
        emotion_interpretation = emotion_report.get("interpretation", "")

        eye_tracking = eye_tracking_report
        transcript = conversation_transcript

        user_data = f"{emotion_summary}\n\n{emotion_stats}\n\n{emotion_interpretation}\n\n{eye_tracking}\n\n{transcript}"
        context = await get_combined_context(emotion_summary, eye_tracking, transcript)

        prompt = SYSTEM_PROMPT + f"\n\nUse this context to generate a diagnostic and treatment plan:\n{context}"

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_data}
        ]

        res = groq_client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.7,
            max_tokens=300
        )

        return res.choices[0].message.content

    except Exception as e:
        print(f"[Error] Diagnosis failed: {e}")
        return "Sorry, I couldn't complete the diagnosis."