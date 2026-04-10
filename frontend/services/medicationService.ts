import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MedicationReminder {
  id: string;
  medication_name: string;
  dosage: string;
  reminder_time: string;
  days: string[];
  notes?: string;
  location_description?: string;
  is_active: boolean;
}

class MedicationService {
  private checkInterval: any = null;
  private onMedicationDue: ((medication: MedicationReminder) => void) | null = null;
  private lastNotifiedTime: string = '';

  async getMedications(): Promise<MedicationReminder[]> {
    try {
      const stored = await AsyncStorage.getItem('medications');
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.error('Error getting medications:', error);
      return [];
    }
  }

  async saveMedication(medication: MedicationReminder): Promise<void> {
    try {
      const medications = await this.getMedications();
      const existingIndex = medications.findIndex(m => m.id === medication.id);
      
      if (existingIndex >= 0) {
        medications[existingIndex] = medication;
      } else {
        medications.push(medication);
      }
      
      await AsyncStorage.setItem('medications', JSON.stringify(medications));
    } catch (error) {
      console.error('Error saving medication:', error);
    }
  }

  async deleteMedication(id: string): Promise<void> {
    try {
      const medications = await this.getMedications();
      const filtered = medications.filter(m => m.id !== id);
      await AsyncStorage.setItem('medications', JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting medication:', error);
    }
  }

  async updateMedicationLocation(id: string, location: string): Promise<void> {
    try {
      const medications = await this.getMedications();
      const medication = medications.find(m => m.id === id);
      if (medication) {
        medication.location_description = location;
        await AsyncStorage.setItem('medications', JSON.stringify(medications));
      }
    } catch (error) {
      console.error('Error updating medication location:', error);
    }
  }

  startMonitoring(onMedicationDue: (medication: MedicationReminder) => void): void {
    this.onMedicationDue = onMedicationDue;
    
    // Check every minute
    this.checkInterval = setInterval(async () => {
      await this.checkDueMedications();
    }, 60000);

    // Also check immediately
    this.checkDueMedications();
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkDueMedications(): Promise<void> {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Don't notify for the same time twice
    if (this.lastNotifiedTime === currentTime) {
      return;
    }

    const medications = await this.getMedications();
    
    for (const med of medications) {
      if (!med.is_active) continue;
      
      // Check if today is a reminder day
      const isDueDay = med.days.includes('daily') || med.days.includes(currentDay);
      if (!isDueDay) continue;

      // Check if it's the right time (within 1 minute)
      if (med.reminder_time === currentTime) {
        this.lastNotifiedTime = currentTime;
        if (this.onMedicationDue) {
          this.onMedicationDue(med);
        }
      }
    }
  }

  generateMedicationReminderText(medication: MedicationReminder, language: string): string {
    const texts: { [key: string]: string } = {
      ro: `Este ora să iei ${medication.medication_name}. Doza: ${medication.dosage}.${medication.location_description ? ` Medicamentele se află ${medication.location_description}.` : ''}${medication.notes ? ` ${medication.notes}` : ''}`,
      en: `It's time to take ${medication.medication_name}. Dosage: ${medication.dosage}.${medication.location_description ? ` Medication is located ${medication.location_description}.` : ''}${medication.notes ? ` ${medication.notes}` : ''}`,
      de: `Es ist Zeit, ${medication.medication_name} einzunehmen. Dosis: ${medication.dosage}.${medication.location_description ? ` Medikament befindet sich ${medication.location_description}.` : ''}`,
      fr: `C'est l'heure de prendre ${medication.medication_name}. Dosage: ${medication.dosage}.${medication.location_description ? ` Le médicament se trouve ${medication.location_description}.` : ''}`,
      es: `Es hora de tomar ${medication.medication_name}. Dosis: ${medication.dosage}.${medication.location_description ? ` El medicamento está ${medication.location_description}.` : ''}`,
      it: `È ora di prendere ${medication.medication_name}. Dosaggio: ${medication.dosage}.${medication.location_description ? ` Il medicinale si trova ${medication.location_description}.` : ''}`,
    };

    return texts[language] || texts['ro'];
  }
}

export const medicationService = new MedicationService();
export default medicationService;
