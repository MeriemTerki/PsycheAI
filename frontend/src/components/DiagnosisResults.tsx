import React from "react";

interface Message {
  sender: "ai" | "user";
  text: string;
  timestamp: Date;
}

interface GazeTrackingResult {
  session_id?: string;
  summary?: string;
  stats?: string;
  interpretation?: string;
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

interface DiagnosisResultsProps {
  isVisible: boolean;
  conversation: Message[];
  sessionResults: SessionResults;
}

const DiagnosisResults: React.FC<DiagnosisResultsProps> = ({ isVisible, conversation, sessionResults }) => {
  if (!isVisible || !sessionResults) return null;

  const { session_id, gaze_tracking, emotion_recognition, transcript, final_report } = sessionResults;

  // Format session ID for display (remove milliseconds and 'Z')
  const formattedSessionId = session_id.replace(/\.\d{3}Z$/, "").replace(/[-:T]/g, "");

  // Helper to render analysis section
  const renderAnalysisSection = (title: string, data: GazeTrackingResult | EmotionRecognitionResult) => {
    console.log(`[Render] Rendering ${title} with data:`, JSON.stringify(data, null, 2));
    if (data.error) {
      return (
        <div style={{ marginBottom: "24px" }}>
          <h4 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>{title}</h4>
          <p style={{ color: "#991b1b" }}>Report generation failed: {data.error}</p>
          {data.details && <p style={{ color: "#991b1b" }}>Details: {data.details}</p>}
        </div>
      );
    }

    return (
      <div style={{ marginBottom: "24px" }}>
        <h4 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>{title}</h4>
        {data.summary && <p><strong>Summary:</strong> {data.summary}</p>}
        {data.stats && (
          <p style={{ whiteSpace: "pre-line" }}>
            <strong>Statistics:</strong> {data.stats}
          </p>
        )}
        {data.interpretation && (
          <p style={{ whiteSpace: "pre-line" }}>
            <strong>Interpretation:</strong> {data.interpretation}
          </p>
        )}
      </div>
    );
  };

  const handlePrintTranscript = () => {
    const text = conversation
      .map((m) => `[${m.timestamp.toLocaleTimeString()}] ${m.sender === "ai" ? "AI" : "You"}: ${m.text}`)
      .join("\n\n");
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Transcript</title></head>
          <body>
            <h1>Conversation Transcript</h1>
            <pre>${text}</pre>
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const gazeSection = gaze_tracking.error
        ? `<p><strong>Gaze Tracking Analysis:</strong> Report generation failed: ${gaze_tracking.error}</p>`
        : `
          <h3>Gaze Tracking Analysis</h3>
          <p><strong>Summary:</strong> ${gaze_tracking.summary}</p>
          <p><strong>Statistics:</strong> ${gaze_tracking.stats.replace(/\n/g, "<br>")}</p>
          <p><strong>Interpretation:</strong> ${gaze_tracking.interpretation.replace(/\n/g, "<br>")}</p>
        `;
      const emotionSection = emotion_recognition.error
        ? `<p><strong>Emotion Recognition Analysis:</strong> Report generation failed: ${emotion_recognition.error}</p>`
        : `
          <h3>Emotion Recognition Analysis</h3>
          <p><strong>Summary:</strong> ${emotion_recognition.summary}</p>
          <p><strong>Statistics:</strong> ${emotion_recognition.stats.replace(/\n/g, "<br>")}</p>
          <p><strong>Interpretation:</strong> ${emotion_recognition.interpretation.replace(/\n/g, "<br>")}</p>
        `;
      const comprehensiveSection = final_report.report
        ? `
          <h3>Comprehensive Assessment</h3>
          <p>${final_report.report.replace(/\n/g, "<br>")}</p>
        `
        : "";
      printWindow.document.write(`
        <html>
          <head><title>Diagnosis Report</title></head>
          <body>
            <h1>Diagnosis Results</h1>
            <p><strong>Session ID:</strong> ${formattedSessionId}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            ${gazeSection}
            ${emotionSection}
            ${comprehensiveSection}
            <script>window.print(); window.close();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div
      style={{
        marginTop: "32px",
        padding: "24px",
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
      }}
    >
      <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
        Diagnosis Results
      </h2>
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <button
          onClick={handlePrintTranscript}
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
          Print Transcript
        </button>
        <button
          onClick={handlePrintReport}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3b82f6")}
        >
          Print Report
        </button>
      </div>
      <h3 style={{ fontSize: "20px", fontWeight: "medium", marginBottom: "16px" }}>
        Session Summary
      </h3>
      <p><strong>Session ID:</strong> {formattedSessionId}</p>
      <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
      {renderAnalysisSection("Gaze Tracking Analysis", gaze_tracking)}
      {renderAnalysisSection("Emotion Recognition Analysis", emotion_recognition)}
      <div style={{ marginBottom: "24px" }}>
        <h4 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>
          Comprehensive Assessment
        </h4>
        <p style={{ whiteSpace: "pre-line" }}>{final_report.report}</p>
      </div>
    </div>
  );
};

export default DiagnosisResults;