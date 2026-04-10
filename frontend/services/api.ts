import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface VoiceCommandResponse {
  response_text: string;
  detected_language: string;
  action_type: string;
  action_data?: {
    contact_name?: string;
    message?: string;
    app_name?: string;
    setting_name?: string;
    setting_value?: string;
    error?: string;
  };
}

export interface ImageAnalysisResponse {
  description: string;
  objects_detected: string[];
  obstacles: string[];
  guidance: string;
}

export interface GreetingResponse {
  greeting: string;
  voice_name: string;
  voice_type: string;
  language: string;
}

export const voiceApi = {
  processCommand: async (text: string, language?: string): Promise<VoiceCommandResponse> => {
    const response = await api.post('/voice/command', { text, language });
    return response.data;
  },
};

export const visionApi = {
  analyzeImage: async (imageBase64: string, language: string = 'ro'): Promise<ImageAnalysisResponse> => {
    const response = await api.post('/vision/analyze', { image_base64: imageBase64, language });
    return response.data;
  },
};

export const settingsApi = {
  getSettings: async () => {
    const response = await api.get('/settings');
    return response.data;
  },
  
  updateSettings: async (settings: any) => {
    const response = await api.put('/settings', settings);
    return response.data;
  },
  
  getGreeting: async (): Promise<GreetingResponse> => {
    const response = await api.get('/greeting');
    return response.data;
  },
};

export default api;
