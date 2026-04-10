import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();

  const languages = [
    { code: 'ro', name: 'Română', flag: '🇷🇴' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  ];

  const handleVoiceChange = async (type: 'female' | 'male') => {
    Vibration.vibrate(50);
    await updateSettings({ voiceType: type });
    const name = type === 'female' ? 'Ely' : 'Elyn';
    await voiceService.speak(
      `Bună! Acum sunt ${name}. Îmi place să te ajut!`,
      {
        language: settings.preferredLanguage,
        voiceType: type,
      }
    );
  };

  const handleLanguageChange = async (code: string) => {
    Vibration.vibrate(50);
    await updateSettings({ preferredLanguage: code });
    
    const confirmations: { [key: string]: string } = {
      ro: 'Am schimbat limba în română.',
      en: 'Language changed to English.',
      de: 'Sprache auf Deutsch geändert.',
      fr: 'Langue changée en français.',
      es: 'Idioma cambiado a español.',
      it: 'Lingua cambiata in italiano.',
    };
    
    await voiceService.speak(confirmations[code], {
      language: code,
      voiceType: settings.voiceType,
    });
  };

  const testVoice = async () => {
    Vibration.vibrate(50);
    await voiceService.speakGreeting(
      settings.voiceName,
      settings.voiceType,
      settings.preferredLanguage
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Înapoi"
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Setări</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Voice Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voce Asistent</Text>
          <Text style={styles.sectionSubtitle}>
            Alege vocea preferată pentru asistentul tău
          </Text>
          
          <View style={styles.voiceOptions}>
            <TouchableOpacity
              style={[
                styles.voiceOption,
                settings.voiceType === 'female' && styles.voiceOptionSelected,
              ]}
              onPress={() => handleVoiceChange('female')}
              accessibilityLabel="Selectează vocea feminină Ely"
            >
              <View style={styles.voiceAvatar}>
                <Ionicons 
                  name="person-circle" 
                  size={50} 
                  color={settings.voiceType === 'female' ? '#4f46e5' : '#666'} 
                />
              </View>
              <Text style={[
                styles.voiceName,
                settings.voiceType === 'female' && styles.voiceNameSelected,
              ]}>
                Ely
              </Text>
              <Text style={styles.voiceDescription}>Voce feminină</Text>
              {settings.voiceType === 'female' && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.voiceOption,
                settings.voiceType === 'male' && styles.voiceOptionSelected,
              ]}
              onPress={() => handleVoiceChange('male')}
              accessibilityLabel="Selectează vocea masculină Elyn"
            >
              <View style={styles.voiceAvatar}>
                <Ionicons 
                  name="person-circle-outline" 
                  size={50} 
                  color={settings.voiceType === 'male' ? '#4f46e5' : '#666'} 
                />
              </View>
              <Text style={[
                styles.voiceName,
                settings.voiceType === 'male' && styles.voiceNameSelected,
              ]}>
                Elyn
              </Text>
              <Text style={styles.voiceDescription}>Voce masculină</Text>
              {settings.voiceType === 'male' && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.testButton}
            onPress={testVoice}
            accessibilityLabel="Testează vocea"
          >
            <Ionicons name="volume-high" size={24} color="#4f46e5" />
            <Text style={styles.testButtonText}>Testează vocea</Text>
          </TouchableOpacity>
        </View>

        {/* Language Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limbă Preferată</Text>
          <Text style={styles.sectionSubtitle}>
            AI-ul va detecta automat limba, dar poți seta o preferință
          </Text>
          
          <View style={styles.languageGrid}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.languageOption,
                  settings.preferredLanguage === lang.code && styles.languageOptionSelected,
                ]}
                onPress={() => handleLanguageChange(lang.code)}
                accessibilityLabel={`Selectează ${lang.name}`}
              >
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <Text style={[
                  styles.languageName,
                  settings.preferredLanguage === lang.code && styles.languageNameSelected,
                ]}>
                  {lang.name}
                </Text>
                {settings.preferredLanguage === lang.code && (
                  <Ionicons name="checkmark" size={18} color="#22c55e" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ajutor</Text>
          
          <View style={styles.helpItem}>
            <Ionicons name="mic" size={24} color="#4f46e5" />
            <View style={styles.helpContent}>
              <Text style={styles.helpTitle}>Comenzi vocale</Text>
              <Text style={styles.helpText}>
                Poți spune: "Sună pe [nume]", "Trimite mesaj", "Ce oră este?", "Deschide [aplicație]"
              </Text>
            </View>
          </View>

          <View style={styles.helpItem}>
            <Ionicons name="camera" size={24} color="#4f46e5" />
            <View style={styles.helpContent}>
              <Text style={styles.helpTitle}>Ghidare vizuală</Text>
              <Text style={styles.helpText}>
                Folosește camera pentru a recunoaște obiecte și obstacole din jur
              </Text>
            </View>
          </View>

          <View style={styles.helpItem}>
            <Ionicons name="search" size={24} color="#4f46e5" />
            <View style={styles.helpContent}>
              <Text style={styles.helpTitle}>Găsește telefonul</Text>
              <Text style={styles.helpText}>
                Strigă "{settings.voiceName}, unde ești?" iar telefonul va răspunde
              </Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={[styles.section, styles.aboutSection]}>
          <Text style={styles.aboutTitle}>Ely/Elyn Voice Assistant</Text>
          <Text style={styles.aboutText}>
            Aplicație gratuită de asistență vocală pentru persoane nevăzătoare
          </Text>
          <Text style={styles.versionText}>Versiunea 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    width: 44,
    height: 44,
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
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    marginBottom: 15,
  },
  voiceOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voiceOption: {
    width: '48%',
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  voiceOptionSelected: {
    borderWidth: 2,
    borderColor: '#4f46e5',
  },
  voiceAvatar: {
    marginBottom: 10,
  },
  voiceName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  voiceNameSelected: {
    color: '#4f46e5',
  },
  voiceDescription: {
    fontSize: 12,
    color: '#a0a0a0',
    marginTop: 4,
  },
  selectedBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d44',
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
  },
  testButtonText: {
    color: '#4f46e5',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  languageOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  languageOptionSelected: {
    borderWidth: 2,
    borderColor: '#4f46e5',
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 10,
  },
  languageName: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  languageNameSelected: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  helpItem: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  helpContent: {
    flex: 1,
    marginLeft: 15,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 14,
    color: '#a0a0a0',
    lineHeight: 20,
  },
  aboutSection: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  aboutText: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginTop: 5,
  },
  versionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
  },
});
