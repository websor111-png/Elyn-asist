import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import { visionApi } from '../services/api';

export default function CameraScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (permission?.granted) {
      speakInstructions();
    }
  }, [permission?.granted]);

  const speakInstructions = async () => {
    await voiceService.speak(
      'Camera este activă. Îndreptă telefonul înainte și apasă butonul mare pentru a analiza ce este în față.',
      {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      }
    );
  };

  const handleAnalyze = async () => {
    if (!cameraRef.current || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    await voiceService.speak('Analizez imaginea...', {
      language: settings.preferredLanguage,
      voiceType: settings.voiceType,
    });
    
    try {
      // Take photo
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
      });
      
      if (!photo?.base64) {
        throw new Error('Nu am putut captura imaginea');
      }
      
      // Analyze with AI
      const result = await visionApi.analyzeImage(photo.base64, settings.preferredLanguage);
      setAnalysisResult(result);
      
      // Speak the guidance
      const speechText = `${result.description}. ${result.guidance}`;
      await voiceService.speak(speechText, {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
      
      // If there are obstacles, warn about them
      if (result.obstacles && result.obstacles.length > 0) {
        const obstacleText = `Atenție! Obstacole detectate: ${result.obstacles.join(', ')}.`;
        await voiceService.speak(obstacleText, {
          language: settings.preferredLanguage,
          voiceType: settings.voiceType,
        });
      }
      
    } catch (error: any) {
      console.error('Error analyzing image:', error);
      await voiceService.speak('Nu am putut analiza imaginea. Te rog încearcă din nou.', {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleCamera = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
    voiceService.speak(
      facing === 'back' ? 'Camera frontală activată' : 'Camera spate activată',
      {
        language: settings.preferredLanguage,
        voiceType: settings.voiceType,
      }
    );
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={80} color="#4f46e5" />
          <Text style={styles.permissionTitle}>Acces la cameră necesar</Text>
          <Text style={styles.permissionText}>
            Pentru a te ajuta să navighezi, am nevoie de acces la camera telefonului.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            accessibilityLabel="Permite accesul la cameră"
          >
            <Text style={styles.permissionButtonText}>Permite acces</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButtonAlt}
            onPress={() => router.back()}
            accessibilityLabel="Înapoi"
          >
            <Text style={styles.backButtonAltText}>Înapoi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            voiceService.stop();
            router.back();
          }}
          accessibilityLabel="Înapoi"
        >
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Ghidare Vizuală</Text>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={toggleCamera}
          accessibilityLabel="Schimbă camera"
        >
          <Ionicons name="camera-reverse" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        >
          {/* Overlay for guidance */}
          <View style={styles.cameraOverlay}>
            {isAnalyzing && (
              <View style={styles.analyzingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.analyzingText}>Analizez...</Text>
              </View>
            )}
          </View>
        </CameraView>
      </View>

      {/* Analysis Result */}
      {analysisResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Rezultat:</Text>
          <Text style={styles.resultDescription}>{analysisResult.description}</Text>
          <Text style={styles.resultGuidance}>{analysisResult.guidance}</Text>
          {analysisResult.obstacles && analysisResult.obstacles.length > 0 && (
            <View style={styles.obstaclesContainer}>
              <Ionicons name="warning" size={20} color="#ef4444" />
              <Text style={styles.obstaclesText}>
                Obstacole: {analysisResult.obstacles.join(', ')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Capture Button */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.captureButton, isAnalyzing && styles.captureButtonDisabled]}
          onPress={handleAnalyze}
          disabled={isAnalyzing}
          accessibilityLabel="Analizează ce este în față"
        >
          <Ionicons 
            name={isAnalyzing ? "hourglass" : "scan"} 
            size={50} 
            color="#fff" 
          />
          <Text style={styles.captureButtonText}>
            {isAnalyzing ? 'Analizez...' : 'Analizează'}
          </Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#1a1a2e',
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
  flipButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 20,
    margin: 10,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
  },
  analyzingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 10,
  },
  resultContainer: {
    backgroundColor: '#2d2d44',
    margin: 10,
    padding: 15,
    borderRadius: 15,
    maxHeight: 150,
  },
  resultTitle: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  resultDescription: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
  },
  resultGuidance: {
    color: '#22c55e',
    fontSize: 14,
    fontStyle: 'italic',
  },
  obstaclesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#3d3d54',
  },
  obstaclesText: {
    color: '#ef4444',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  controls: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 40,
  },
  captureButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  captureButtonDisabled: {
    backgroundColor: '#4f46e580',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#a0a0a0',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 15,
    marginTop: 30,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButtonAlt: {
    marginTop: 20,
    padding: 15,
  },
  backButtonAltText: {
    color: '#a0a0a0',
    fontSize: 16,
  },
});
