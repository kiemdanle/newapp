import React from 'react';
import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings/index" options={{ headerShown: true, title: 'Settings' }} />
      <Stack.Screen name="settings/theme" options={{ headerShown: true, title: 'Theme' }} />
      <Stack.Screen
        name="settings/add-passkey"
        options={{ headerShown: true, title: 'Add a passkey' }}
      />
    </Stack>
  );
}
