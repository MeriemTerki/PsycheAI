// src/lib/api.ts
const API_BASE_URL = 'http://127.0.0.1:8003/docs#/default/diagnosis_and_treatment_diagnosis_treatment_get'; // Replace with your actual API URL

export type Message = {
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
};

export const startSession = async () => {
  const response = await fetch(`${API_BASE_URL}/session/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
};

export const sendResponse = async (sessionId: string, userResponse: string) => {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ response: userResponse }),
  });
  return response.json();
};