// src/types/speech-recognition.d.ts

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  // start/stop control
  start(): void;
  stop(): void;

  // classic callback properties
  onstart?: () => void;
  onaudiostart?: () => void;
  onspeechstart?: () => void;
  onsoundstart?: () => void;
  onresult?: (event: SpeechRecognitionEvent) => void;
  onspeechend?: () => void;
  onsoundend?: () => void;
  onaudioend?: () => void;
  onnomatch?: (event: SpeechRecognitionEvent) => void;
  onerror?: (event: SpeechRecognitionErrorEvent) => void;
  onend?: () => void;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface Window {
  SpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
  webkitSpeechRecognition: {
    prototype: SpeechRecognition;
    new (): SpeechRecognition;
  };
}