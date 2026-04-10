import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as KeepAwake from 'expo-keep-awake';

export default function SplashScreen() {
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Keep screen awake (only on native platforms)
    if (Platform.OS !== 'web') {
      try {
        KeepAwake.activateKeepAwakeAsync();
      } catch (e) {
        console.log('KeepAwake not available');
      }
    }

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Navigate to home after 3 seconds
    const timer = setTimeout(() => {
      router.replace('/home');
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>E</Text>
        </View>
        
        <View style={styles.brandContainer}>
          <Text style={styles.brandName}>Brend Ekyn</Text>
          <Text style={styles.creator}>Creiat de Ciorpac Sorin</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a56db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  logoContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  logoText: {
    fontSize: 140,
    fontWeight: 'bold',
    color: '#1a56db',
    fontFamily: 'serif',
  },
  brandContainer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  creator: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 10,
    fontStyle: 'italic',
  },
});
