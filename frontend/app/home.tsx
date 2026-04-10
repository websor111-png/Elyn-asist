import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform, AppState, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import batteryService from '../services/batteryService';
import medicationService from '../services/medicationService';
import { speechApi, voiceApi, contactsApi } from '../services/api';

export default function HomeScreen() {
  const { settings, isLoading } = useSettings();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Ascult...');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const appState = useRef(AppState.currentState);
  const isRecordingRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);

  useEffect(() => {
    initializeApp();
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - restart listening
        startContinuousListening();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopListening();
      batteryService.stopMonitoring();
      medicationService.stopMonitoring();
    };
  }, []);

  useEffect(() => {
    if (!isLoading && settings.voiceName) {
      // Speak greeting when app starts
      speakGreeting();
    }
  }, [isLoading, settings.voiceName]);

  const initializeApp = async () => {
    // Request microphone permission
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      await voiceService.speak('Am nevoie de permisiune pentru microfon pentru a te putea auzi.', {
        language: 'ro',
        voiceType: settings.voiceType || 'female',
      });
      return;
    }

    // Configure audio
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Start battery monitoring
    batteryService.startMonitoring(10, async (level) => {
      await batteryService.speakLowBatteryWarning(level, settings.voiceType, settings.preferredLanguage);
    });

    // Start medication monitoring
    medicationService.startMonitoring(async (medication) => {
      const text = medicationService.generateMedicationReminderText(medication, settings.preferredLanguage);
      Vibration.vibrate([500, 500, 500, 500, 500]);
      await voiceService.speak(text, {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    });
  };

  const speakGreeting = async () => {
    try {
      const voiceName = settings.voiceName || 'Ely';
      const voiceType = settings.voiceType || 'female';
      const language = settings.preferredLanguage || 'ro';

      await voiceService.speak(
        `Bună! Eu sunt ${voiceName}, asistentul tău vocal. Spune numele meu oricând ai nevoie de ajutor. De exemplu: ${voiceName}, ce oră este?`,
        { language, voiceType }
      );

      // Start listening after greeting
      setTimeout(() => {
        startContinuousListening();
      }, 1000);
    } catch (error) {
      console.error('Error speaking greeting:', error);
      startContinuousListening();
    }
  };

  const startContinuousListening = async () => {
    if (isRecordingRef.current || isProcessing) return;
    
    try {
      setIsListening(true);
      setStatusText('Ascult...');
      isRecordingRef.current = true;

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;

      // Auto-stop after 5 seconds of recording to process
      silenceTimerRef.current = setTimeout(async () => {
        await processRecording();
      }, 5000);

    } catch (error) {
      console.error('Error starting continuous listening:', error);
      isRecordingRef.current = false;
      // Retry after a delay
      setTimeout(startContinuousListening, 2000);
    }
  };

  const stopListening = async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {
        console.log('Recording already stopped');
      }
      recordingRef.current = null;
    }
    isRecordingRef.current = false;
    setIsListening(false);
  };

  const processRecording = async () => {
    if (!recordingRef.current) {
      startContinuousListening();
      return;
    }

    try {
      // Stop current recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      isRecordingRef.current = false;

      if (!uri) {
        startContinuousListening();
        return;
      }

      // Check if audio has content (file size check)
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists || (fileInfo as any).size < 5000) {
        // Too small, probably silence - restart listening
        startContinuousListening();
        return;
      }

      setIsProcessing(true);
      setStatusText('Procesez...');

      // Read audio as base64
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Transcribe
      const result = await speechApi.transcribeAndProcess(audioBase64, settings.preferredLanguage);

      if (result.transcription?.text) {
        const text = result.transcription.text.toLowerCase();
        const voiceName = (settings.voiceName || 'Ely').toLowerCase();

        // Check if wake word was detected
        if (text.includes(voiceName) || text.includes('ely') || text.includes('elyn')) {
          Vibration.vibrate(100);
          
          if (result.command_response) {
            // Speak the response
            await voiceService.speak(result.command_response.response_text, {
              language: result.command_response.detected_language || settings.preferredLanguage,
              voiceType: settings.voiceType,
            });

            // Handle actions
            await handleAction(result.command_response);
          }
        }
      }

    } catch (error) {
      console.error('Error processing recording:', error);
    } finally {
      setIsProcessing(false);
      // Restart listening
      setTimeout(startContinuousListening, 500);
    }
  };

  const handleAction = async (response: any) => {
    const { action_type, action_data } = response;
    const voiceType = settings.voiceType;
    const language = response.detected_language || settings.preferredLanguage;

    switch (action_type) {
      case 'time':
        await voiceService.speakTime(voiceType, language);
        break;

      case 'find_phone':
        // Keep speaking until user says stop
        Vibration.vibrate([100, 200, 100, 200, 100, 200]);
        for (let i = 0; i < 5; i++) {
          await voiceService.speakFindPhone(settings.voiceName, voiceType, language);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        break;

      case 'battery_status':
        await batteryService.speakBatteryStatus(voiceType, language);
        break;

      case 'add_contact':
        if (action_data?.contact_name && action_data?.phone_number) {
          try {
            await contactsApi.createContact(action_data.contact_name, action_data.phone_number);
            await voiceService.speak(`Am adăugat contactul ${action_data.contact_name}.`, { language, voiceType });
          } catch (e) {
            await voiceService.speak('Nu am putut adăuga contactul.', { language, voiceType });
          }
        }
        break;

      case 'call':
        if (action_data?.contact_name) {
          await voiceService.speak(`Încerc să sun pe ${action_data.contact_name}.`, { language, voiceType });
          // In a real app, this would initiate a phone call
        }
        break;

      case 'sms':
        if (action_data?.contact_name && action_data?.message) {
          await voiceService.speak(`Trimit mesaj lui ${action_data.contact_name}: ${action_data.message}`, { language, voiceType });
          // In a real app, this would send an SMS
        }
        break;

      case 'camera':
        await voiceService.speak('Funcția de cameră este activată. Te voi ghida prin ce văd.', { language, voiceType });
        // Would activate camera and provide audio guidance
        break;

      case 'read_notifications':
        await voiceService.speak('Verifică notificările... Nu ai notificări noi.', { language, voiceType });
        break;

      case 'help':
        await voiceService.speak(
          `Poți să-mi spui: ${settings.voiceName} ce oră este, ${settings.voiceName} sună pe Maria, ${settings.voiceName} unde ești, ${settings.voiceName} cât la sută baterie am, sau ${settings.voiceName} activează camera.`,
          { language, voiceType }
        );
        break;

      default:
        // Response already spoken
        break;
    }
  };

  return (
    <View style={styles.container} accessible={true} accessibilityLabel="Elyn Voice Assistant - Ascultă permanent pentru comenzi vocale">
      {/* Minimal visual - just the brand */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>E</Text>
      </View>

      <View style={styles.brandContainer}>
        <Text style={styles.brandName}>Brend Elyn</Text>
        <Text style={styles.creator}>Creiat de Ciorpac Sorin</Text>
      </View>

      {/* Status indicator for debugging - could be hidden in production */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusDot, isListening && styles.statusDotActive, isProcessing && styles.statusDotProcessing]} />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a56db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  logoText: {
    fontSize: 140,
    fontWeight: 'bold',
    color: '#1a56db',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  brandContainer: {
    marginTop: 40,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  creator: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 10,
    fontStyle: 'italic',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#666',
    marginRight: 10,
  },
  statusDotActive: {
    backgroundColor: '#22c55e',
  },
  statusDotProcessing: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
});
