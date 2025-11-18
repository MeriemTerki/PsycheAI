// Frontend API Configuration
// These URLs are configured via environment variables for different deployment environments

export const API_CONFIG = {
  // Main orchestration API
  MAIN_API_URL: import.meta.env.VITE_MAIN_API_URL || 'http://127.0.0.1:8003',

  // Voice Agent service
  VOICE_API_URL: import.meta.env.VITE_VOICE_API_URL || 'http://127.0.0.1:8002',

  // Emotion Recognition service
  EMOTION_API_URL: import.meta.env.VITE_EMOTION_API_URL || 'http://127.0.0.1:8000',

  // Gaze Tracking service
  GAZE_API_URL: import.meta.env.VITE_GAZE_API_URL || 'http://127.0.0.1:8001',
};

// Endpoint helpers
export const ENDPOINTS = {
  // Voice Agent endpoints
  chat: () => `${API_CONFIG.VOICE_API_URL}/chat`,
  tts: () => `${API_CONFIG.VOICE_API_URL}/tts`,
  uploadTranscript: () => `${API_CONFIG.VOICE_API_URL}/upload_transcript`,
  getTranscript: () => `${API_CONFIG.VOICE_API_URL}/transcript`,

  // Gaze Tracking endpoints
  captureEyeTracking: () => `${API_CONFIG.GAZE_API_URL}/capture-eye-tracking`,
  generateGazeReport: () => `${API_CONFIG.GAZE_API_URL}/generate-eye-tracking-report`,

  // Emotion Recognition endpoints
  analyzeLiveEmotion: () => `${API_CONFIG.EMOTION_API_URL}/analyze-live-emotion`,

  // Main API endpoints
  startSession: () => `${API_CONFIG.MAIN_API_URL}/start-session`,
  getReport: () => `${API_CONFIG.MAIN_API_URL}/get-report`,
};
