import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

interface SpeakOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  voiceType?: 'female' | 'male';
}

const languageVoiceMap: { [key: string]: { ios: string; android: string } } = {
  ro: { ios: 'ro-RO', android: 'ro-RO' },
  en: { ios: 'en-US', android: 'en-US' },
  de: { ios: 'de-DE', android: 'de-DE' },
  fr: { ios: 'fr-FR', android: 'fr-FR' },
  es: { ios: 'es-ES', android: 'es-ES' },
  it: { ios: 'it-IT', android: 'it-IT' },
};

class VoiceService {
  private isSpeaking: boolean = false;
  private speakQueue: string[] = [];

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    const { language = 'ro', pitch = 1.0, rate = 0.9, voiceType = 'female' } = options;
    
    // Stop any current speech
    await this.stop();
    
    const voiceConfig = languageVoiceMap[language] || languageVoiceMap['en'];
    const voiceLang = Platform.OS === 'ios' ? voiceConfig.ios : voiceConfig.android;
    
    // Adjust pitch for male/female voice effect
    const adjustedPitch = voiceType === 'male' ? 0.85 : 1.1;
    
    return new Promise((resolve, reject) => {
      this.isSpeaking = true;
      
      Speech.speak(text, {
        language: voiceLang,
        pitch: adjustedPitch,
        rate: rate,
        onDone: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: (error) => {
          this.isSpeaking = false;
          reject(error);
        },
        onStopped: () => {
          this.isSpeaking = false;
          resolve();
        },
      });
    });
  }

  async stop(): Promise<void> {
    if (this.isSpeaking) {
      await Speech.stop();
      this.isSpeaking = false;
    }
  }

  async speakGreeting(voiceName: string, voiceType: 'female' | 'male', language: string = 'ro'): Promise<void> {
    const greetings: { [key: string]: string } = {
      ro: `Bună! Eu sunt ${voiceName}, asistentul tău vocal. Spune-mi ce pot face pentru tine.`,
      en: `Hello! I am ${voiceName}, your voice assistant. Tell me what I can do for you.`,
      de: `Hallo! Ich bin ${voiceName}, dein Sprachassistent. Sag mir, was ich für dich tun kann.`,
      fr: `Bonjour! Je suis ${voiceName}, ton assistant vocal. Dis-moi ce que je peux faire pour toi.`,
      es: `¡Hola! Soy ${voiceName}, tu asistente de voz. Dime qué puedo hacer por ti.`,
      it: `Ciao! Sono ${voiceName}, il tuo assistente vocale. Dimmi cosa posso fare per te.`,
    };
    
    const greeting = greetings[language] || greetings['ro'];
    await this.speak(greeting, { language, voiceType });
  }

  async speakTime(voiceType: 'female' | 'male', language: string = 'ro'): Promise<void> {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    const timeTexts: { [key: string]: string } = {
      ro: `Este ora ${hours} și ${minutes} minute.`,
      en: `It's ${hours}:${minutes.toString().padStart(2, '0')}.`,
      de: `Es ist ${hours} Uhr ${minutes}.`,
      fr: `Il est ${hours} heures ${minutes}.`,
      es: `Son las ${hours} y ${minutes} minutos.`,
      it: `Sono le ${hours} e ${minutes} minuti.`,
    };
    
    const timeText = timeTexts[language] || timeTexts['ro'];
    await this.speak(timeText, { language, voiceType });
  }

  async speakFindPhone(voiceName: string, voiceType: 'female' | 'male', language: string = 'ro'): Promise<void> {
    const findTexts: { [key: string]: string } = {
      ro: `Sunt aici! Sunt ${voiceName}! Mă auzi? Sunt lângă tine!`,
      en: `I'm here! I'm ${voiceName}! Can you hear me? I'm near you!`,
      de: `Ich bin hier! Ich bin ${voiceName}! Kannst du mich hören? Ich bin in deiner Nähe!`,
      fr: `Je suis ici! Je suis ${voiceName}! Tu m'entends? Je suis près de toi!`,
      es: `¡Estoy aquí! ¡Soy ${voiceName}! ¿Me escuchas? ¡Estoy cerca de ti!`,
      it: `Sono qui! Sono ${voiceName}! Mi senti? Sono vicino a te!`,
    };
    
    const findText = findTexts[language] || findTexts['ro'];
    await this.speak(findText, { language, voiceType, rate: 1.0 });
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const voiceService = new VoiceService();
export default voiceService;
