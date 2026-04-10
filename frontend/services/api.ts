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
    phone_number?: string;
    message?: string;
    app_name?: string;
    setting_name?: string;
    setting_value?: string;
    medication_name?: string;
    medication_dosage?: string;
    medication_time?: string;
    medication_days?: string[];
    error?: string;
  };
}

export interface ImageAnalysisResponse {
  description: string;
  objects_detected: string[];
  obstacles: string[];
  guidance: string;
  medication_location?: string;
}

export interface GreetingResponse {
  greeting: string;
  voice_name: string;
  voice_type: string;
  language: string;
  brand: string;
  creator: string;
}

export interface Contact {
  id: string;
  name: string;
  phone_number: string;
  created_at: string;
}

export interface MedicationReminder {
  id: string;
  medication_name: string;
  dosage: string;
  reminder_time: string;
  days: string[];
  notes?: string;
  location_description?: string;
  is_active: boolean;
}

export const voiceApi = {
  processCommand: async (text: string, language?: string): Promise<VoiceCommandResponse> => {
    const response = await api.post('/voice/command', { text, language });
    return response.data;
  },
};

export const visionApi = {
  analyzeImage: async (imageBase64: string, language: string = 'ro', context?: string): Promise<ImageAnalysisResponse> => {
    const response = await api.post('/vision/analyze', { image_base64: imageBase64, language, context });
    return response.data;
  },
};

export const contactsApi = {
  getContacts: async (): Promise<Contact[]> => {
    const response = await api.get('/contacts');
    return response.data;
  },
  
  createContact: async (name: string, phone_number: string): Promise<Contact> => {
    const response = await api.post('/contacts', { name, phone_number });
    return response.data;
  },
  
  deleteContact: async (id: string): Promise<void> => {
    await api.delete(`/contacts/${id}`);
  },
};

export const medicationsApi = {
  getMedications: async (): Promise<MedicationReminder[]> => {
    const response = await api.get('/medications');
    return response.data;
  },
  
  createMedication: async (medication: Omit<MedicationReminder, 'id' | 'is_active'>): Promise<MedicationReminder> => {
    const response = await api.post('/medications', medication);
    return response.data;
  },
  
  updateMedication: async (id: string, medication: Omit<MedicationReminder, 'id' | 'is_active'>): Promise<MedicationReminder> => {
    const response = await api.put(`/medications/${id}`, medication);
    return response.data;
  },
  
  deleteMedication: async (id: string): Promise<void> => {
    await api.delete(`/medications/${id}`);
  },
  
  getDueMedications: async (): Promise<MedicationReminder[]> => {
    const response = await api.get('/medications/due');
    return response.data;
  },
};

export const smsApi = {
  sendSms: async (contact_name: string | null, phone_number: string | null, message: string): Promise<any> => {
    const response = await api.post('/sms/send', { contact_name, phone_number, message });
    return response.data;
  },
  
  getSmsHistory: async (): Promise<any[]> => {
    const response = await api.get('/sms/history');
    return response.data;
  },
};

// Speech-to-Text API
export interface TranscriptionResult {
  text: string;
  detected_language: string;
  confidence: number;
}

export interface TranscribeAndProcessResult {
  transcription: TranscriptionResult;
  command_response: VoiceCommandResponse | null;
  error?: string;
}

export const speechApi = {
  transcribe: async (audioBase64: string, language?: string): Promise<TranscriptionResult> => {
    const response = await api.post('/speech/transcribe', { 
      audio_base64: audioBase64, 
      language 
    });
    return response.data;
  },
  
  transcribeAndProcess: async (audioBase64: string, language?: string): Promise<TranscribeAndProcessResult> => {
    const response = await api.post('/speech/transcribe-and-process', { 
      audio_base64: audioBase64, 
      language 
    });
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
  
  getBrandInfo: async () => {
    const response = await api.get('/brand');
    return response.data;
  },
};

export default api;
