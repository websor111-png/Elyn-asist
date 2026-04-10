import React from 'react';
import { Stack } from 'expo-router';
import { SettingsProvider } from '../context/SettingsContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#1a1a2e' },
          animation: 'slide_from_right',
        }}
      />
    </SettingsProvider>
  );
}
