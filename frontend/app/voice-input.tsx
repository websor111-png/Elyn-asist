import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Vibration,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import { voiceApi, speechApi } from '../services/api';

export default function VoiceInputScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { settings } = useSettings();
  const [inputText, setInputText] = useState((params.prefill as string) || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Permisiune microfon refuzată');
        await voiceService.speak('Nu am permisiune să accesez microfonul.', {
          language: settings.preferredLanguage,
          voiceType: settings.voiceType,
        });
        return;
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      Vibration.vibrate(100);
      setIsRecording(true);
      setError('');
      setTranscribedText('');

      await voiceService.speak('Te ascult. Vorbește acum.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });

      // Start recording
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

    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError('Nu am putut porni înregistrarea');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      Vibration.vibrate(50);
      setIsRecording(false);
      setIsProcessing(true);

      await voiceService.speak('Procesez comanda ta...', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!uri) {
        throw new Error('Nu am putut obține fișierul audio');
      }

      // Read audio file as base64
      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Send to backend for transcription and processing
      const result = await speechApi.transcribeAndProcess(audioBase64, settings.preferredLanguage);

      if (result.error || !result.transcription.text) {
        throw new Error(result.error || 'Nu am înțeles ce ai spus');
      }

      setTranscribedText(result.transcription.text);
      setInputText(result.transcription.text);

      if (result.command_response) {
        setResponse(result.command_response);
        
        // Speak the response
        await voiceService.speak(result.command_response.response_text, {
          language: result.command_response.detected_language,
          voiceType: settings.voiceType,
        });

        // Handle specific actions
        handleAction(result.command_response);
      }

    } catch (err: any) {
      console.error('Error processing recording:', err);
      setError(err.message || 'Nu am putut procesa înregistrarea');
      await voiceService.speak('Îmi pare rău, nu am înțeles. Te rog încearcă din nou.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    
    Vibration.vibrate(50);
    setIsProcessing(true);
    setError('');
    setResponse(null);
    
    try {
      const result = await voiceApi.processCommand(inputText, settings.preferredLanguage);
      setResponse(result);
      
      // Speak the response
      await voiceService.speak(result.response_text, {
        language: result.detected_language,
        voiceType: settings.voiceType,
      });
      
      // Handle specific actions
      handleAction(result);
      
    } catch (err: any) {
      console.error('Error processing command:', err);
      setError('Nu am putut procesa comanda. Te rog încearcă din nou.');
      await voiceService.speak('Îmi pare rău, a apărut o eroare.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAction = (result: any) => {
    switch (result.action_type) {
      case 'time':
        voiceService.speakTime(settings.voiceType, result.detected_language);
        break;
      case 'camera':
        router.push('/camera');
        break;
      case 'find_phone':
        router.back();
        break;
      case 'settings':
        router.push('/settings');
        break;
      case 'add_contact':
        if (result.action_data?.contact_name && result.action_data?.phone_number) {
          router.push('/contacts');
        }
        break;
    }
  };

  const quickCommands = [
    { text: 'Ce oră este?', icon: 'time' },
    { text: 'Activează camera', icon: 'camera' },
    { text: 'Citește notificările', icon: 'notifications' },
    { text: 'Cât la sută baterie am?', icon: 'battery-half' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Înapoi"
          >
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Comandă Vocală</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Voice Recording Button */}
          <View style={styles.recordSection}>
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
                isProcessing && styles.recordButtonDisabled,
              ]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={isProcessing}
              accessibilityLabel={isRecording ? 'Oprește înregistrarea' : 'Ține apăsat pentru a vorbi'}
            >
              {isProcessing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <Ionicons 
                  name={isRecording ? "mic" : "mic-outline"} 
                  size={60} 
                  color="#fff" 
                />
              )}
            </TouchableOpacity>
            <Text style={styles.recordHint}>
              {isProcessing 
                ? 'Procesez...' 
                : isRecording 
                  ? 'Ascult... Eliberează când termini' 
                  : 'Ține apăsat pentru a vorbi'}
            </Text>
          </View>

          {/* Transcribed Text */}
          {transcribedText && (
            <View style={styles.transcriptionBox}>
              <Text style={styles.transcriptionLabel}>Am auzit:</Text>
              <Text style={styles.transcriptionText}>&quot;{transcribedText}&quot;</Text>
            </View>
          )}

          {/* Manual Input Area */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Sau scrie comanda:</Text>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ex: Sună pe Maria..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              accessibilityLabel="Câmp pentru comandă vocală"
            />
            <TouchableOpacity
              style={[styles.submitButton, (isProcessing || !inputText.trim()) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isProcessing || !inputText.trim()}
              accessibilityLabel="Trimite comanda"
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={24} color="#fff" />
                  <Text style={styles.submitButtonText}>Trimite</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Quick Commands */}
          <View style={styles.quickCommandsSection}>
            <Text style={styles.sectionTitle}>Comenzi rapide:</Text>
            <View style={styles.quickCommandsGrid}>
              {quickCommands.map((cmd, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickCommandButton}
                  onPress={() => {
                    setInputText(cmd.text);
                    Vibration.vibrate(30);
                  }}
                  accessibilityLabel={cmd.text}
                >
                  <Ionicons name={cmd.icon as any} size={24} color="#4f46e5" />
                  <Text style={styles.quickCommandText}>{cmd.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Response */}
          {response && (
            <View style={styles.responseContainer}>
              <Text style={styles.responseLabel}>Răspuns:</Text>
              <View style={styles.responseBox}>
                <Text style={styles.responseText}>{response.response_text}</Text>
                <View style={styles.responseMetaRow}>
                  <View style={styles.responseMeta}>
                    <Ionicons name="language" size={16} color="#4f46e5" />
                    <Text style={styles.responseMetaText}>
                      {response.detected_language?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.responseMeta}>
                    <Ionicons name="flash" size={16} color="#4f46e5" />
                    <Text style={styles.responseMetaText}>
                      {response.action_type}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  recordSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  recordButtonActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    transform: [{ scale: 1.1 }],
  },
  recordButtonDisabled: {
    backgroundColor: '#4f46e580',
  },
  recordHint: {
    color: '#a0a0a0',
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
  },
  transcriptionBox: {
    backgroundColor: '#22c55e20',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  transcriptionLabel: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  transcriptionText: {
    color: '#fff',
    fontSize: 16,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  submitButton: {
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#4f46e580',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  quickCommandsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 12,
  },
  quickCommandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickCommandButton: {
    width: '48%',
    backgroundColor: '#2d2d44',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickCommandText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  responseContainer: {
    marginBottom: 20,
  },
  responseLabel: {
    fontSize: 14,
    color: '#22c55e',
    marginBottom: 8,
    fontWeight: '500',
  },
  responseBox: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  responseText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  responseMetaRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3d3d54',
  },
  responseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  responseMetaText: {
    color: '#a0a0a0',
    fontSize: 12,
    marginLeft: 5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef444420',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
});
