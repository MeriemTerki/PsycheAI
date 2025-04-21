import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import VideoPreview from "./diagnosis/VideoPreview";
import ConversationDisplay from "./diagnosis/ConversationDisplay";
import SessionControls from "./diagnosis/SessionControls";
import DiagnosisResults from "./DiagnosisResults";

interface Message {
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
}

const DiagnosisSection = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const webcamRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  const demoQuestions = [
    "How would you describe your mood today?",
    "Have you experienced any changes in your sleep pattern recently?",
    "On a scale from 1 to 10, how would you rate your energy levels throughout the day?",
    "Do you find yourself worrying excessively about various aspects of your life?",
    "How would you describe your ability to focus on tasks or conversations?",
    "Have you noticed any changes in your appetite or eating habits?",
    "How often do you feel overwhelmed by your responsibilities?",
    "Do you find yourself avoiding certain situations due to anxiety or discomfort?"
  ];

  const scrollToBottom = () => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const startSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setSessionEnded(false);
      
      const initialMessage = "Hello, I'm your AI psychological assessment assistant. I'll be asking you some questions to help evaluate your mental wellbeing. Please answer honestly, and remember that this is just a preliminary assessment tool, not a clinical diagnosis.";
      setConversation([{ sender: 'ai', text: initialMessage, timestamp: new Date() }]);
      
      setTimeout(() => {
        const firstQuestion = demoQuestions[0];
        setCurrentQuestion(firstQuestion);
        setConversation(prev => [...prev, { sender: 'ai', text: firstQuestion, timestamp: new Date() }]);
        
        simulateUserResponses();
      }, 2000);
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };
  
  const endSession = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
    setSessionEnded(true);
    setCurrentQuestion("");
    
    const finalMessage = "Thank you for completing this assessment session. You can now review the full conversation transcript below. Remember, this is not a clinical diagnosis, but it may provide useful insights to discuss with a healthcare professional.";
    setConversation(prev => [...prev, { sender: 'ai', text: finalMessage, timestamp: new Date() }]);
  };
  
  const saveTranscript = () => {
    const transcript = conversation.map(msg => 
      `[${msg.timestamp.toLocaleTimeString()}] ${msg.sender === 'ai' ? 'AI' : 'You'}: ${msg.text}`
    ).join('\n\n');
    
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psyche-ai-transcript-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const simulateUserResponses = () => {
    const demoResponses = [
      "I've been feeling a bit down lately, but I had a good day yesterday.",
      "I've been having trouble falling asleep, and I often wake up during the night.",
      "I'd say about a 6. I have enough energy to get through the day, but I feel tired by evening.",
      "Yes, I find myself worrying about work and family issues a lot, even when I try not to.",
      "I've been having trouble concentrating at work and often lose my train of thought.",
      "I don't have much appetite these days and sometimes skip meals without noticing.",
      "I feel overwhelmed several times a week, especially when deadlines approach.",
      "I've started avoiding social gatherings because they make me anxious."
    ];
    
    let questionIndex = 0;
    
    const askNextQuestion = () => {
      if (questionIndex < demoQuestions.length - 1) {
        setTimeout(() => {
          const userResponse = demoResponses[questionIndex];
          setConversation(prev => [...prev, { sender: 'user', text: userResponse, timestamp: new Date() }]);
          
          setTimeout(() => {
            questionIndex++;
            const nextQuestion = demoQuestions[questionIndex];
            setCurrentQuestion(nextQuestion);
            setConversation(prev => [...prev, { sender: 'ai', text: nextQuestion, timestamp: new Date() }]);
            askNextQuestion();
          }, 3000);
        }, 3000);
      } else {
        setTimeout(() => {
          const userResponse = demoResponses[questionIndex];
          setConversation(prev => [...prev, { sender: 'user', text: userResponse, timestamp: new Date() }]);
          
          setTimeout(() => {
            endSession();
          }, 3000);
        }, 3000);
      }
    };
    
    askNextQuestion();
  };

  return (
    <section id="diagnosis" className="py-24 bg-gradient-to-b from-white to-psyche-gray-light">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">
            Start Your <span className="bg-gradient-to-r from-psyche-purple to-psyche-blue bg-clip-text text-transparent">AI Diagnosis</span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Interact with our AI voice agent for a comprehensive psychological assessment
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Video Preview Column */}
          <div className="lg:col-span-2 flex flex-col">
            <Card className="flex-1">
              <CardContent className="p-0 relative h-full flex flex-col">
                <VideoPreview 
                  isRecording={isRecording}
                  sessionEnded={sessionEnded}
                  webcamRef={webcamRef}
                />
                {isRecording && currentQuestion && (
                  <div className="p-4 bg-psyche-purple-light border-t border-psyche-purple/20">
                    <p className="font-medium text-psyche-purple">Current Question:</p>
                    <p className="text-gray-800">{currentQuestion}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <SessionControls 
              isRecording={isRecording}
              sessionEnded={sessionEnded}
              onStartSession={startSession}
              onEndSession={endSession}
            />
          </div>

          {/* Conversation Column */}
          <div className="lg:col-span-3 flex flex-col">
            <div className="flex flex-col h-[500px] mb-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-medium">Live Conversation</h3>
                <div className={`px-3 py-1 rounded-full text-xs ${
                  isRecording 
                    ? 'bg-green-100 text-green-800' 
                    : sessionEnded
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {isRecording ? 'Active Session' : sessionEnded ? 'Session Complete' : 'Ready to Begin'}
                </div>
              </div>

              <Card className="flex-1 min-h-0">
                <CardContent className="p-0 h-full">
                  <ConversationDisplay 
                    conversation={conversation}
                    conversationRef={conversationRef}
                    isRecording={isRecording}
                  />
                </CardContent>
              </Card>
            </div>

            
          </div>
          {sessionEnded && (
  <div className="lg:col-span-5 w-full flex justify-center">
    <div className="w-full max-w-4xl">
      <DiagnosisResults 
        isVisible={sessionEnded} 
        conversation={conversation}
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