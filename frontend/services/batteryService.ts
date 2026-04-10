import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import voiceService from './voiceService';

class BatteryService {
  private subscription: any = null;
  private lastAlertLevel: number = 100;
  private alertThreshold: number = 10;
  private onLowBattery: ((level: number) => void) | null = null;

  async getBatteryLevel(): Promise<number> {
    try {
      const level = await Battery.getBatteryLevelAsync();
      return Math.round(level * 100);
    } catch (error) {
      console.error('Error getting battery level:', error);
      return -1;
    }
  }

  async getBatteryState(): Promise<string> {
    try {
      const state = await Battery.getBatteryStateAsync();
      switch (state) {
        case Battery.BatteryState.CHARGING:
          return 'charging';
        case Battery.BatteryState.FULL:
          return 'full';
        case Battery.BatteryState.UNPLUGGED:
          return 'unplugged';
        default:
          return 'unknown';
      }
    } catch (error) {
      console.error('Error getting battery state:', error);
      return 'unknown';
    }
  }

  startMonitoring(
    threshold: number = 10,
    onLowBattery: (level: number) => void
  ): void {
    this.alertThreshold = threshold;
    this.onLowBattery = onLowBattery;
    this.lastAlertLevel = 100;

    // Check periodically
    this.subscription = setInterval(async () => {
      const level = await this.getBatteryLevel();
      const state = await this.getBatteryState();

      if (level > 0 && level <= this.alertThreshold && 
          this.lastAlertLevel > this.alertThreshold &&
          state !== 'charging') {
        this.lastAlertLevel = level;
        if (this.onLowBattery) {
          this.onLowBattery(level);
        }
      } else if (level > this.alertThreshold) {
        this.lastAlertLevel = level;
      }
    }, 60000); // Check every minute
  }

  stopMonitoring(): void {
    if (this.subscription) {
      clearInterval(this.subscription);
      this.subscription = null;
    }
  }

  async speakBatteryStatus(voiceType: 'female' | 'male', language: string): Promise<void> {
    const level = await this.getBatteryLevel();
    const state = await this.getBatteryState();

    let statusText = '';
    if (language === 'ro') {
      statusText = `Bateria este la ${level} la sută.`;
      if (state === 'charging') {
        statusText += ' Telefonul se încarcă.';
      } else if (level <= 10) {
        statusText += ' Atenție! Trebuie să pui telefonul la încărcat.';
      }
    } else {
      statusText = `Battery is at ${level} percent.`;
      if (state === 'charging') {
        statusText += ' Phone is charging.';
      } else if (level <= 10) {
        statusText += ' Warning! You need to charge your phone.';
      }
    }

    await voiceService.speak(statusText, { language, voiceType });
  }

  async speakLowBatteryWarning(
    level: number,
    voiceType: 'female' | 'male',
    language: string
  ): Promise<void> {
    const warnings: { [key: string]: string } = {
      ro: `Atenție! Bateria este la ${level} la sută. Te rog pune telefonul la încărcat.`,
      en: `Warning! Battery is at ${level} percent. Please charge your phone.`,
      de: `Achtung! Der Akku ist bei ${level} Prozent. Bitte laden Sie Ihr Telefon auf.`,
      fr: `Attention! La batterie est à ${level} pourcent. Veuillez charger votre téléphone.`,
      es: `¡Atención! La batería está al ${level} por ciento. Por favor carga tu teléfono.`,
      it: `Attenzione! La batteria è al ${level} percento. Per favore carica il telefono.`,
    };

    const text = warnings[language] || warnings['ro'];
    await voiceService.speak(text, { language, voiceType });
  }
}

export const batteryService = new BatteryService();
export default batteryService;
