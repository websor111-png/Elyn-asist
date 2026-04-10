import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SpeakOptions {
  language?: string;
  voiceType?: 'female' | 'male';
  speed?: number;
}

class RealisticVoiceService {
  private sound: Audio.Sound | null = null;
  private isSpeaking: boolean = false;
  private speakQueue: Array<{ text: string; options: SpeakOptions }> = [];
  private isProcessingQueue: boolean = false;

  async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    const { voiceType = 'female', speed = 1.0 } = options;
    
    // Add to queue
    this.speakQueue.push({ text, options });
    
    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.speakQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const { text, options } = this.speakQueue.shift()!;
    
    try {
      await this.speakNow(text, options);
    } catch (error) {
      console.error('Error speaking:', error);
    }
    
    // Process next in queue
    await this.processQueue();
  }

  private async speakNow(text: string, options: SpeakOptions = {}): Promise<void> {
    const { voiceType = 'female', speed = 1.0 } = options;
    
    // Stop any current speech
    await this.stop();
    
    try {
      this.isSpeaking = true;
      
      // Call backend to generate realistic speech
      const response = await axios.post(`${BACKEND_URL}/api/speech/synthesize`, {
        text,
        voice_type: voiceType,
        speed
      }, {
        timeout: 30000
      });

      if (response.data?.audio_base64) {
        // Create a temporary file for the audio
        const audioUri = FileSystem.cacheDirectory + `speech_${Date.now()}.mp3`;
        
        // Write base64 audio to file
        await FileSystem.writeAsStringAsync(audioUri, response.data.audio_base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Configure audio mode
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
        });

        // Load and play the sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true }
        );

        this.sound = sound;

        // Wait for playback to finish
        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              resolve();
            }
          });
        });

        // Cleanup
        await sound.unloadAsync();
        this.sound = null;
        
        // Delete temp file
        try {
          await FileSystem.deleteAsync(audioUri, { idempotent: true });
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('Error in TTS:', error);
      // Fallback: just log the error, don't crash
    } finally {
      this.isSpeaking = false;
    }
  }

  async stop(): Promise<void> {
    // Clear the queue
    this.speakQueue = [];
    
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch (e) {
        // Ignore errors during stop
      }
      this.sound = null;
    }
    this.isSpeaking = false;
  }

  async speakGreeting(voiceName: string, voiceType: 'female' | 'male', language: string = 'ro'): Promise<void> {
    const greetings: { [key: string]: string } = {
      ro: `Bună! Eu sunt ${voiceName}, asistentul tău vocal. Spune numele meu oricând ai nevoie de ajutor. De exemplu: ${voiceName}, ce oră este?`,
      en: `Hello! I am ${voiceName}, your voice assistant. Say my name whenever you need help. For example: ${voiceName}, what time is it?`,
      de: `Hallo! Ich bin ${voiceName}, dein Sprachassistent. Sag meinen Namen, wenn du Hilfe brauchst.`,
      fr: `Bonjour! Je suis ${voiceName}, ton assistant vocal. Dis mon nom quand tu as besoin d'aide.`,
      es: `¡Hola! Soy ${voiceName}, tu asistente de voz. Di mi nombre cuando necesites ayuda.`,
      it: `Ciao! Sono ${voiceName}, il tuo assistente vocale. Pronuncia il mio nome quando hai bisogno di aiuto.`,
    };
    
    const greeting = greetings[language] || greetings['ro'];
    await this.speak(greeting, { voiceType });
  }

  async speakTime(voiceType: 'female' | 'male', language: string = 'ro'): Promise<void> {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    const timeTexts: { [key: string]: string } = {
      ro: `Este ora ${hours} și ${minutes} ${minutes === 1 ? 'minut' : 'minute'}.`,
      en: `It's ${hours}:${minutes.toString().padStart(2, '0')}.`,
      de: `Es ist ${hours} Uhr ${minutes}.`,
      fr: `Il est ${hours} heures ${minutes}.`,
      es: `Son las ${hours} y ${minutes} minutos.`,
      it: `Sono le ${hours} e ${minutes} minuti.`,
    };
    
    const timeText = timeTexts[language] || timeTexts['ro'];
    await this.speak(timeText, { voiceType });
  }

  async speakFindPhone(voiceName: string, voiceType: 'female' | 'male', language: string = 'ro'): Promise<void> {
    const findTexts: { [key: string]: string } = {
      ro: `Sunt aici! Sunt ${voiceName}! Mă auzi? Sunt lângă tine! Continuă să asculți vocea mea!`,
      en: `I'm here! I'm ${voiceName}! Can you hear me? I'm near you! Follow my voice!`,
      de: `Ich bin hier! Ich bin ${voiceName}! Kannst du mich hören? Folge meiner Stimme!`,
      fr: `Je suis ici! Je suis ${voiceName}! Tu m'entends? Suis ma voix!`,
      es: `¡Estoy aquí! ¡Soy ${voiceName}! ¿Me escuchas? ¡Sigue mi voz!`,
      it: `Sono qui! Sono ${voiceName}! Mi senti? Segui la mia voce!`,
    };
    
    const findText = findTexts[language] || findTexts['ro'];
    await this.speak(findText, { voiceType });
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const voiceService = new RealisticVoiceService();
export default voiceService;
