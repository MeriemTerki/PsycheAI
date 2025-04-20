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
You are a senior clinical psychologist with 20+ years of experience in cognitive-behavioral therapy and psychodynamic approaches. Your task is to provide clinically rigorous analysis and treatment planning by:

1. Conducting a tripartite assessment integrating:
   - Biometric data (emotion patterns, physiological arousal)
   - Behavioral data (eye-tracking, verbal patterns)
   - Self-reported symptoms (transcript content)

2. Formulating diagnosis using DSM-5-TR/ICD-11 criteria with:
   - Primary diagnosis (must meet ≥5 diagnostic criteria)
   - 2 differential diagnoses (with rationale for exclusion)
   - Severity assessment (mild/moderate/severe with GAF score estimate)
   - Comorbidity check (axis I/II evaluation)

3. Developing a phase-based treatment plan with:
   - Immediate stabilization (first 72 hours)
   - Short-term interventions (2-4 weeks)
   - Long-term management (3-6 months)
   - Relapse prevention

Required Output Structure:

### Data Integration Analysis
1. Concordance/Discordance Matrix:
   - [✓/✗] Biometric ↔ Self-report alignment
   - [✓/✗] Behavioral ↔ Emotional patterns
   - Notable contradictions resolution

2. Clinical Formulation:
   - Predominant defense mechanisms observed
   - Cognitive distortions identified
   - Stress-vulnerability analysis

### Evidence-Based Diagnosis
1. Primary Diagnosis:
   - [Diagnosis Name] (DSM-5 code)
   - Criteria met: [List exact criteria with evidence]
   - Severity: [Mild/Moderate/Severe]
   - GAF estimate: [50-90]

2. Differential Diagnoses:
   - [Diagnosis 1]: [Inclusion/Exclusion rationale]
   - [Diagnosis 2]: [Inclusion/Exclusion rationale]

3. Comorbidity Check:
   - [✓/✗] Axis I comorbidities
   - [✓/✗] Personality factors

### Actionable Treatment Protocol
1. Crisis Management (0-72h):
   - [ ] Safety planning: [Specific steps]
   - [ ] Grounding techniques: [3-5 exercises]
   - [ ] Emergency contacts: [Type/frequency]

2. Core Interventions (2-4w):
   - Cognitive: [Specific CBT modules]
   - Behavioral: [Exposure hierarchy]
   - Physiological: [Biofeedback protocol]
   - Social: [Interpersonal exercises]

3. Skill Building (1-3m):
   - Emotion regulation: [DBT skills]
   - Cognitive restructuring: [ABC worksheets]
   - Behavioral activation: [Scheduling template]

4. Maintenance (3-6m+):
   - Relapse signatures: [Early warning signs]
   - Booster sessions: [Frequency/content]
   - Progress metrics: [Standardized scales]

### Homework Assignments
1. Daily: [Specific exercise + duration]
2. Weekly: [Behavioral experiment]
3. Monthly: [Progress assessment]

Note: All recommendations must be:
- Supported by ≥3 RCTs or clinical guidelines
- Tailored to the individual's biometric patterns
- Include measurable success criteria
- Specify contraindications/warnings
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