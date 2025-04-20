
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Save, Video } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

  // Demo AI questions - in a real app, these would come from an API
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

  useEffect(() => {
    // Auto-scroll to bottom of conversation
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [conversation]);

  const startSession = async () => {
    try {
      // Get user media (webcam and audio)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      
      // Display webcam feed
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
      }
      
      // Setup media recorder (would record to server in production)
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setSessionEnded(false);
      
      // Initial AI message
      const initialMessage = "Hello, I'm your AI psychological assessment assistant. I'll be asking you some questions to help evaluate your mental wellbeing. Please answer honestly, and remember that this is just a preliminary assessment tool, not a clinical diagnosis.";
      setConversation([{ sender: 'ai', text: initialMessage, timestamp: new Date() }]);
      
      // Ask first question after 2 seconds
      setTimeout(() => {
        const firstQuestion = demoQuestions[0];
        setCurrentQuestion(firstQuestion);
        setConversation(prev => [...prev, { sender: 'ai', text: firstQuestion, timestamp: new Date() }]);
        
        // Simulate user responses for demo purposes
        simulateUserResponses();
      }, 2000);
      
    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };
  
  const endSession = () => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
    setSessionEnded(true);
    setCurrentQuestion("");
    
    // Final AI message
    const finalMessage = "Thank you for completing this assessment session. You can now review the full conversation transcript below. Remember, this is not a clinical diagnosis, but it may provide useful insights to discuss with a healthcare professional.";
    setConversation(prev => [...prev, { sender: 'ai', text: finalMessage, timestamp: new Date() }]);
  };
  
  const saveTranscript = () => {
    // In a real app, this would save to a database or download as file
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
  
  // This function simulates user responses for demo purposes
  // In a real app, these would come from actual user voice input
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
        // Add user response to previous question
        setTimeout(() => {
          const userResponse = demoResponses[questionIndex];
          setConversation(prev => [...prev, { sender: 'user', text: userResponse, timestamp: new Date() }]);
          
          // Ask next question after user response
          setTimeout(() => {
            questionIndex++;
            const nextQuestion = demoQuestions[questionIndex];
            setCurrentQuestion(nextQuestion);
            setConversation(prev => [...prev, { sender: 'ai', text: nextQuestion, timestamp: new Date() }]);
            askNextQuestion();
          }, 3000);
        }, 3000);
      } else {
        // Final user response
        setTimeout(() => {
          const userResponse = demoResponses[questionIndex];
          setConversation(prev => [...prev, { sender: 'user', text: userResponse, timestamp: new Date() }]);
          
          // End session after final response
          setTimeout(() => {
            endSession();
          }, 3000);
        }, 3000);
      }
    };
    
    askNextQuestion();
  };

  return (
    <section id="diagnosis" className="py-24 bg-gradient-to-b from-white to-psyche-gray-light min-h-screen">
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
          {/* Webcam Feed */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardContent className="p-0 relative">
                <div className="aspect-video bg-black relative">
                  {!isRecording && !sessionEnded ? (
                    <div className="absolute inset-0 flex items-center justify-center flex-col text-white">
                      <div className="w-20 h-20 rounded-full bg-psyche-purple/20 flex items-center justify-center mb-4">
                        <Video className="w-8 h-8 text-psyche-purple" />
                      </div>
                      <p className="text-gray-300">Camera will activate when session starts</p>
                    </div>
                  ) : null}
                  <video 
                    ref={webcamRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className={`w-full h-full object-cover ${isRecording ? 'block' : 'hidden'}`}
                  />
                  {sessionEnded ? (
                    <div className="absolute inset-0 flex items-center justify-center flex-col bg-black/80 text-white">
                      <p className="text-xl font-medium mb-2">Session Complete</p>
                      <p className="text-gray-300">Video recording has ended</p>
                    </div>
                  ) : null}
                  {isRecording ? (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/80 px-3 py-1 rounded-full text-white text-sm">
                      <div className="w-2 h-2 bg-white rounded-full animate-recording-pulse"></div>
                      Recording
                    </div>
                  ) : null}
                </div>
                {isRecording && currentQuestion ? (
                  <div className="p-4 bg-psyche-purple-light border-t border-psyche-purple/20">
                    <p className="font-medium text-psyche-purple">Current Question:</p>
                    <p className="text-gray-800">{currentQuestion}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="mt-6 flex flex-col gap-4">
              {!isRecording ? (
                <Button 
                  disabled={sessionEnded}
                  size="lg" 
                  onClick={startSession}
                  className="bg-psyche-purple hover:bg-psyche-purple-dark text-white transition-colors"
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Start Diagnosis Session
                </Button>
              ) : (
                <Button 
                  size="lg" 
                  variant="destructive" 
                  onClick={endSession}
                >
                  <MicOff className="mr-2 h-5 w-5" />
                  End Session
                </Button>
              )}
              
              {sessionEnded && (
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={saveTranscript}
                  className="border-psyche-purple text-psyche-purple hover:bg-psyche-purple-light"
                >
                  <Save className="mr-2 h-5 w-5" />
                  Save Transcript
                </Button>
              )}

              {sessionEnded && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="lg"
                      className="border-psyche-blue text-psyche-blue hover:bg-psyche-blue-light"
                    >
                      View Full Transcript
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Session Transcript</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="flex-1 mt-4 pr-4">
                      <div className="space-y-4">
                        {conversation.map((message, index) => (
                          <div key={index} className={`flex ${message.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] p-4 rounded-xl ${
                              message.sender === 'ai' 
                                ? 'bg-psyche-purple-light text-gray-800' 
                                : 'bg-psyche-blue-light text-gray-800'
                            }`}>
                              <p className="text-sm font-medium mb-1">{message.sender === 'ai' ? 'AI' : 'You'}</p>
                              <p>{message.text}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {message.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          {/* Conversation Area */}
          <div className="lg:col-span-3">
            <Card className="h-full flex flex-col">
              <CardContent className="p-4 flex-1 overflow-hidden">
                <div className="flex flex-col h-full">
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
                  
                  <ScrollArea className="flex-1" ref={conversationRef}>
                    {conversation.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center p-8">
                          <div className="w-16 h-16 rounded-full bg-psyche-gray-light mx-auto flex items-center justify-center mb-4">
                            <Mic className="w-6 h-6 text-psyche-purple" />
                          </div>
                          <h3 className="text-lg font-medium mb-2">No Active Session</h3>
                          <p className="text-gray-600">Click the "Start Diagnosis Session" button to begin</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 p-2">
                        {conversation.map((message, index) => (
                          <div key={index} className={`flex ${message.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[80%] p-4 rounded-xl animate-fade-in ${
                              message.sender === 'ai' 
                                ? 'bg-psyche-purple-light text-gray-800' 
                                : 'bg-psyche-blue-light text-gray-800'
                            }`} style={{ animationDelay: `${index * 100}ms` }}>
                              <p className="text-sm font-medium mb-1">{message.sender === 'ai' ? 'AI' : 'You'}</p>
                              <p>{message.text}</p>
                              <p className="text-xs text-gray-500 mt-2">
                                {message.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DiagnosisSection;
