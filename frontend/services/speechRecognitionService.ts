import { Audio } from 'expo-av';
import { Platform } from 'react-native';

class SpeechRecognitionService {
  private recording: Audio.Recording | null = null;
  private isListening: boolean = false;
  private onResult: ((text: string) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  async startListening(
    onResult: (text: string) => void,
    onError: (error: string) => void
  ): Promise<boolean> {
    if (this.isListening) {
      return false;
    }

    this.onResult = onResult;
    this.onError = onError;

    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        onError('Permisiune audio refuzată');
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await this.recording.startAsync();
      this.isListening = true;
      
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      onError('Nu am putut porni înregistrarea');
      return false;
    }
  }

  async stopListening(): Promise<string | null> {
    if (!this.isListening || !this.recording) {
      return null;
    }

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.isListening = false;
      this.recording = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      this.isListening = false;
      this.recording = null;
      return null;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new SpeechRecognitionService();
export default speechRecognition;
