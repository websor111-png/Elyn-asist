import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import { voiceApi } from '../services/api';

export default function VoiceInputScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState('');

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
        // Go back and trigger find phone
        router.back();
        break;
      case 'settings':
        router.push('/settings');
        break;
      // Add more action handlers as needed
    }
  };

  const quickCommands = [
    { text: 'Ce oră este?', icon: 'time' },
    { text: 'Activează camera', icon: 'camera' },
    { text: 'Citește notificările', icon: 'notifications' },
    { text: 'Deschide setările', icon: 'settings' },
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
          {/* Input Area */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Scrie sau spune comanda ta:</Text>
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
              style={[styles.submitButton, isProcessing && styles.submitButtonDisabled]}
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
                      {response.detected_language.toUpperCase()}
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
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 18,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 15,
  },
  submitButtonDisabled: {
    backgroundColor: '#4f46e580',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  quickCommandsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 15,
  },
  quickCommandsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickCommandButton: {
    width: '48%',
    backgroundColor: '#2d2d44',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickCommandText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  responseContainer: {
    marginBottom: 20,
  },
  responseLabel: {
    fontSize: 16,
    color: '#22c55e',
    marginBottom: 10,
    fontWeight: '500',
  },
  responseBox: {
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
  },
  responseText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  responseMetaRow: {
    flexDirection: 'row',
    marginTop: 15,
    paddingTop: 15,
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
