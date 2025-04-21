import React from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic } from 'lucide-react';

interface Message {
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
}

interface ConversationDisplayProps {
  conversation: Message[];
  conversationRef: React.RefObject<HTMLDivElement>;
  isRecording: boolean;
}

const ConversationDisplay = ({ conversation, conversationRef, isRecording }: ConversationDisplayProps) => {
  return (
    <ScrollArea className="h-full" ref={conversationRef}>
      <div className="h-full flex flex-col">
        {conversation.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-psyche-gray-light mx-auto flex items-center justify-center mb-4">
                <Mic className="w-6 h-6 text-psyche-purple" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Active Session</h3>
              <p className="text-gray-600">Click the "Start Diagnosis Session" button to begin</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 p-4">
            {conversation.map((message, index) => (
              <div key={index} className={`flex ${message.sender === 'ai' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] p-4 rounded-xl ${
                  message.sender === 'ai' 
                    ? 'bg-psyche-purple-light text-gray-800' 
                    : 'bg-psyche-blue-light text-gray-800'
                }`}>
                  <p className="text-sm font-medium mb-1">{message.sender === 'ai' ? 'AI' : 'You'}</p>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
};

export default ConversationDisplay;