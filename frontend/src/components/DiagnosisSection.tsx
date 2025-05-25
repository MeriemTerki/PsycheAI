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
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              }}
            >
              <p style={{ color: "#6b7280", fontSize: "18px" }}>Webcam Off</p>
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
                boxShadow: isLoading ? "none" : "0 2px 4px rgba(0, 123, 255, 0.3)",
                transition: "background-color 0.3s, box-shadow 0.3s",
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = "#0056b3";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 86, 179, 0.4)";
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = "#007bff";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 123, 255, 0.3)";
                }
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
                boxShadow: isLoading ? "none" : "0 2px 4px rgba(220, 38, 38, 0.3)",
                transition: "background-color 0.3s, box-shadow 0.3s",
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = "#b91c1c";
                  e.currentTarget.style.boxShadow = "0 4px 8px rgba(185, 28, 28, 0.4)";
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = "#dc2626";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(220, 38, 38, 0.3)";
                }
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
                boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
                transition: "background-color 0.3s, box-shadow 0.3s",
              }}
              // onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
              // onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#10b981")}
              className="bg-gradient-to-r from-psyche-purple to-psyche-blue text-white hover:opacity-90 transition-all px-8 py-6 text-lg"
            >
              Save Transcript
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: "bold", color: "#1f2937" }}>
            Begin Your Assessment
          </h2>
          <p style={{ fontSize: "16px", color: "#6b7280", marginTop: "8px" }}>
            Get ready to start your personalized psychological assessment with PsycheAI. Click 'Start Session' to begin.
          </p>
        </div>
        <div
          style={{
            flex: 1,
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            overflow: "hidden",
            background: "#ffffff",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
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
      {sessionEnded && (
        <div style={{ gridColumn: "1 / -1" }}>
          {sessionResults ? (
            <DiagnosisResults
              isVisible={true}
              conversation={conversation}
              sessionResults={sessionResults}
            />
          ) : (
            <div style={{ 
              padding: "20px", 
              textAlign: "center", 
              backgroundColor: "#f3f4f6",
              borderRadius: "8px",
              marginTop: "20px"
            }}>
              {isLoading ? (
                <p>Generating final report...</p>
              ) : (
                <p>Waiting for results...</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </section>
);
};

export default DiagnosisSection;