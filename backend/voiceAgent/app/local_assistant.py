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
from app.config import settings

SYSTEM_PROMPT = """You are a helpful and enthusiastic assistant. Speak in a human, conversational tone.
Keep your answers as short and concise as possible, like in a conversation, ideally no more than 120 characters.
"""

# Improved TTS parameters for clearer speech
DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=linear16&sample_rate=24000'

console = Console()
groq = AsyncGroq(api_key=settings.GROQ_API_KEY)

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

async def assistant_chat(messages, model='llama3-8b-8192'):
    try:
        res = await groq.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.7,
            max_tokens=150
        )
        return res.choices[0].message.content
    except Exception as e:
        console.print(f"Error in assistant_chat: {e}", style="red")
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

def should_end_conversation(text):
    if not text:
        return False
    text = text.translate(str.maketrans('', '', string.punctuation))
    text = text.strip().lower()
    return re.search(r'\b(goodbye|bye|exit|quit)\b$', text) is not None

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

            if should_end_conversation(user_message):
                goodbye_msg = "Goodbye! Have a great day!"
                console.print(goodbye_msg, style="dark_orange")
                text_to_speech(goodbye_msg)
                break

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

def main():
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        console.print("\nVoice assistant stopped.", style="red")

if __name__ == "__main__":
    main()
