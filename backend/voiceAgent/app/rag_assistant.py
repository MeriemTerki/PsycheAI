import re
import string
import asyncio
import requests
import wave
import io
import pyaudio
from groq import AsyncGroq
from deepgram import (
    DeepgramClient, DeepgramClientOptions, LiveTranscriptionEvents, LiveOptions, Microphone
)
from rich.console import Console
from .config import settings
from pinecone import Pinecone, ServerlessSpec
from langchain_community.embeddings import CohereEmbeddings
import os
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

SYSTEM_PROMPT = """You are a compassionate, professional mental health assistant. Your role is to:

1. **Response Format**:
   - Use plain, natural language without any special symbols
   - Do not use asterisks (*), plus signs (+), or bullet points
   - Write responses as clear, simple sentences
   - Avoid any markdown or formatting symbols

2. **Listen and Respond Precisely**:
   - Only respond to what the user explicitly shares
   - Never make assumptions about their situation
   - Don't add or infer details that weren't mentioned
   - If context is needed, ask for clarification instead of assuming

3. **Structure Your Responses**:
   - Start with a brief acknowledgment
   - Then provide a clear, direct response
   - End with a specific suggestion or question
   - Keep everything in plain text format

4. **Safety Guidelines**:
   - For crisis situations, say plainly:
     "I'm concerned about your safety. Please contact emergency services or a crisis hotline immediately."
   - For complex issues, say:
     "This sounds challenging. A mental health professional could provide the support you need."

5. **Use Evidence-Based Approaches**:
   - Only use techniques from provided context
   - When uncertain, focus on active listening
   - Validate emotions without making interpretations
   - Use clear, simple language without special formatting

Example responses:
User: "I'm feeling stressed about my work."
Response: "I understand you're feeling stressed about your work. Would you like to try a quick breathing exercise to help manage that stress?"

User: "I'm anxious about my upcoming presentation."
Response: "It's natural to feel anxious about presentations. Would you like to explore some specific techniques for presentation anxiety?"

Context to use (if available):
{context}
"""

# Improved TTS parameters for clearer speech
DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&sample_rate=24000'

console = Console()
groq = AsyncGroq(api_key=settings.GROQ_API_KEY)

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = "ai-agent"  # Replace with your index name

# Initialize Cohere embeddings
embeddings = CohereEmbeddings(
    cohere_api_key=os.getenv("COHERE_API_KEY"),
    model="embed-english-v2.0",
    user_agent="ai-agent"
)

# Create the Deepgram client with proper configuration
deepgram_config = DeepgramClientOptions(
    options={
        'keepalive': 'true',
        'timeout': '5000'
    }
)
deepgram = DeepgramClient(settings.DEEPGRAM_API_KEY, config=deepgram_config)

# Configure Deepgram options for live transcription
dg_connection_options = LiveOptions(
    model='nova-2',
    language='en-US',
    smart_format=True,
    encoding='linear16',
    channels=1,
    sample_rate=16000,
    interim_results=True,
    utterance_end_ms='1500',
    vad_events=True,
    endpointing=500,
)

async def get_relevant_context(query: str, top_k: int = 3) -> str:
    """
    Retrieve relevant context from Pinecone based on the user query using Cohere embeddings.
    """
    try:
        # Generate embedding for the query using Cohere
        query_embedding = embeddings.embed_query(query)
        
        # Query Pinecone index
        index = pc.Index(index_name)
        results = index.query(
            vector=query_embedding,
            top_k=top_k,
            include_metadata=True
        )
        
        # Extract and format the context
        context = ""
        for match in results.matches:
            context += f"{match.metadata.get('text', '')}\n"
        
        return context.strip()
    
    except Exception as e:
        console.print(f"Error retrieving context: {e}", style="red")
        return ""

async def assistant_chat(messages, model='llama3-8b-8192', min_duration=3):
    try:
        start_time = datetime.now()
        user_query = messages[-1]['content'] if messages[-1]['role'] == 'user' else ""
        
        if (len(user_query.split()) > 3 and 
            not any(word in user_query.lower() for word in ['hi', 'hello', 'hey', 'bye', 'thanks'])):
            
            context = await get_relevant_context(user_query)
            if context:
                rag_system_prompt = SYSTEM_PROMPT + f"\n\nUse this context to answer the question:\n{context}"
                messages_with_context = [
                    {'role': 'system', 'content': rag_system_prompt},
                    *messages[1:]
                ]
                
                res = await groq.chat.completions.create(
                    messages=messages_with_context,
                    model=model,
                    temperature=0.7,
                    max_tokens=150
                )
                response = res.choices[0].message.content
            else:
                res = await groq.chat.completions.create(
                    messages=messages,
                    model=model,
                    temperature=0.7,
                    max_tokens=150
                )
                response = res.choices[0].message.content
        else:
            res = await groq.chat.completions.create(
                messages=messages,
                model=model,
                temperature=0.7,
                max_tokens=150
            )
            response = res.choices[0].message.content
        
        # Clean up the response
        cleaned_response = (response
            .replace('*', '')  # Remove asterisks
            .replace('+', '')  # Remove plus signs
            .replace('•', '')  # Remove bullet points
            .replace('-', '')  # Remove hyphens
            .replace('_', '')  # Remove underscores
            .replace('#', '')  # Remove hash symbols
            .replace('`', '')  # Remove backticks
            .strip())         # Remove extra whitespace
        
        # Ensure proper sentence spacing
        cleaned_response = re.sub(r'\s+', ' ', cleaned_response)  # Replace multiple spaces with single space
        cleaned_response = re.sub(r'\s*\.\s*', '. ', cleaned_response)  # Ensure proper spacing after periods
        cleaned_response = re.sub(r'\s*\?\s*', '? ', cleaned_response)  # Ensure proper spacing after question marks
        cleaned_response = re.sub(r'\s*!\s*', '! ', cleaned_response)  # Ensure proper spacing after exclamation marks
        
        # Ensure minimum duration
        elapsed = (datetime.now() - start_time).total_seconds()
        if elapsed < min_duration:
            await asyncio.sleep(min_duration - elapsed)
        
        console.print(f"[{datetime.now().isoformat()}] Assistant chat completed in {elapsed:.2f} seconds", style="green")
        return cleaned_response
    
    except Exception as e:
        console.print(f"[{datetime.now().isoformat()}] Error in assistant_chat: {e}", style="red")
        return "Sorry, I encountered an error. Could you please repeat that?"

async def transcribe_audio():
    transcript_parts = []
    full_transcript = ''
    transcription_complete = asyncio.Event()
    
    try:
        dg_connection = deepgram.listen.asynclive.v('1')

        async def on_message(self, result, **kwargs):
            nonlocal transcript_parts, full_transcript
            sentence = result.channel.alternatives[0].transcript
            if len(sentence) == 0:
                return
            if result.is_final:
                transcript_parts.append(sentence)
                console.print(sentence, style='cyan')
                if result.speech_final:
                    full_transcript = ' '.join(transcript_parts)
                    transcription_complete.set()
            else:
                console.print(sentence, style='cyan', end='\r')
        
        async def on_utterance_end(self, utterance_end, **kwargs):
            nonlocal transcript_parts, full_transcript
            if len(transcript_parts) > 0:
                full_transcript = ' '.join(transcript_parts)
                transcription_complete.set()
        
        async def on_error(self, error, **kwargs):
            console.print(f'Error: {error}', style='red')
            transcription_complete.set()  # Ensure we don't hang on error
        
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)

        if await dg_connection.start(dg_connection_options) is False:
            console.print('Failed to connect to Deepgram')
            return None
        
        microphone = Microphone(dg_connection.send)
        microphone.start()
        console.print('\nListening...\n')

        await transcription_complete.wait()
        
        microphone.finish()
        await dg_connection.finish()
        
        if not full_transcript:
            return None
        return full_transcript.strip()
    
    except Exception as e:
        console.print(f'Could not open socket: {e}')
        return None

def text_to_speech(text):
    try:
        headers = {
            'Authorization': f'Token {settings.DEEPGRAM_API_KEY}',
            'Content-Type': 'application/json'
        }

        formatted_text = text.replace('.', '. ').replace('?', '? ').replace('!', '! ')

        res = requests.post(
            DEEPGRAM_TTS_URL,
            headers=headers,
            json={'text': formatted_text},
            stream=True,
            timeout=15
        )

        if res.status_code != 200:
            console.print(f"TTS API error: {res.status_code} - {res.text}", style="red")
            return

        audio_buffer = io.BytesIO(res.content)

        with wave.open(audio_buffer, 'rb') as wf:
            p = pyaudio.PyAudio()

            try:
                stream = p.open(
                    format=p.get_format_from_width(wf.getsampwidth()),
                    channels=wf.getnchannels(),
                    rate=wf.getframerate(),
                    output=True
                )

                data = wf.readframes(4096)
                while data:
                    stream.write(data)
                    data = wf.readframes(4096)

                stream.stop_stream()
                stream.close()
            except Exception as e:
                console.print(f"Audio playback error: {e}", style="red")
            finally:
                p.terminate()

    except Exception as e:
        console.print(f"Error in text_to_speech: {e}", style="red")

async def run():
    system_message = {'role': 'system', 'content': SYSTEM_PROMPT}
    memory_size = 10
    messages = [system_message]
    
    console.print("\n[bold green]Voice Assistant Ready![/bold green]\n")
    
    while True:
        try:
            user_message = await transcribe_audio()
            if not user_message:
                console.print("Couldn't understand that. Please try again.", style="yellow")
                continue
                
            messages.append({'role': 'user', 'content': user_message})

            if len(messages) > memory_size:
                messages = [system_message] + messages[-(memory_size-1):]

            assistant_message = await assistant_chat(messages)
            messages.append({'role': 'assistant', 'content': assistant_message})
            console.print(f"Assistant: {assistant_message}", style="dark_orange")
            text_to_speech(assistant_message)
            
        except KeyboardInterrupt:
            console.print("\nExiting...", style="red")
            break
        except Exception as e:
            console.print(f"Unexpected error: {e}", style="red")
            continue

def generate_tts_bytes(text: str) -> bytes:
    """
    Call Deepgram TTS and return raw WAV audio bytes.
    """
    headers = {
        'Authorization': f'Token {settings.DEEPGRAM_API_KEY}',
        'Content-Type': 'application/json'
    }
    # ensure proper spacing
    formatted = text.replace('.', '. ').replace('?', '? ').replace('!', '! ')
    res = requests.post(
        DEEPGRAM_TTS_URL,
        headers=headers,
        json={'text': formatted},
        stream=True,
        timeout=15
    )
    if res.status_code != 200:
        raise RuntimeError(f"TTS API error {res.status_code}: {res.text}")
    return res.content

def main():
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        console.print("\nVoice assistant stopped.", style="red")

if __name__ == "__main__":
    main()