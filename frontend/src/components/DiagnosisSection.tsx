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

interface GazeReport {
  session_id: string;
  data: any[];
  summary: string;
  stats: string;
  interpretation: string;
  error?: string;
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
  gaze_tracking: GazeTrackingResult | GazeReport;
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
  const recognitionRef = useRef<any>(null);
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
      console.log(`[Frame] Sending frame to /capture-eye-tracking with session_id: ${payload.session_id} at ${new Date().toISOString()}`);

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
        console.log(`[Frame] /capture-eye-tracking response:`, JSON.stringify(gazeData, null, 2));
        setGazeResults((prev) => [...prev, gazeData]);
      } else {
        const error = gazeRes.status === "rejected" ? gazeRes.reason : await gazeRes.value.text();
        console.error(`[Frame] Gaze tracking error for session ${payload.session_id}:`, error);
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
        const error = emotionRes.status === "rejected" ? emotionRes.reason : await emotionRes.value.text();
        console.error(`[Frame] Emotion recognition error for session ${payload.session_id}:`, error);
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
      console.error(`[Frame] Frame processing error for session ${sessionIdRef.current}:`, err);
      setError(`Error processing frame: ${err.message}`);
    }
  };

  useEffect(() => {
    if (isRecording && !sessionEnded) {
      sessionIdRef.current = new Date().toISOString();
      console.log(`[Session] New session started with session_id: ${sessionIdRef.current}`);
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

  const aggregateResults = async (): Promise<SessionResults> => {
    try {
      // Increased delay to 7 seconds to ensure all frames are saved
      console.log(`[Aggregate] Waiting 7 seconds before generating gaze report for session: ${sessionIdRef.current}`);
      await new Promise((resolve) => setTimeout(resolve, 7000));

      let gazeData;
      let attempts = 0;
      const maxAttempts = 3;

      // Retry logic for /generate-gaze-report
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`[Aggregate] Attempt ${attempts} to call /generate-gaze-report with session_id: ${sessionIdRef.current}`);
        const gazeRes = await fetch("http://127.0.0.1:8001/generate-gaze-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionIdRef.current }),
        });

        if (gazeRes.ok) {
          gazeData = await gazeRes.json();
          console.log(`[Aggregate] /generate-gaze-report response (attempt ${attempts}):`, JSON.stringify(gazeData, null, 2));
          if (gazeData.error) {
            console.warn(`[Aggregate] Gaze report contains error on attempt ${attempts}:`, gazeData.error);
            gazeData = {
              error: gazeData.error,
              details: "Backend returned an error in the response",
              session_id: sessionIdRef.current,
            };
          }
          break; // Successful response, exit retry loop
        } else {
          const errorText = await gazeRes.text();
          console.error(`[Aggregate] Gaze report error on attempt ${attempts}:`, errorText);
          if (attempts === maxAttempts) {
            // Fallback: Use gazeResults from frontend if available
            if (gazeResults.length > 0) {
              console.log(`[Aggregate] Falling back to frontend gazeResults for session ${sessionIdRef.current}`);
              const validFrames = gazeResults.filter((r) => !r.error && r.eye_count && r.eye_count > 0);
              const totalFrames = gazeResults.length;
              const avgEyeCount = validFrames.reduce((sum, r) => sum + (r.eye_count || 0), 0) / totalFrames;
              const gazePoints = validFrames.flatMap((r) => r.gaze_points || []);
              const avgGazeX = gazePoints.reduce((sum, p) => sum + p.x, 0) / gazePoints.length || 0.5;
              const avgGazeY = gazePoints.reduce((sum, p) => sum + p.y, 0) / gazePoints.length || 0.5;

              gazeData = {
                session_id: sessionIdRef.current,
                summary: `Eye tracking analysis completed: ${validFrames.length}/${totalFrames} frames with eye detections`,
                stats: `Average eyes detected per frame: ${avgEyeCount.toFixed(2)}\nAverage gaze position: X=${avgGazeX.toFixed(2)}, Y=${avgGazeY.toFixed(2)}`,
                interpretation: `Fallback analysis based on frontend data. Eyes were detected in ${validFrames.length} out of ${totalFrames} frames.`,
                data: gazeResults,
              };
            } else {
              gazeData = {
                error: gazeRes.status === 404 ? "No gaze data collected" : "Gaze report generation failed",
                details: errorText,
                session_id: sessionIdRef.current,
              };
            }
          } else {
            console.log(`[Aggregate] Retrying /generate-gaze-report after 2 seconds...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      const lastEmotion = [...emotionResults].reverse().find((r) => !r.error) || {
        error: "No valid emotion data collected",
      };

      const results: SessionResults = {
        session_id: sessionIdRef.current,
        gaze_tracking: gazeData.error
          ? { error: gazeData.error, details: gazeData.details, session_id: sessionIdRef.current }
          : {
              summary: gazeData.summary,
              stats: gazeData.stats,
              interpretation: gazeData.interpretation,
              session_id: gazeData.session_id,
              data: gazeData.data,
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

      console.log(`[Aggregate] Aggregated results:`, JSON.stringify(results, null, 2));
      return results;
    } catch (err: any) {
      console.error(`[Aggregate] Error aggregating results for session ${sessionIdRef.current}:`, err);
      return {
        session_id: sessionIdRef.current,
        gaze_tracking: { error: "Failed to generate gaze report", details: err.message, session_id: sessionIdRef.current },
        emotion_recognition: { error: "Failed to generate emotion report" },
        voice_chat: { error: "Voice chat analysis failed" },
        transcript: transcriptLogRef.current.join("\n"),
        final_report: {
          report: "Analysis completed with errors",
          timestamp: new Date().toISOString(),
        },
      };
    }
  };

  // Add debug effect for sessionResults changes
  useEffect(() => {
    console.log("[Debug] sessionResults changed:", {
      hasResults: !!sessionResults,
      sessionEnded,
      isRecording
    });
  }, [sessionResults, sessionEnded, isRecording]);

  const endSession = async (isManual: boolean = false) => {
    console.log("[Session] Starting endSession with isManual:", isManual);
    
    // Stop recording and clear intervals
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
    }

    // Update states
    setIsRecording(false);
    setSessionEnded(true);
    setError(null);

    if (!isManual || transcriptLogRef.current.length === 0) {
      console.log("[Session] Session ended without generating report:", {
        isManual,
        transcriptLength: transcriptLogRef.current.length
      });
      return;
    }

    try {
      setIsLoading(true);

      // Upload transcript
      console.log("[Session] Uploading transcript...");
      const transcriptResponse = await fetch("http://127.0.0.1:8002/upload_transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptLogRef.current.join("\n") }),
      });

      if (!transcriptResponse.ok) {
        throw new Error(`Failed to upload transcript: ${await transcriptResponse.text()}`);
      }

      // Wait for last frames to be processed
      console.log("[Session] Waiting for frame processing...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Log gaze data before sending
      console.log("[Session] Collected gaze data:", {
        count: gazeResults.length,
        validFrames: gazeResults.filter(r => !r.error && r.eye_count && r.eye_count > 0).length,
        sample: gazeResults.slice(0, 2)
      });

      const requestData = {
        messages: messagesRef.current,
        is_post_session: true,
        gaze_data: gazeResults.map(r => ({
          session_id: r.session_id,
          timestamp: r.timestamp,
          eye_count: r.eye_count,
          gaze_points: r.gaze_points,
          error: r.error
        })),
        emotion_data: emotionResults,
      };

      console.log("[Session] Sending final request with data:", {
        messageCount: requestData.messages.length,
        gazeDataCount: requestData.gaze_data.length,
        emotionDataCount: requestData.emotion_data.length
      });

      // Get final results
      const res = await fetch("http://127.0.0.1:8003/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      const responseText = await res.text();
      console.log("[Session] Raw response:", responseText);

      if (!res.ok) {
        throw new Error(`Server error: ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Failed to parse server response as JSON');
      }

      console.log("[Session] Parsed response data:", data);
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from server');
      }

      if (!data.gaze_tracking || !data.emotion_recognition || !data.final_report) {
        throw new Error('Missing required fields in server response');
      }

      // Update session results
      setSessionResults(data);
      console.log("[Session] Updated session results state with:", data);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[Session] Final report error:", errorMessage);
      setError(`Failed to generate final report: ${errorMessage}`);
      
      // Set minimal results to show error state
      setSessionResults({
        session_id: new Date().toISOString(),
        gaze_tracking: { error: "Failed to process gaze data" },
        emotion_recognition: { error: "Failed to process emotion data" },
        voice_chat: { error: "Failed to process conversation" },
        transcript: transcriptLogRef.current.join("\n"),
        final_report: {
          report: `Error generating report: ${errorMessage}`,
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      setIsLoading(false);
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
    id="diagnosis"
    style={{
      padding: "40px 0",
      background: "linear-gradient(to bottom, #ffffff, #f8fafc)",
      minHeight: "100vh"
    }}
  >
    <div
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "0 24px",
      }}
    >
      {/* Header Section */}
      <div style={{
        marginBottom: "32px",
        textAlign: "center"
      }}>
        <h2 style={{
          fontSize: "32px",
          fontWeight: "700",
          color: "#1f2937",
          marginBottom: "16px",
          background: "linear-gradient(to right, #3b82f6, #2563eb)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          Begin Your Assessment
        </h2>
        <p style={{
          fontSize: "16px",
          color: "#6b7280",
          maxWidth: "600px",
          margin: "0 auto",
          lineHeight: "1.6"
        }}>
          Get ready to start your personalized psychological assessment with PsycheAI. Our AI-powered system will guide you through a thoughtful conversation.
        </p>
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "32px",
        alignItems: "start"
      }}>
        {/* Webcam Section */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
          }}>
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
              <div style={{
                width: "100%",
                aspectRatio: "4/3",
                background: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
              }}>
                <div style={{
                  textAlign: "center",
                  color: "#6b7280"
                }}>
                  <div style={{
                    fontSize: "24px",
                    marginBottom: "8px"
                  }}>📷</div>
                  <p style={{
                    fontSize: "16px",
                    margin: 0
                  }}>Webcam Off</p>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>

          {/* Control Buttons */}
          <div style={{
            display: "flex",
            gap: "16px",
            justifyContent: "center"
          }}>
            {!isRecording && !sessionEnded && (
              <button
                onClick={startSession}
                disabled={isLoading}
                style={{
                  padding: "16px 32px",
                  fontSize: "18px",
                  fontWeight: "600",
                  background: isLoading 
                    ? "#9ca3af"
                    : "linear-gradient(to right, #8b5cf6, #3b82f6)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 6px -1px rgba(59, 130, 246, 0.3)",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  minWidth: "200px"
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 12px -1px rgba(59, 130, 246, 0.4)";
                    e.currentTarget.style.background = "linear-gradient(to right, #7c3aed, #2563eb)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(59, 130, 246, 0.3)";
                    e.currentTarget.style.background = "linear-gradient(to right, #8b5cf6, #3b82f6)";
                  }
                }}
              >
                Start Assessment
              </button>
            )}
            {isRecording && (
              <button
                onClick={() => endSession(true)}
                disabled={isLoading}
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "500",
                  backgroundColor: isLoading ? "#9ca3af" : "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(239, 68, 68, 0.25)",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = "#dc2626";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = "#ef4444";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                <span>⏹️</span> End Session
              </button>
            )}
          </div>
        </div>

        {/* Conversation Section */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          height: "100%"
        }}>
          <div style={{
            flex: 1,
            background: "#ffffff",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
          }}>
            <div
              ref={conversationRef}
              style={{
                padding: "20px",
                overflowY: "auto",
                maxHeight: "480px",
                display: "flex",
                flexDirection: "column",
                gap: "16px"
              }}
            >
              {conversation.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    maxWidth: "80%",
                    alignSelf: msg.sender === "ai" ? "flex-start" : "flex-end",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: msg.sender === "ai" 
                      ? "linear-gradient(135deg, #e9f2ff 0%, #f0f9ff 100%)"
                      : "linear-gradient(135deg, #f0f9ff 0%, #dbeafe 100%)",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)"
                  }}
                >
                  <div style={{
                    fontSize: "14px",
                    color: "#4b5563",
                    marginBottom: "4px"
                  }}>
                    {msg.sender === "ai" ? "AI Assistant" : "You"}
                  </div>
                  <div style={{
                    color: "#1f2937",
                    lineHeight: "1.5"
                  }}>
                    {msg.text}
                  </div>
                  <div style={{
                    fontSize: "12px",
                    color: "#6b7280",
                    marginTop: "4px",
                    textAlign: "right"
                  }}>
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Indicators */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px"
          }}>
            {isListening && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#10b981",
                fontSize: "14px"
              }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  animation: "pulse 1.5s infinite"
                }} />
                Listening...
              </div>
            )}
            {isSpeaking && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#3b82f6",
                fontSize: "14px"
              }}>
                <span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#3b82f6",
                  animation: "pulse 1.5s infinite"
                }} />
                Speaking...
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: "12px 16px",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              borderRadius: "8px",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <span>⚠️</span>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      {sessionEnded && (
        <div style={{ marginTop: "40px" }}>
          {sessionResults ? (
            <DiagnosisResults
              isVisible={true}
              conversation={conversation}
              sessionResults={sessionResults}
            />
          ) : (
            <div style={{ 
              padding: "24px",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              marginTop: "24px"
            }}>
              {isLoading ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px"
                }}>
                  <div style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid #e5e7eb",
                    borderTop: "3px solid #3b82f6",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                  <p style={{ color: "#4b5563", margin: 0 }}>Generating final report...</p>
                </div>
              ) : (
                <p style={{ color: "#4b5563", margin: 0 }}>Waiting for results...</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Add keyframe animations */}
    <style>
      {`
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
    </style>
  </section>
);
};

export default DiagnosisSection;