import { RefObject } from "react";

interface Message {
  sender: "ai" | "user";
  text: string;
  timestamp: Date;
}

interface ConversationDisplayProps {
  conversation: Message[];
  conversationRef: RefObject<HTMLDivElement>;
  isRecording: boolean;
}

const ConversationDisplay: React.FC<ConversationDisplayProps> = ({
  conversation,
  conversationRef,
  isRecording,
}) => {
  return (
    <div
      ref={conversationRef}
      className="h-full overflow-y-auto p-4 bg-gray-50"
    >
      {conversation.map((msg, index) => (
        <div
          key={index}
          className={`mb-4 ${
            msg.sender === "ai" ? "text-left" : "text-right"
          }`}
        >
          <div
            className={`inline-block p-3 rounded-lg ${
              msg.sender === "ai"
                ? "bg-psyche-purple-light text-gray-800"
                : "bg-psyche-blue text-white"
            }`}
          >
            <p>{msg.text}</p>
            <p className="text-xs text-gray-500 mt-1">
              {msg.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversationDisplay;