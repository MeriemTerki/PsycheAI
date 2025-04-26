import { useState, useRef, useEffect } from "react";
import Webcam from "react-webcam";
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

interface GazeTrackingResult {
  session_id?: string;
  timestamp?: string;
  eye_count?: number;
  gaze_points?: { x: number; y: number }[];
  error?: string;
  details?: string;
  data?: any;
}

interface EmotionRecognitionResult {
  session_id?: string;
  summary?: string;
  stats?: string;
  interpretation?: string;
  error?: string;
  details?: string;
  data?: any;
}

interface SessionResults {
  session_id: string;
  gaze_tracking: GazeTrackingResult;
  emotion_recognition: EmotionRecognitionResult;
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
  const [gazeResults, setGazeResults] = useState<GazeTrackingResult[]>([]);
  const [emotionResults, setEmotionResults] = useState<EmotionRecognitionResult[]>([]);

  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null); // Changed to any to handle browser-specific implementations
  const conversationRef = useRef<HTMLDivElement>(null);
  const transcriptLogRef = useRef<string[]>([]);
  const messagesRef = useRef<APIMessage[]>([{ role: "system", content: SYSTEM_PROMPT }]);
  const lastAIMessageRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isRecordingRef = useRef(isRecording);
  const sessionEndedRef = useRef(sessionEnded);
  const isSpeakingRef = useRef(isSpeaking);
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

  const playBackendTTS = async (text: string) => {
    console.log("[TTS] playBackendTTS()", { text });
    try {
      setIsSpeaking(true);

      if (recognitionRef.current) {
        console.log("[TTS] stopping recognition before playback");
        recognitionRef.current.stop();
      }

      const res = await fetch("http://127.0.0.1:8002/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const audio = new Audio(url);
        audio.onended = () => {
          console.log("[TTS] playback ended");
          setIsSpeaking(false);

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

  const sendFrameToBackend = async () => {
    if (!webcamRef.current || !canvasRef.current || !isRecording || sessionEnded) return;

    try {
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx || !webcamRef.current.video) return;

      canvasRef.current.width = webcamRef.current.video.videoWidth;
      canvasRef.current.height = webcamRef.current.video.videoHeight;
      ctx.drawImage(webcamRef.current.video, 0, 0, canvasRef.current.width, canvasRef.current.height);
      const frame = canvasRef.current.toDataURL("image/jpeg", 0.8);
      const payload = { frame, session_id: sessionIdRef.current };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const [gazeRes, emotionRes] = await Promise.allSettled([
        fetch("http://127.0.0.1:8001/capture-eye-tracking", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }),
        fetch("http://127.0.0.1:8000/analyze-live-emotion", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      if (gazeRes.status === "fulfilled" && gazeRes.value.ok) {
        const gazeData = await gazeRes.value.json();
        setGazeResults((prev) => [...prev, gazeData]);
      } else {
        const error = gazeRes.status === "rejected" ? gazeRes.reason : await gazeRes.value.text();
        console.error("Gaze tracking error:", error);
        setGazeResults((prev) => [
          ...prev,
          {
            error: "Gaze tracking failed",
            details: typeof error === "string" ? error : "Unknown error",
            session_id: sessionIdRef.current,
          },
        ]);
      }

      if (emotionRes.status === "fulfilled" && emotionRes.value.ok) {
        const emotionData = await emotionRes.value.json();
        setEmotionResults((prev) => [...prev, emotionData]);
      } else {
        const error = emotionRes.status === "rejected" ? gazeRes.reason : await emotionRes.value.text();
        console.error("Emotion recognition error:", error);
        setEmotionResults((prev) => [
          ...prev,
          {
            error: "Emotion recognition failed",
            details: typeof error === "string" ? error : "Unknown error",
            session_id: sessionIdRef.current,
          },
        ]);
      }
    } catch (err: any) {
      console.error("Frame processing error:", err);
      setError(`Error processing frame: ${err.message}`);
    }
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

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
      if (isRecordingRef.current && !isSpeakingRef.current) {
        console.log("[SpeechRec] restarting on end");
        rec.start();
      }
    };

    rec.onerror = (e: any) => {
      console.error("[SpeechRec] onerror:", e.error);
      setIsListening(false);
      if (
        e.error === "no-speech" &&
        isRecordingRef.current &&
        !isSpeakingRef.current
      ) {
        console.log("[SpeechRec] restarting on no-speech");
        rec.start();
      }
    };

    rec.onresult = (e: any) => {
      console.log("[SpeechRec] onresult event");
      const transcript = e.results[e.results.length - 1][0].transcript.trim();
      console.log("[SpeechRec] raw transcript:", transcript);

      if (transcript === lastTranscriptRef.current) {
        console.log("[SpeechRec] duplicate transcript, ignoring");
        return;
      }
      lastTranscriptRef.current = transcript;

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

      if (
        lastAIMessageRef.current &&
        transcript
          .toLowerCase()
          .includes(lastAIMessageRef.current.slice(0, 20).toLowerCase())
      ) {
        console.log("[SpeechRec] ignored AI echo");
        return;
      }

      console.log("[SpeechRec] dispatching to handleUserMessage()");
      handleUserMessage(transcript);
    };

    recognitionRef.current = rec;
    rec.start();

    return () => {
      console.log("[SpeechRec] cleanup on unmount");
      rec.stop();
    };
  }, []);

  const startSession = async () => {
    setError(null);
    setGazeResults([]);
    setEmotionResults([]);
    setIsRecording(true);
    setSessionEnded(false);
    transcriptLogRef.current = [];
    messagesRef.current = [{ role: "system", content: SYSTEM_PROMPT }];

    const initial = "Hello… How are you feeling today?";
    setConversation([{ sender: "ai", text: initial, timestamp: new Date() }]);
    messagesRef.current.push({ role: "assistant", content: initial });
    lastAIMessageRef.current = initial;

    await playBackendTTS(initial);
    console.log("[Session] initial TTS done, starting recognition");
    if (recognitionRef.current) {
      recognitionRef.current.start();
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

      await playBackendTTS(assistantReply);
    } catch (err: any) {
      console.error("[App] handleUserMessage() error:", err);
      setError(`AI service error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const aggregateResults = (): SessionResults => {
    const lastGaze = [...gazeResults].reverse().find((r) => !r.error) || {
      error: "No valid gaze data collected",
    };
    const lastEmotion = [...emotionResults].reverse().find((r) => !r.error) || {
      error: "No valid emotion data collected",
    };

    return {
      session_id: sessionIdRef.current,
      gaze_tracking: lastGaze.error
        ? lastGaze
        : {
            session_id: lastGaze.session_id,
            data: lastGaze,
          },
      emotion_recognition: lastEmotion.error
        ? lastEmotion
        : {
            summary: lastEmotion.summary,
            stats: lastEmotion.stats,
            interpretation: lastEmotion.interpretation,
            session_id: lastEmotion.session_id,
            data: lastEmotion,
          },
      voice_chat: { reply: "Completed" },
      transcript: transcriptLogRef.current.join("\n"),
      final_report: {
        report: "Analysis completed",
        timestamp: new Date().toISOString(),
      },
    };
  };

  const endSession = async (isManual: boolean = false) => {
    recognitionRef.current?.stop();
    frameIntervalRef.current && clearInterval(frameIntervalRef.current);
    setIsRecording(false);
    setSessionEnded(true);

    if (isManual && transcriptLogRef.current.length) {
      try {
        setIsLoading(true);

        await fetch("http://127.0.0.1:8002/upload_transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: transcriptLogRef.current.join("\n") }),
        });

        const aggregatedResults = aggregateResults();
        setSessionResults(aggregatedResults);

        const res = await fetch("http://127.0.0.1:8003/start-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesRef.current.slice(0, 5),
            is_post_session: true,
            gaze_data: gazeResults,
            emotion_data: emotionResults,
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
    a.href = url;
    a.download = `transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <section
      style={{
        padding: "24px 0",
        background: "linear-gradient(to bottom, #ffffff, #f5f6f5)",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "32px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            {isRecording && !sessionEnded ? (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                width={640}
                height={480}
                videoConstraints={{ facingMode: "user" }}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: "8px",
                }}
              />
            ) : (
              <div
                style={{
                  width: "640px",
                  height: "480px",
                  background: "#e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                }}
              >
                <p style={{ color: "#6b7280" }}>Webcam Off</p>
              </div>
            )}
            <canvas
              ref={canvasRef}
              width="640"
              height="480"
              style={{ display: "none" }}
            />
          </div>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center" }}>
            {!isRecording && !sessionEnded && (
              <button
                onClick={startSession}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  fontSize: "16px",
                  backgroundColor: isLoading ? "#6b7280" : "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
                onMouseOver={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = "#0056b3";
                }}
                onMouseOut={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = "#007bff";
                }}
              >
                Start Session
              </button>
            )}
            {isRecording && (
              <button
                onClick={() => endSession(true)}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  fontSize: "16px",
                  backgroundColor: isLoading ? "#6b7280" : "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
                onMouseOver={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = "#b91c1c";
                }}
                onMouseOut={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = "#dc2626";
                }}
              >
                End Session
              </button>
            )}
            {sessionEnded && conversation.length > 0 && (
              <button
                onClick={saveTranscript}
                style={{
                  padding: "10px 20px",
                  fontSize: "16px",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#10b981")}
              >
                Save Transcript
              </button>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "medium" }}>Live Conversation</h3>
          <div
            style={{
              flex: 1,
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                flex: 1,
                padding: "16px",
                overflowY: "auto",
                maxHeight: "480px",
              }}
              ref={conversationRef}
            >
              {conversation.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "16px",
                    padding: "8px",
                    borderRadius: "6px",
                    background: msg.sender === "ai" ? "#f0f9ff" : "#f3f4f6",
                    textAlign: msg.sender === "ai" ? "left" : "right",
                  }}
                >
                  <strong>{msg.sender === "ai" ? "AI" : "You"}: </strong>
                  {msg.text}
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {isListening && (
            <div style={{ textAlign: "center", color: "#10b981", fontSize: "14px" }}>
              Listening...
            </div>
          )}
          {isSpeaking && (
            <div style={{ textAlign: "center", color: "#3b82f6", fontSize: "14px" }}>
              Speaking...
            </div>
          )}
          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                backgroundColor: "#fee2e2",
                color: "#991b1b",
                borderRadius: "8px",
              }}
            >
              {error}
            </div>
          )}
        </div>
        {sessionEnded && sessionResults && (
          <div style={{ gridColumn: "1 / -1" }}>
            <DiagnosisResults
              isVisible={sessionEnded}
              conversation={conversation}
              sessionResults={sessionResults}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default DiagnosisSection;