import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer } from "lucide-react";

interface Message {
  sender: "ai" | "user";
  text: string;
  timestamp: Date;
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

interface DiagnosisResultsProps {
  isVisible: boolean;
  conversation: Message[];
  sessionResults: SessionResults;
}

const DiagnosisResults: React.FC<DiagnosisResultsProps> = ({ isVisible, conversation, sessionResults }) => {
  const handlePrintReport = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedConversation = conversation
      .map((msg) => `${msg.sender === "ai" ? "AI" : "Patient"}: ${msg.text}`)
      .join("\n\n");

    const content = `
      <html>
        <head>
          <title>Psychology Diagnosis Report</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
            h1, h2 { color: #7E69AB; }
            .section { margin-bottom: 20px; }
            .timestamp { color: #666; font-size: 0.9em; }
            pre { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Psychology Diagnosis Report</h1>
          <div class="section">
            <h2>Session Summary</h2>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            <p>Session ID: ${sessionResults?.session_id || "N/A"}</p>
          </div>
          <div class="section">
            <h2>Gaze Tracking Analysis</h2>
            <p>${sessionResults?.gaze_tracking?.report || sessionResults?.gaze_tracking?.error || "Data unavailable"}</p>
          </div>
          <div class="section">
            <h2>Emotion Recognition Analysis</h2>
            <p><strong>Summary:</strong> ${sessionResults?.emotion_recognition?.summary || sessionResults?.emotion_recognition?.error || "Data unavailable"}</p>
            <p><strong>Statistics:</strong> ${sessionResults?.emotion_recognition?.stats || "Data unavailable"}</p>
            <p><strong>Interpretation:</strong> ${sessionResults?.emotion_recognition?.interpretation || "Data unavailable"}</p>
          </div>
          <div class="section">
            <h2>Conversation Transcript</h2>
            <pre>${formattedConversation}</pre>
          </div>
          <div class="section">
            <h2>Comprehensive Assessment</h2>
            <pre>${sessionResults?.final_report?.report || "Report generation failed"}</pre>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintTranscript = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedConversation = conversation
      .map((msg) => `[${msg.timestamp.toLocaleTimeString()}] ${msg.sender === "ai" ? "AI" : "Patient"}: ${msg.text}`)
      .join("\n\n");

    const content = `
      <html>
        <head>
          <title>Conversation Transcript</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #7E69AB; }
            pre { white-space: pre-wrap; }
            .timestamp { color: #666; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <h1>Conversation Transcript</h1>
          <p>Date: ${new Date().toLocaleDateString()}</p>
          <pre>${formattedConversation}</pre>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  if (!isVisible || !sessionResults) return null;

  console.log("[DiagnosisResults] sessionResults:", sessionResults); // for debugging

  return (
    <div className="mt-8 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Diagnosis Results</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handlePrintTranscript}
              >
                <Printer className="h-4 w-4" />
                Print Transcript
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handlePrintReport}
              >
                <Printer className="h-4 w-4" />
                Print Report
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Session Summary</h3>
              <p className="text-gray-600">Session ID: {sessionResults.session_id}</p>
              <p className="text-gray-600">Date: {new Date().toLocaleDateString()}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Gaze Tracking Analysis</h3>
              <p className="text-gray-600">
                {sessionResults.gaze_tracking?.report ||
                 sessionResults.gaze_tracking?.error ||
                 "Data unavailable"}
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Emotion Recognition Analysis</h3>
              <p className="text-gray-600">
                <strong>Summary:</strong>{" "}
                {sessionResults.emotion_recognition?.summary ||
                 sessionResults.emotion_recognition?.error ||
                 "Data unavailable"}
              </p>
              <p className="text-gray-600">
                <strong>Statistics:</strong>{" "}
                {sessionResults.emotion_recognition?.stats || "Data unavailable"}
              </p>
              <p className="text-gray-600">
                <strong>Interpretation:</strong>{" "}
                {sessionResults.emotion_recognition?.interpretation || "Data unavailable"}
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Comprehensive Assessment</h3>
              <pre className="text-gray-600 whitespace-pre-wrap">
                {sessionResults.final_report?.report || "Report generation failed"}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosisResults;