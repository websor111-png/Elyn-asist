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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import { contactsApi, Contact } from '../services/api';

export default function ContactsScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await contactsApi.getContacts();
      setContacts(data);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      await voiceService.speak('Te rog completează numele și numărul de telefon.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
      return;
    }

    try {
      const contact = await contactsApi.createContact(newName.trim(), newPhone.trim());
      setContacts([...contacts, contact]);
      setNewName('');
      setNewPhone('');
      setShowAddForm(false);
      
      await voiceService.speak(`Am adăugat contactul ${newName}.`, {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    } catch (error) {
      console.error('Error adding contact:', error);
      await voiceService.speak('Nu am putut adăuga contactul.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    Alert.alert(
      'Șterge contact',
      `Vrei să ștergi contactul ${contact.name}?`,
      [
        { text: 'Nu', style: 'cancel' },
        {
          text: 'Da',
          style: 'destructive',
          onPress: async () => {
            try {
              await contactsApi.deleteContact(contact.id);
              setContacts(contacts.filter(c => c.id !== contact.id));
              await voiceService.speak(`Am șters contactul ${contact.name}.`, {
                language: settings.preferredLanguage,
                voiceType: settings.voiceType,
              });
            } catch (error) {
              console.error('Error deleting contact:', error);
            }
          },
        },
      ]
    );
  };

  const handleCallContact = async (contact: Contact) => {
    Vibration.vibrate(50);
    await voiceService.speak(`Sun pe ${contact.name}.`, {
      language: settings.preferredLanguage,
      voiceType: settings.voiceType,
    });
    // In a real app, this would initiate a phone call
  };

  const handleSmsContact = async (contact: Contact) => {
    Vibration.vibrate(50);
    router.push({
      pathname: '/voice-input',
      params: { prefill: `Trimite mesaj lui ${contact.name}: ` }
    });
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
          <Text style={styles.title}>Contacte</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setShowAddForm(!showAddForm);
              Vibration.vibrate(50);
            }}
            accessibilityLabel="Adaugă contact"
          >
            <Ionicons name={showAddForm ? "close" : "add"} size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Add Contact Form */}
        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Adaugă Contact Nou</Text>
            <TextInput
              style={styles.input}
              placeholder="Nume"
              placeholderTextColor="#666"
              value={newName}
              onChangeText={setNewName}
              accessibilityLabel="Numele contactului"
            />
            <TextInput
              style={styles.input}
              placeholder="Număr de telefon"
              placeholderTextColor="#666"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              accessibilityLabel="Numărul de telefon"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleAddContact}
              accessibilityLabel="Salvează contactul"
            >
              <Ionicons name="checkmark" size={24} color="#fff" />
              <Text style={styles.saveButtonText}>Salvează</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Contacts List */}
        <ScrollView style={styles.content}>
          {contacts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={60} color="#4f46e5" />
              <Text style={styles.emptyText}>Nu ai contacte salvate</Text>
              <Text style={styles.emptySubtext}>
                Adaugă contacte pentru a le apela sau trimite mesaje prin voce
              </Text>
            </View>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.contactInfo}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.avatarText}>
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactDetails}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactPhone}>{contact.phone_number}</Text>
                  </View>
                </View>
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => handleCallContact(contact)}
                    accessibilityLabel={`Sună pe ${contact.name}`}
                  >
                    <Ionicons name="call" size={24} color="#22c55e" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => handleSmsContact(contact)}
                    accessibilityLabel={`Trimite mesaj lui ${contact.name}`}
                  >
                    <Ionicons name="chatbubble" size={24} color="#4f46e5" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIcon}
                    onPress={() => handleDeleteContact(contact)}
                    accessibilityLabel={`Șterge ${contact.name}`}
                  >
                    <Ionicons name="trash" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
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
  addForm: {
    backgroundColor: '#2d2d44',
    margin: 15,
    padding: 20,
    borderRadius: 15,
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
  content: {
    flex: 1,
    padding: 15,
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
  },
  emptySubtext: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 40,
  },
  contactCard: {
    backgroundColor: '#2d2d44',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactDetails: {
    marginLeft: 15,
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  contactPhone: {
    fontSize: 14,
    color: '#a0a0a0',
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
