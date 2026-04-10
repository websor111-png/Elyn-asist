import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Vibration,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import { voiceApi } from '../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { settings, isLoading } = useSettings();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [isFindingPhone, setIsFindingPhone] = useState(false);

  useEffect(() => {
    // Speak greeting on first load
    if (!isLoading) {
      speakGreeting();
    }
  }, [isLoading]);

  const speakGreeting = async () => {
    try {
      await voiceService.speakGreeting(
        settings.voiceName,
        settings.voiceType,
        settings.preferredLanguage
      );
    } catch (error) {
      console.error('Error speaking greeting:', error);
    }
  };

  const handleMicPress = async () => {
    Vibration.vibrate(50);
    setIsListening(true);
    setStatusText('Ascult...');
    
    // Simulate voice input for now (in production, use expo-speech-recognition)
    // For demo, we'll use a simple text input modal
    setTimeout(() => {
      setIsListening(false);
      // Navigate to voice input screen
      router.push('/voice-input');
    }, 500);
  };

  const handleCameraPress = () => {
    Vibration.vibrate(50);
    voiceService.speak('Activez camera. Te voi ghida.', {
      language: settings.preferredLanguage,
      voiceType: settings.voiceType,
    });
    router.push('/camera');
  };

  const handleTimePress = async () => {
    Vibration.vibrate(50);
    await voiceService.speakTime(settings.voiceType, settings.preferredLanguage);
  };

  const handleSettingsPress = () => {
    Vibration.vibrate(50);
    voiceService.speak('Deschid setările.', {
      language: settings.preferredLanguage,
      voiceType: settings.voiceType,
    });
    router.push('/settings');
  };

  const handleFindPhone = async () => {
    Vibration.vibrate([100, 200, 100, 200, 100]);
    setIsFindingPhone(true);
    
    // Keep speaking until stopped
    const speakLoop = async () => {
      while (isFindingPhone) {
        await voiceService.speakFindPhone(
          settings.voiceName,
          settings.voiceType,
          settings.preferredLanguage
        );
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    };
    
    speakLoop();
  };

  const stopFindPhone = async () => {
    setIsFindingPhone(false);
    await voiceService.stop();
    await voiceService.speak('Te-am găsit! Mă bucur că m-ai auzit.', {
      language: settings.preferredLanguage,
      voiceType: settings.voiceType,
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Se încarcă...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.assistantAvatar}>
          <Ionicons 
            name={settings.voiceType === 'female' ? 'person-circle' : 'person-circle-outline'} 
            size={60} 
            color="#4f46e5" 
          />
        </View>
        <Text style={styles.assistantName}>{settings.voiceName}</Text>
        <Text style={styles.assistantSubtitle}>Asistentul tău vocal</Text>
      </View>

      {/* Status */}
      <View style={styles.statusContainer}>
        {isListening && (
          <View style={styles.listeningIndicator}>
            <Ionicons name="mic" size={24} color="#ef4444" />
            <Text style={styles.statusText}>Ascult...</Text>
          </View>
        )}
        {lastResponse && !isListening && (
          <Text style={styles.responseText}>{lastResponse}</Text>
        )}
      </View>

      {/* Main Action Buttons */}
      <View style={styles.mainActions}>
        {/* Big Microphone Button */}
        <TouchableOpacity
          style={[styles.micButton, isListening && styles.micButtonActive]}
          onPress={handleMicPress}
          accessibilityLabel="Apasă pentru a vorbi"
          accessibilityHint="Ține apăsat pentru a da o comandă vocală"
        >
          <Ionicons 
            name={isListening ? "mic" : "mic-outline"} 
            size={80} 
            color="#fff" 
          />
          <Text style={styles.micButtonText}>
            {isListening ? 'Ascult...' : 'Vorbește'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCameraPress}
          accessibilityLabel="Cameră pentru navigare"
        >
          <Ionicons name="camera" size={40} color="#fff" />
          <Text style={styles.actionButtonText}>Cameră</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleTimePress}
          accessibilityLabel="Spune ora curentă"
        >
          <Ionicons name="time" size={40} color="#fff" />
          <Text style={styles.actionButtonText}>Ora</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSettingsPress}
          accessibilityLabel="Deschide setările"
        >
          <Ionicons name="settings" size={40} color="#fff" />
          <Text style={styles.actionButtonText}>Setări</Text>
        </TouchableOpacity>
      </View>

      {/* Find Phone Mode */}
      {isFindingPhone ? (
        <TouchableOpacity
          style={styles.findPhoneButtonActive}
          onPress={stopFindPhone}
          accessibilityLabel="Oprește căutarea telefonului"
        >
          <Ionicons name="volume-high" size={30} color="#fff" />
          <Text style={styles.findPhoneText}>Apasă când m-ai găsit!</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.findPhoneButton}
          onPress={handleFindPhone}
          accessibilityLabel="Găsește telefonul"
        >
          <Ionicons name="search" size={24} color="#fff" />
          <Text style={styles.findPhoneText}>Strigă "{settings.voiceName}, unde ești?"</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  assistantAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  assistantName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  assistantSubtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginTop: 4,
  },
  statusContainer: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  statusText: {
    color: '#ef4444',
    fontSize: 18,
    marginLeft: 10,
    fontWeight: '600',
  },
  responseText: {
    color: '#a0a0a0',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
  },
  mainActions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  micButtonActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  micButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  actionButton: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  findPhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d44',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  findPhoneButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  findPhoneText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '500',
  },
});
