import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer } from "lucide-react";

interface DiagnosisResultsProps {
  isVisible: boolean;
  conversation: Array<{
    sender: 'ai' | 'user';
    text: string;
    timestamp: Date;
  }>;
}

const DiagnosisResults = ({ isVisible, conversation }: DiagnosisResultsProps) => {
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedConversation = conversation
      .map(msg => `${msg.sender === 'ai' ? 'AI' : 'Patient'}: ${msg.text}`)
      .join('\n\n');

    const content = `
      <html>
        <head>
          <title>Psychology Diagnosis Report</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
            h1 { color: #7E69AB; }
            .section { margin-bottom: 20px; }
            .timestamp { color: #666; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <h1>Psychology Diagnosis Report</h1>
          <div class="section">
            <h2>Session Summary</h2>
            <p>Date: ${new Date().toLocaleDateString()}</p>
            <p>Duration: ${conversation.length > 0 ? 
              Math.round((conversation[conversation.length - 1].timestamp.getTime() - 
              conversation[0].timestamp.getTime()) / 60000) : 0} minutes</p>
          </div>
          <div class="section">
            <h2>Conversation Transcript</h2>
            <pre>${formattedConversation}</pre>
          </div>
          <div class="section">
            <h2>Preliminary Assessment</h2>
            <p>This is an AI-assisted preliminary assessment and should be reviewed by a healthcare professional.</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handlePrintTranscript = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedConversation = conversation
      .map(msg => `[${msg.timestamp.toLocaleTimeString()}] ${msg.sender === 'ai' ? 'AI' : 'Patient'}: ${msg.text}`)
      .join('\n\n');

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

  if (!isVisible) return null;

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
              <h3 className="font-medium mb-2">Preliminary Assessment</h3>
              <p className="text-gray-600">
                Based on the conversation analysis, there are indicators of mild anxiety
                and stress. Further professional evaluation is recommended.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Recommended Treatment Approach</h3>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Consider cognitive behavioral therapy sessions</li>
                <li>Practice stress management techniques</li>
                <li>Maintain regular sleep schedule</li>
                <li>Schedule a follow-up with a mental health professional</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosisResults;