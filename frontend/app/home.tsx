import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as KeepAwake from 'expo-keep-awake';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import batteryService from '../services/batteryService';
import medicationService, { MedicationReminder } from '../services/medicationService';
import { voiceApi, medicationsApi } from '../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { settings, isLoading } = useSettings();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [lastResponse, setLastResponse] = useState('');
  const [isFindingPhone, setIsFindingPhone] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const findPhoneIntervalRef = useRef<any>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Keep screen awake (only on native platforms)
    if (Platform.OS !== 'web') {
      try {
        KeepAwake.activateKeepAwakeAsync();
      } catch (e) {
        console.log('KeepAwake not available');
      }
    }

    // Initialize services
    initializeServices();

    // App state listener
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - could trigger voice activation
        console.log('App came to foreground');
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      batteryService.stopMonitoring();
      medicationService.stopMonitoring();
      if (findPhoneIntervalRef.current) {
        clearInterval(findPhoneIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      speakGreeting();
      updateBatteryLevel();
    }
  }, [isLoading]);

  const initializeServices = async () => {
    // Battery monitoring
    batteryService.startMonitoring(10, async (level) => {
      await batteryService.speakLowBatteryWarning(
        level,
        settings.voiceType,
        settings.preferredLanguage
      );
    });

    // Medication reminders
    medicationService.startMonitoring(async (medication) => {
      const text = medicationService.generateMedicationReminderText(
        medication,
        settings.preferredLanguage
      );
      Vibration.vibrate([500, 500, 500]);
      await voiceService.speak(text, {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    });
  };

  const updateBatteryLevel = async () => {
    const level = await batteryService.getBatteryLevel();
    setBatteryLevel(level);
  };

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
    
    // Navigate to voice input screen
    setTimeout(() => {
      setIsListening(false);
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

  const handleBatteryPress = async () => {
    Vibration.vibrate(50);
    await batteryService.speakBatteryStatus(settings.voiceType, settings.preferredLanguage);
    await updateBatteryLevel();
  };

  const handleContactsPress = () => {
    Vibration.vibrate(50);
    voiceService.speak('Deschid contactele.', {
      language: settings.preferredLanguage,
      voiceType: settings.voiceType,
    });
    router.push('/contacts');
  };

  const handleMedicationsPress = () => {
    Vibration.vibrate(50);
    voiceService.speak('Deschid mementourile pentru medicamente.', {
      language: settings.preferredLanguage,
      voiceType: settings.voiceType,
    });
    router.push('/medications');
  };

  const handleFindPhone = async () => {
    Vibration.vibrate([100, 200, 100, 200, 100]);
    setIsFindingPhone(true);
    
    // Speak repeatedly
    const speakLoop = async () => {
      await voiceService.speakFindPhone(
        settings.voiceName,
        settings.voiceType,
        settings.preferredLanguage
      );
    };
    
    speakLoop();
    findPhoneIntervalRef.current = setInterval(speakLoop, 3000);
  };

  const stopFindPhone = async () => {
    setIsFindingPhone(false);
    if (findPhoneIntervalRef.current) {
      clearInterval(findPhoneIntervalRef.current);
      findPhoneIntervalRef.current = null;
    }
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
          <Text style={styles.avatarLetter}>E</Text>
        </View>
        <Text style={styles.assistantName}>{settings.voiceName}</Text>
        <Text style={styles.assistantSubtitle}>Asistentul tău vocal</Text>
        {batteryLevel !== null && (
          <View style={styles.batteryIndicator}>
            <Ionicons 
              name={batteryLevel <= 20 ? "battery-dead" : batteryLevel <= 50 ? "battery-half" : "battery-full"} 
              size={16} 
              color={batteryLevel <= 10 ? "#ef4444" : "#22c55e"} 
            />
            <Text style={[styles.batteryText, batteryLevel <= 10 && styles.batteryLow]}>
              {batteryLevel}%
            </Text>
          </View>
        )}
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

      {/* Main Action Button */}
      <View style={styles.mainActions}>
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

      {/* Quick Actions - Row 1 */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleCameraPress}
          accessibilityLabel="Cameră pentru navigare"
        >
          <Ionicons name="camera" size={32} color="#fff" />
          <Text style={styles.actionButtonText}>Cameră</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleTimePress}
          accessibilityLabel="Spune ora curentă"
        >
          <Ionicons name="time" size={32} color="#fff" />
          <Text style={styles.actionButtonText}>Ora</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleBatteryPress}
          accessibilityLabel="Verifică bateria"
        >
          <Ionicons name="battery-half" size={32} color="#fff" />
          <Text style={styles.actionButtonText}>Baterie</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions - Row 2 */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleContactsPress}
          accessibilityLabel="Deschide contactele"
        >
          <Ionicons name="people" size={32} color="#fff" />
          <Text style={styles.actionButtonText}>Contacte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleMedicationsPress}
          accessibilityLabel="Mementouri medicamente"
        >
          <Ionicons name="medical" size={32} color="#fff" />
          <Text style={styles.actionButtonText}>Medicamente</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSettingsPress}
          accessibilityLabel="Deschide setările"
        >
          <Ionicons name="settings" size={32} color="#fff" />
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
          <Text style={styles.findPhoneText}>Strigă &quot;{settings.voiceName}, unde ești?&quot;</Text>
        </TouchableOpacity>
      )}

      {/* Brand Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>Brend Elyn</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    padding: 15,
  },
  header: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  assistantAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1a56db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarLetter: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  assistantName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  assistantSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 2,
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#2d2d44',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  batteryText: {
    color: '#22c55e',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  batteryLow: {
    color: '#ef4444',
  },
  statusContainer: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#ef4444',
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '600',
  },
  responseText: {
    color: '#a0a0a0',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
  },
  mainActions: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 15,
  },
  micButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
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
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  actionButton: {
    width: 90,
    height: 80,
    borderRadius: 15,
    backgroundColor: '#2d2d44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  findPhoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d44',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 5,
  },
  findPhoneButtonActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 5,
  },
  findPhoneText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
  },
  footerBrand: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
