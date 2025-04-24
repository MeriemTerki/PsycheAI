import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import VideoPreview from "./diagnosis/VideoPreview";
import ConversationDisplay from "./diagnosis/ConversationDisplay";
import SessionControls from "./diagnosis/SessionControls";
import DiagnosisResults from "./DiagnosisResults";

interface Message {
  sender: "ai" | "user";
  text: string;
  timestamp: Date;
}

interface APIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface SessionResults {
  session_id: string;
  gaze_tracking: { report?: string; error?: string };
  emotion_recognition: {
    session_id?: string;
    summary?: string;
    stats?: string;
    interpretation?: string;
    error?: string;
  };
  voice_chat: { reply?: string; error?: string };
  transcript: string;
  final_report: { report: string; timestamp: string };
}

const SYSTEM_PROMPT = `You are a compassionate mental health assistant. Engage in a conversational assessment to evaluate the user's mental wellbeing by asking empathetic questions and responding to their answers. Ask one question at a time, wait for the response, and tailor follow-up questions based on their input. Avoid clinical diagnoses and provide supportive responses.`;

const DiagnosisSection: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [sessionEnded, setSessionEnded] = useState<boolean>(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const webcamRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const transcriptLogRef = useRef<string[]>([]);
  const messagesRef = useRef<APIMessage[]>([{ role: "system", content: SYSTEM_PROMPT }]);
  const lastAIMessageRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isRecordingRef = useRef(isRecording);
  const sessionEndedRef = useRef(sessionEnded);
  const isSpeakingRef = useRef(isSpeaking);
  // prevent processing the same transcript multiple times
  const lastTranscriptRef = useRef<string>("");


  // Scroll chat to bottom
  const scrollToBottom = () => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  };
  useEffect(scrollToBottom, [conversation]);

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { sessionEndedRef.current = sessionEnded; }, [sessionEnded]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // === New: playBackendTTS ===
  const playBackendTTS = async (text: string) => {
  console.log("[TTS] playBackendTTS()", { text });
  try {
    setIsSpeaking(true);

    // 1️⃣ Always stop recognition before playback
    if (recognitionRef.current) {
      console.log("[TTS] stopping recognition before playback");
      recognitionRef.current.stop();
    }

    // 2️⃣ Fetch the WAV from your backend
    const res = await fetch("http://127.0.0.1:8002/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    // 3️⃣ Play the audio and only resolve when it ends
    await new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = () => {
        console.log("[TTS] playback ended");
        setIsSpeaking(false);

        // 4️⃣ Restart recognition now that TTS is done
        if (
          recognitionRef.current &&
          isRecordingRef.current &&
          !sessionEndedRef.current
        ) {
          console.log("[TTS] restarting recognition after playback");
          recognitionRef.current.start();
        }
        resolve();
      };
      audio.onerror = (e) => {
        console.error("[TTS] audio playback error", e);
        setError("Audio playback failed. See console for details.");
        setIsSpeaking(false);
        reject(e);
      };

      console.log("[TTS] starting playback");
      audio.play().catch(reject);
    });
  } catch (err: any) {
    console.error("[TTS] error:", err);
    setError("Audio playback failed. See console for details.");
    setIsSpeaking(false);
  }
};


  // === Frame sending to gaze & emotion services ===
  const sendFrameToBackend = async () => {
    if (!webcamRef.current || !canvasRef.current || !isRecording || sessionEnded) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(webcamRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const frame = canvasRef.current.toDataURL("image/jpeg", 0.8);
    const payload = { frame, session_id: sessionIdRef.current };

    try {
      await Promise.all([
        fetch("http://127.0.0.1:8001/capture-eye-tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        fetch("http://127.0.0.1:8000/analyze-live-emotion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      ]);
    } catch (err) {
      console.error("Frame send error:", err);
    }
    console.log("[Frame] Sending frame to backend", sessionIdRef.current);

  };
  useEffect(() => {
    if (isRecording && !sessionEnded) {
      sessionIdRef.current = new Date().toISOString();
      frameIntervalRef.current = setInterval(sendFrameToBackend, 1000);
    }
    return () => {
      frameIntervalRef.current && clearInterval(frameIntervalRef.current);
    };
  }, [isRecording, sessionEnded]);

  // === Speech recognition setup ===
 // inside your component, after you’ve declared isRecordingRef, sessionEndedRef, isSpeakingRef…

useEffect(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error("[SpeechRec] not supported");
    setError("Speech recognition not supported. Please use Chrome.");
    return;
  }

  console.log("[SpeechRec] initializing once");
  const rec = new SpeechRecognition();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = "en-US";

  rec.onstart = () => {
    console.log("[SpeechRec] onstart");
    setIsListening(true);
  };

  rec.onend = () => {
    console.log("[SpeechRec] onend");
    setIsListening(false);
    // if still recording and not speaking, restart
    if (isRecordingRef.current && !isSpeakingRef.current) {
      console.log("[SpeechRec] restarting on end");
      rec.start();
    }
  };

  rec.onerror = (e: any) => {
    console.error("[SpeechRec] onerror:", e.error);
    setIsListening(false);
    // on no-speech error, restart if session still active
    if (
      e.error === "no-speech" &&
      isRecordingRef.current &&
      !isSpeakingRef.current
    ) {
      console.log("[SpeechRec] restarting on no-speech");
      rec.start();
    }
  };

  rec.onresult = (e: SpeechRecognitionEvent) => {
  console.log("[SpeechRec] onresult event");
  const transcript = e.results[e.results.length - 1][0].transcript.trim();
  console.log("[SpeechRec] raw transcript:", transcript);

  // dedupe: skip if same as last result
  if (transcript === lastTranscriptRef.current) {
    console.log("[SpeechRec] duplicate transcript, ignoring");
    return;
  }
  lastTranscriptRef.current = transcript;

  // guard with your ref‐state
  if (
    !isRecordingRef.current ||
    sessionEndedRef.current ||
    isSpeakingRef.current
  ) {
    console.log("[SpeechRec] ignoring result (state)", {
      isRecording: isRecordingRef.current,
      sessionEnded: sessionEndedRef.current,
      isSpeaking: isSpeakingRef.current,
    });
    return;
  }

  // ignore echoes of AI’s last line
  if (
    lastAIMessageRef.current &&
    transcript
      .toLowerCase()
      .includes(lastAIMessageRef.current.slice(0, 20).toLowerCase())
  ) {
    console.log("[SpeechRec] ignored AI echo");
    return;
  }

  // finally, dispatch to your handler
  console.log("[SpeechRec] dispatching to handleUserMessage()");
  handleUserMessage(transcript);
};


  recognitionRef.current = rec;
  // start listening immediately once mounted
  rec.start();

  return () => {
    console.log("[SpeechRec] cleanup on unmount");
    rec.stop();
  };
}, []);

  const startSession = async () => {
    setError(null);
    try {
      // start media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (webcamRef.current) webcamRef.current.srcObject = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.start();

      setIsRecording(true);
      setSessionEnded(false);
      transcriptLogRef.current = [];
      messagesRef.current = [{ role: "system", content: SYSTEM_PROMPT }];

      // Initial AI prompt
      const initial = "Hello… How are you feeling today?";
    setConversation([{ sender: "ai", text: initial, timestamp: new Date() }]);
    messagesRef.current.push({ role: "assistant", content: initial });
    lastAIMessageRef.current = initial;

    // Play it, then *immediately* start recognition
    await playBackendTTS(initial);
    console.log("[Session] initial TTS done, starting recognition");
    // recognitionRef.current?.start();
  } catch (err: any) {
    console.error("[Session] startSession error:", err);
    setError(err.message);
    endSession(false);
  }
  };

  const handleUserMessage = async (userMessage: string) => {
  console.log("[App] handleUserMessage() got:", userMessage);
  if (!isRecordingRef.current || sessionEndedRef.current) {
    console.log("[App] handleUserMessage() ignoring (state)", {
      isRecording: isRecordingRef.current,
      sessionEnded: sessionEndedRef.current,
    });
    return;
  }

  setConversation((c) => [...c, { sender: "user", text: userMessage, timestamp: new Date() }]);
  transcriptLogRef.current.push(`User: ${userMessage}`);
  messagesRef.current.push({ role: "user", content: userMessage });

  // guard for exit keywords
  if (/goodbye|end|stop/i.test(userMessage)) {
    console.log("[App] handleUserMessage() detected end keyword");
    /* your existing bye logic… */
    return await endSession(false);
  }

  // Call chat API
  try {
    console.log("[App] sending /chat with payload:", messagesRef.current);
    setIsLoading(true);

    const res = await fetch("http://127.0.0.1:8002/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messagesRef.current }),
    });

    console.log("[App] /chat response status:", res.status);
    const data = await res.json();
    console.log("[App] /chat response data:", data);

    if (!res.ok) {
      throw new Error(data.detail || "unknown error");
    }

    const assistantReply = data.reply;
    console.log("[App] assistantReply:", assistantReply);

    setConversation((c) => [...c, { sender: "ai", text: assistantReply, timestamp: new Date() }]);
    transcriptLogRef.current.push(`Assistant: ${assistantReply}`);
    messagesRef.current.push({ role: "assistant", content: assistantReply });
    lastAIMessageRef.current = assistantReply;

    // play and auto‐restart recognition
    await playBackendTTS(assistantReply);
  } catch (err: any) {
    console.error("[App] handleUserMessage() error:", err);
    setError(`AI service error: ${err.message}`);
  } finally {
    setIsLoading(false);
  }
};


  const endSession = async (isManual: boolean = false) => {
    // stop everything
    mediaRecorderRef.current?.state !== "inactive" && mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recognitionRef.current?.stop();
    frameIntervalRef.current && clearInterval(frameIntervalRef.current);

    setIsRecording(false);
    setSessionEnded(true);

    // upload transcript if manual
    if (isManual && transcriptLogRef.current.length) {
      try {
        await fetch("http://127.0.0.1:8002/upload_transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptLogRef.current.join("\n") }),
        });
      } catch (err) {
        console.error("Upload transcript error:", err);
      }
    }

    // request final report
    if (isManual) {
      setIsLoading(true);
      try {
        const res = await fetch("http://127.0.0.1:8003/start-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesRef.current.slice(0, 5),
            is_post_session: true,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data: SessionResults = await res.json();
        setSessionResults(data);
      } catch (err: any) {
        console.error("Final report error:", err);
        setError("Failed to generate final report.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const saveTranscript = () => {
    const text = conversation
      .map((m) => `[${m.timestamp.toLocaleTimeString()}] ${m.sender === "ai" ? "AI" : "You"}: ${m.text}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <section id="diagnosis" className="py-24 bg-gradient-to-b from-white to-psyche-gray-light">
      <div className="container mx-auto px-4">
        {/* ... header ... */}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left panel */}
          <div className="lg:col-span-2 flex flex-col">
            <Card className="flex-1">
              <CardContent className="p-0 relative h-full flex flex-col">
                <VideoPreview
                  isRecording={isRecording}
                  sessionEnded={sessionEnded}
                  webcamRef={webcamRef}
                />
                <canvas
                  ref={canvasRef}
                  width="640"
                  height="480"
                  style={{ display: "none" }}
                />
              </CardContent>
            </Card>
            <SessionControls
              isRecording={isRecording}
              sessionEnded={sessionEnded}
              onStartSession={startSession}
              onEndSession={() => endSession(true)}
              isLoading={isLoading}
            />
          </div>

          {/* Conversation panel */}
          <div className="lg:col-span-3 flex flex-col">
            {/* status bar */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-medium">Live Conversation</h3>
              {/* ... badge logic ... */}
            </div>
            <Card className="flex-1">
              <CardContent className="p-0 h-full">
                <ConversationDisplay
                  conversation={conversation}
                  conversationRef={conversationRef}
                  isRecording={isRecording}
                />
              </CardContent>
            </Card>
            {error && (
              <div className="mt-4 p-4 bg-red-100 text-red-800 rounded">
                {error}
              </div>
            )}
          </div>

          {/* Results panel */}
          {sessionEnded && sessionResults && (
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-4xl">
                <DiagnosisResults
                  isVisible={sessionEnded}
                  conversation={conversation}
                  sessionResults={sessionResults}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DiagnosisSection;
