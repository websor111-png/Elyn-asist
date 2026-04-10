import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  Vibration,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import { medicationsApi, MedicationReminder } from '../services/api';

const DAYS = [
  { key: 'daily', label: 'Zilnic' },
  { key: 'monday', label: 'Lu' },
  { key: 'tuesday', label: 'Ma' },
  { key: 'wednesday', label: 'Mi' },
  { key: 'thursday', label: 'Jo' },
  { key: 'friday', label: 'Vi' },
  { key: 'saturday', label: 'Sâ' },
  { key: 'sunday', label: 'Du' },
];

export default function MedicationsScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const [medications, setMedications] = useState<MedicationReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newTime, setNewTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['daily']);
  const [newNotes, setNewNotes] = useState('');
  const [newLocation, setNewLocation] = useState('');

  useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    try {
      const data = await medicationsApi.getMedications();
      setMedications(data);
    } catch (error) {
      console.error('Error loading medications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMedication = async () => {
    if (!newMedName.trim() || !newDosage.trim()) {
      await voiceService.speak('Te rog completează numele medicamentului și doza.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
      return;
    }

    try {
      const medication = await medicationsApi.createMedication({
        medication_name: newMedName.trim(),
        dosage: newDosage.trim(),
        reminder_time: newTime,
        days: selectedDays,
        notes: newNotes.trim() || undefined,
        location_description: newLocation.trim() || undefined,
      });
      
      setMedications([...medications, medication]);
      resetForm();
      setShowAddForm(false);
      
      await voiceService.speak(`Am adăugat memento pentru ${newMedName} la ora ${newTime}.`, {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    } catch (error) {
      console.error('Error adding medication:', error);
      await voiceService.speak('Nu am putut adăuga mementoul.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    }
  };

  const resetForm = () => {
    setNewMedName('');
    setNewDosage('');
    setNewTime('08:00');
    setSelectedDays(['daily']);
    setNewNotes('');
    setNewLocation('');
  };

  const handleDeleteMedication = async (medication: MedicationReminder) => {
    Alert.alert(
      'Șterge memento',
      `Vrei să ștergi mementoul pentru ${medication.medication_name}?`,
      [
        { text: 'Nu', style: 'cancel' },
        {
          text: 'Da',
          style: 'destructive',
          onPress: async () => {
            try {
              await medicationsApi.deleteMedication(medication.id);
              setMedications(medications.filter(m => m.id !== medication.id));
              await voiceService.speak(`Am șters mementoul pentru ${medication.medication_name}.`, {
                language: settings.preferredLanguage,
                voiceType: settings.voiceType,
              });
            } catch (error) {
              console.error('Error deleting medication:', error);
            }
          },
        },
      ]
    );
  };

  const handleFindMedication = (medication: MedicationReminder) => {
    Vibration.vibrate(50);
    if (medication.location_description) {
      voiceService.speak(`${medication.medication_name} se află ${medication.location_description}.`, {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    } else {
      // Navigate to camera to scan and save location
      voiceService.speak('Deschid camera pentru a memora unde pui medicamentele.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
      router.push({
        pathname: '/camera',
        params: { mode: 'medication', medicationId: medication.id }
      });
    }
  };

  const toggleDay = (day: string) => {
    if (day === 'daily') {
      setSelectedDays(['daily']);
    } else {
      let newDays = selectedDays.filter(d => d !== 'daily');
      if (newDays.includes(day)) {
        newDays = newDays.filter(d => d !== day);
      } else {
        newDays.push(day);
      }
      setSelectedDays(newDays.length > 0 ? newDays : ['daily']);
    }
  };

  const formatDays = (days: string[]) => {
    if (days.includes('daily')) return 'Zilnic';
    return days.map(d => DAYS.find(day => day.key === d)?.label || d).join(', ');
  };

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
          <Text style={styles.title}>Medicamente</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setShowAddForm(!showAddForm);
              Vibration.vibrate(50);
            }}
            accessibilityLabel="Adaugă memento"
          >
            <Ionicons name={showAddForm ? "close" : "add"} size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Add Medication Form */}
          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.formTitle}>Adaugă Memento Medicament</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Numele medicamentului"
                placeholderTextColor="#666"
                value={newMedName}
                onChangeText={setNewMedName}
                accessibilityLabel="Numele medicamentului"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Doza (ex: 1 pastilă, 5ml)"
                placeholderTextColor="#666"
                value={newDosage}
                onChangeText={setNewDosage}
                accessibilityLabel="Doza medicamentului"
              />
              
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Ora:</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="HH:MM"
                  placeholderTextColor="#666"
                  value={newTime}
                  onChangeText={setNewTime}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Ora pentru memento"
                />
              </View>
              
              <Text style={styles.daysLabel}>Zile:</Text>
              <View style={styles.daysContainer}>
                {DAYS.map((day) => (
                  <TouchableOpacity
                    key={day.key}
                    style={[
                      styles.dayButton,
                      selectedDays.includes(day.key) && styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleDay(day.key)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      selectedDays.includes(day.key) && styles.dayButtonTextSelected,
                    ]}>
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TextInput
                style={styles.input}
                placeholder="Note (opțional)"
                placeholderTextColor="#666"
                value={newNotes}
                onChangeText={setNewNotes}
                accessibilityLabel="Note pentru medicament"
              />
              
              <TextInput
                style={styles.input}
                placeholder="Unde sunt medicamentele? (opțional)"
                placeholderTextColor="#666"
                value={newLocation}
                onChangeText={setNewLocation}
                accessibilityLabel="Locația medicamentelor"
              />
              
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddMedication}
                accessibilityLabel="Salvează mementoul"
              >
                <Ionicons name="checkmark" size={24} color="#fff" />
                <Text style={styles.saveButtonText}>Salvează</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Medications List */}
          {medications.length === 0 && !showAddForm ? (
            <View style={styles.emptyState}>
              <Ionicons name="medical-outline" size={60} color="#4f46e5" />
              <Text style={styles.emptyText}>Nu ai mementouri pentru medicamente</Text>
              <Text style={styles.emptySubtext}>
                Adaugă un memento pentru a fi anunțat când trebuie să iei medicamentele
              </Text>
            </View>
          ) : (
            medications.map((medication) => (
              <View key={medication.id} style={styles.medicationCard}>
                <View style={styles.medicationHeader}>
                  <View style={styles.medicationIcon}>
                    <Ionicons name="medical" size={24} color="#fff" />
                  </View>
                  <View style={styles.medicationInfo}>
                    <Text style={styles.medicationName}>{medication.medication_name}</Text>
                    <Text style={styles.medicationDosage}>{medication.dosage}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteMedication(medication)}
                  >
                    <Ionicons name="trash" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.medicationDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={18} color="#4f46e5" />
                    <Text style={styles.detailText}>{medication.reminder_time}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={18} color="#4f46e5" />
                    <Text style={styles.detailText}>{formatDays(medication.days)}</Text>
                  </View>
                </View>
                
                {medication.notes && (
                  <Text style={styles.notesText}>{medication.notes}</Text>
                )}
                
                <TouchableOpacity
                  style={styles.findButton}
                  onPress={() => handleFindMedication(medication)}
                >
                  <Ionicons name="locate" size={20} color="#fff" />
                  <Text style={styles.findButtonText}>
                    {medication.location_description 
                      ? 'Unde sunt medicamentele?' 
                      : 'Memorează locația'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
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
  addButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    borderRadius: 22,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  addForm: {
    backgroundColor: '#2d2d44',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  timeLabel: {
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
  },
  timeInput: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  daysLabel: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  dayButton: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  dayButtonSelected: {
    backgroundColor: '#4f46e5',
  },
  dayButtonText: {
    color: '#a0a0a0',
    fontSize: 14,
  },
  dayButtonTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  medicationCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  medicationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicationInfo: {
    flex: 1,
    marginLeft: 15,
  },
  medicationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  medicationDosage: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 2,
  },
  deleteButton: {
    padding: 10,
  },
  medicationDetails: {
    flexDirection: 'row',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#3d3d54',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  detailText: {
    color: '#a0a0a0',
    fontSize: 14,
    marginLeft: 6,
  },
  notesText: {
    color: '#a0a0a0',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 10,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4f46e5',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
  },
  findButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
