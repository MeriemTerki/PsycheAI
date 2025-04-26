import { Button } from "@/components/ui/button";

interface SessionControlsProps {
  isRecording: boolean;
  sessionEnded: boolean;
  onStartSession: () => void;
  onEndSession: () => void;
  isLoading: boolean;
}

const SessionControls: React.FC<SessionControlsProps> = ({
  isRecording,
  sessionEnded,
  onStartSession,
  onEndSession,
  isLoading,
}) => {
  return (
    <div className="mt-4 flex gap-4">
      <Button
        onClick={onStartSession}
        disabled={isRecording || sessionEnded || isLoading}
        className="bg-psyche-purple hover:bg-psyche-purple-dark text-white"
      >
        {isLoading ? "Starting..." : "Start Session"}
      </Button>
      <Button
        onClick={onEndSession}
        disabled={!isRecording || isLoading}
        variant="outline"
      >
        End Session
      </Button>
    </div>
  );
};

export default SessionControls;