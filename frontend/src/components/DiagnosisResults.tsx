import React from "react";

interface Message {
  sender: "ai" | "user";
  text: string;
  timestamp: Date;
}

interface GazePoint {
  x: number;
  y: number;
}

interface GazeFrame {
  session_id: string;
  timestamp: string;
  eye_count: number;
  gaze_points: GazePoint[];
  error?: string;
  details?: string;
}

interface GazeTrackingResult {
  session_id?: string;
  summary?: string;
  stats?: string;
  interpretation?: string;
  error?: string;
  details?: string;
  data?: GazeFrame[];
}

interface EmotionData {
  timestamp: string;
  emotion: string;
  confidence: number;
  facial_features?: Record<string, number>;
}

interface EmotionRecognitionResult {
  session_id?: string;
  summary?: string;
  stats?: string;
  interpretation?: string;
  error?: string;
  details?: string;
  data?: EmotionData[];
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
  const formattedSessionId = session_id.replace(/\.\d{3}Z$/, "").replace(/[-:T]/g, "");

  // Helper to render a section with title and content
  const renderSection = (title: string, content: React.ReactNode) => (
    <div style={{
      backgroundColor: "#ffffff",
      borderRadius: "8px",
      padding: "20px",
      marginBottom: "20px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)"
    }}>
      <h4 style={{
        fontSize: "18px",
        fontWeight: "600",
        color: "#1f2937",
        marginBottom: "16px",
        borderBottom: "2px solid #e5e7eb",
        paddingBottom: "8px"
      }}>{title}</h4>
      {content}
    </div>
  );

  // Helper to render analysis data
  const renderAnalysisData = (data: GazeTrackingResult | EmotionRecognitionResult) => {
    if (data.error) {
      return (
        <div style={{ color: "#991b1b", padding: "12px", backgroundColor: "#fee2e2", borderRadius: "6px" }}>
          {data.error}
          {data.details && <div style={{ marginTop: "8px", fontSize: "14px" }}>{data.details}</div>}
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {data.summary && (
          <div>
            <strong style={{ color: "#4b5563" }}>Summary:</strong>
            <p style={{ marginTop: "4px", color: "#1f2937" }}>{data.summary}</p>
          </div>
        )}
        {data.stats && (
          <div>
            <strong style={{ color: "#4b5563" }}>Statistics:</strong>
            <pre style={{ 
              marginTop: "4px",
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              color: "#1f2937",
              backgroundColor: "#f3f4f6",
              padding: "8px",
              borderRadius: "4px"
            }}>{data.stats}</pre>
          </div>
        )}
        {data.interpretation && (
          <div>
            <strong style={{ color: "#4b5563" }}>Interpretation:</strong>
            <p style={{ marginTop: "4px", color: "#1f2937" }}>{data.interpretation}</p>
          </div>
        )}
      </div>
    );
  };

  // Helper to format the comprehensive report
  const formatComprehensiveReport = (report: string) => {
    // Split the report into sections based on markdown-style headers
    const sections = report.split(/\*\*(.*?)\*\*/g).filter(Boolean);
    
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {sections.map((section, index) => {
          if (index % 2 === 0) { // Content
            return (
              <div key={index} style={{ 
                backgroundColor: "#ffffff",
                padding: "16px",
                borderRadius: "8px",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
              }}>
                {section.split('\n').map((line, i) => {
                  // Handle bullet points
                  if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                    return (
                      <li key={i} style={{ 
                        marginLeft: "24px",
                        marginBottom: "8px",
                        color: "#374151",
                        lineHeight: "1.6"
                      }}>
                        {line.trim().replace(/^[*-]\s*/, '')}
                      </li>
                    );
                  }
                  // Handle regular paragraphs
                  if (line.trim()) {
                    return (
                      <p key={i} style={{ 
                        marginBottom: "12px", 
                        color: "#374151",
                        lineHeight: "1.6"
                      }}>
                        {line}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            );
          } else { // Section title
            return (
              <div key={index} style={{
                backgroundColor: "#f0f9ff",
                padding: "12px 16px",
                borderRadius: "8px",
                borderLeft: "4px solid #3b82f6",
                marginTop: index === 1 ? 0 : "16px"
              }}>
                <h5 style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#1f2937",
                  margin: 0
                }}>
                  {section}
                </h5>
              </div>
            );
          }
        })}
      </div>
    );
  };

  // Helper to format gaze tracking data specifically
  const formatGazeAnalysis = (data: GazeTrackingResult) => {
    if (!data || (!data.summary && !data.stats && !data.interpretation && !data.error)) {
      return (
        <div style={{ 
          padding: "16px", 
          backgroundColor: "#fee2e2", 
          borderRadius: "6px",
          color: "#991b1b" 
        }}>
          No gaze tracking data available
        </div>
      );
    }

    if (data.error) {
      return (
        <div style={{ 
          padding: "16px", 
          backgroundColor: "#fee2e2", 
          borderRadius: "6px",
          color: "#991b1b" 
        }}>
          {data.error}
          {data.details && (
            <div style={{ 
              marginTop: "8px", 
              fontSize: "14px",
              color: "#7f1d1d"
            }}>
              {data.details}
            </div>
          )}
        </div>
      );
    }

    // Extract metrics from the data object directly if available
    let metrics: Record<string, string> = {};
    
    if (typeof data === 'object' && data.stats) {
      // Try to parse stats if it's a string
      if (typeof data.stats === 'string') {
        const statsLines = data.stats.split('\n');
        statsLines.forEach(line => {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            metrics[key] = value;
          }
        });
      }
    }

    // If we have data in a different format, try to extract metrics
    if (data.data && Array.length > 0) {
      const validFrames = data.data.filter(frame => frame.eye_count > 0);
      if (validFrames.length > 0) {
        metrics = {
          'Total Frames': data.data.length.toString(),
          'Valid Frames': validFrames.length.toString(),
          'Success Rate': `${((validFrames.length / data.data.length) * 100).toFixed(1)}%`,
          'Average Eyes Detected': (validFrames.reduce((sum, frame) => sum + frame.eye_count, 0) / validFrames.length).toFixed(2)
        };
      }
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Summary Section */}
        {data.summary && (
          <div style={{ 
            backgroundColor: "#f0f9ff", 
            padding: "16px", 
            borderRadius: "8px",
            borderLeft: "4px solid #3b82f6"
          }}>
            <h5 style={{ 
              fontSize: "16px", 
              fontWeight: "600", 
              color: "#1f2937",
              marginBottom: "8px"
            }}>Overview</h5>
            <p style={{ color: "#374151" }}>{data.summary}</p>
          </div>
        )}

        {/* Metrics Grid */}
        {Object.keys(metrics).length > 0 && (
          <div>
            <h5 style={{ 
              fontSize: "16px", 
              fontWeight: "600", 
              color: "#1f2937",
              marginBottom: "12px"
            }}>Key Metrics</h5>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
              gap: "12px"
            }}>
              {Object.entries(metrics).map(([key, value], index) => (
                <div key={index} style={{ 
                  backgroundColor: "#ffffff",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                }}>
                  <div style={{ 
                    fontSize: "14px", 
                    color: "#6b7280",
                    marginBottom: "4px"
                  }}>{key}</div>
                  <div style={{ 
                    fontSize: "16px", 
                    color: "#111827",
                    fontWeight: "500"
                  }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interpretation Section */}
        {data.interpretation && (
          <div>
            <h5 style={{ 
              fontSize: "16px", 
              fontWeight: "600", 
              color: "#1f2937",
              marginBottom: "12px"
            }}>Behavioral Analysis</h5>
            <div style={{ 
              backgroundColor: "#f3f4f6",
              padding: "16px",
              borderRadius: "8px",
              color: "#374151",
              lineHeight: "1.6"
            }}>
              {data.interpretation.split('. ').map((sentence, index, array) => (
                <p key={index} style={{ 
                  marginBottom: index === array.length - 1 ? 0 : "8px"
                }}>
                  {sentence.trim() + (index === array.length - 1 ? '' : '.')}
                </p>
              ))}
            </div>
          </div>
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
    <div style={{
        marginTop: "32px",
        padding: "24px",
      backgroundColor: "#f9fafb",
      borderRadius: "12px",
      border: "1px solid #e5e7eb"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "24px"
      }}>
        <h2 style={{ 
          fontSize: "24px", 
          fontWeight: "bold",
          color: "#111827"
        }}>
          Mental Health Assessment Report
      </h2>
        <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={handlePrintTranscript}
          style={{
              padding: "8px 16px",
              fontSize: "14px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
              borderRadius: "6px",
            cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#059669")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#10b981")}
        >
            <span>📄</span> Print Transcript
        </button>
        <button
          onClick={handlePrintReport}
          style={{
              padding: "8px 16px",
              fontSize: "14px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
              borderRadius: "6px",
            cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s"
          }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3b82f6")}
        >
            <span>📊</span> Print Report
        </button>
      </div>
      </div>

      {renderSection("Session Information", (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <strong style={{ color: "#4b5563" }}>Session ID:</strong>
            <p style={{ color: "#1f2937" }}>{formattedSessionId}</p>
          </div>
          <div>
            <strong style={{ color: "#4b5563" }}>Date:</strong>
            <p style={{ color: "#1f2937" }}>{new Date().toLocaleDateString()}</p>
          </div>
        </div>
      ))}

      {renderSection("Gaze Tracking Analysis", formatGazeAnalysis(gaze_tracking))}
      {renderSection("Emotion Recognition Analysis", renderAnalysisData(emotion_recognition))}
      
      {renderSection("Comprehensive Assessment", (
        <div style={{ color: "#1f2937" }}>
          {formatComprehensiveReport(final_report.report)}
        </div>
      ))}
    </div>
  );
};

export default DiagnosisResults;