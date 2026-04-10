import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Settings {
  voiceType: 'female' | 'male';
  voiceName: string;
  preferredLanguage: string;
  voiceSampleRegistered: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: Settings = {
  voiceType: 'female',
  voiceName: 'Ely',
  preferredLanguage: 'ro',
  voiceSampleRegistered: false,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('ely_settings');
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      
      // Update voice name based on type
      if (newSettings.voiceType === 'female') {
        updated.voiceName = 'Ely';
      } else if (newSettings.voiceType === 'male') {
        updated.voiceName = 'Elyn';
      }
      
      setSettings(updated);
      await AsyncStorage.setItem('ely_settings', JSON.stringify(updated));
      
      // Also sync with backend
      const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_type: updated.voiceType,
          voice_name: updated.voiceName,
          preferred_language: updated.preferredLanguage,
          voice_sample_registered: updated.voiceSampleRegistered,
        }),
      });
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
