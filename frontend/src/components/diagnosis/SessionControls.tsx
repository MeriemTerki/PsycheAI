
import React from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from 'lucide-react';

interface SessionControlsProps {
  isRecording: boolean;
  sessionEnded: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
}

const SessionControls = ({ 
  isRecording, 
  sessionEnded, 
  onStartSession, 
  onEndSession 
}: SessionControlsProps) => {
  return (
    <div className="mt-6 flex flex-col gap-4">
      {!isRecording ? (
        <Button 
          disabled={sessionEnded}
          size="lg" 
          onClick={onStartSession}
          className="bg-psyche-purple hover:bg-psyche-purple-dark text-white transition-colors"
        >
          <Mic className="mr-2 h-5 w-5" />
          Start Diagnosis Session
        </Button>
      ) : (
        <Button 
          size="lg" 
          variant="destructive" 
          onClick={onEndSession}
        >
          <MicOff className="mr-2 h-5 w-5" />
          End Session
        </Button>
      )}
    </div>
  );
};

export default SessionControls;