import React from 'react';
import { Video } from 'lucide-react';

interface VideoPreviewProps {
  isRecording: boolean;
  sessionEnded: boolean;
  webcamRef: React.RefObject<HTMLVideoElement>;
}

const VideoPreview = ({ isRecording, sessionEnded, webcamRef }: VideoPreviewProps) => {
  return (
    <div className="aspect-video bg-black relative">
      {!isRecording && !sessionEnded ? (
        <div className="absolute inset-0 flex items-center justify-center flex-col text-white z-10">
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
        className="w-full h-full object-cover"
        style={{ display: isRecording && !sessionEnded ? 'block' : 'none' }}
      />
      {sessionEnded ? (
        <div className="absolute inset-0 flex items-center justify-center flex-col bg-black/80 text-white z-10">
          <p className="text-xl font-medium mb-2">Session Complete</p>
          <p className="text-gray-300">Video recording has ended</p>
        </div>
      ) : null}
      {isRecording && !sessionEnded ? (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/80 px-3 py-1 rounded-full text-white text-sm z-10">
          <div className="w-2 h-2 bg-white rounded-full animate-recording-pulse"></div>
          Recording
        </div>
      ) : null}
    </div>
  );
};

export default VideoPreview;