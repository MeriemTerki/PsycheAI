import asyncio
import requests
from app.rag_assistant import transcribe_audio, text_to_speech, SYSTEM_PROMPT, should_end_conversation
from rich.console import Console

console = Console()
API_URL = "http://localhost:8000/chat"

async def run_voice_client():
    system_message = {'role': 'system', 'content': SYSTEM_PROMPT}
    memory_size = 10
    messages = [system_message]

    console.print("\n[bold green]Voice Assistant Client Ready — Using API[/bold green]\n")

    while True:
        user_message = await transcribe_audio()
        if not user_message:
            console.print("Didn't catch that. Try again?", style="yellow")
            continue

        messages.append({'role': 'user', 'content': user_message})

        if should_end_conversation(user_message):
            goodbye_msg = "Goodbye! Take care."
            console.print(goodbye_msg, style="magenta")
            text_to_speech(goodbye_msg)
            break

        if len(messages) > memory_size:
            messages = [system_message] + messages[-(memory_size - 1):]

        try:
            response = requests.post(API_URL, json={"messages": messages})
            assistant_reply = response.json().get("reply", "Sorry, something went wrong.")
        except Exception as e:
            assistant_reply = f"API call failed: {e}"

        messages.append({'role': 'assistant', 'content': assistant_reply})
        console.print(f"[Assistant] {assistant_reply}", style="cyan")
        text_to_speech(assistant_reply)

if __name__ == "__main__":
    try:
        asyncio.run(run_voice_client())
    except KeyboardInterrupt:
        print("\n[red]Voice client stopped by user.[/red]")
