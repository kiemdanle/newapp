import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet, TextInput } from 'react-native';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createQueryClient } from './api/query-client';
import { ThemeProvider } from './theme/ThemeProvider';
import { initThemeStore, useThemeStore } from './theme/store';
import { hydrateSession, useSessionStore } from './auth/session-store';
import { wireApiClient } from './auth/wire-client';
import { startSyncTriggers, stopSyncTriggers } from './db/triggers';
import { ensurePushTokenRegistered } from './features/push/registerPushToken';
import { RootNavigator } from './navigation/RootNavigator';

const queryClient = createQueryClient();

// Global font-scale cap at 1.5x (200% system text size per WCAG). Prevents
// layout shatter at extreme accessibility text sizes while allowing the
// full dynamic-type range up to 200%.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.5;
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.5;

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <RootApp />
            <AppSyncManager />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootApp() {
  const [bootError, setBootError] = useState<string | null>(null);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    wireApiClient();
    Promise.all([initThemeStore(), hydrateSession()]).catch((e) => setBootError(String(e)));
  }, []);

  const splashReady = Boolean(bootError) || (themeHydrated && sessionHydrated);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar barStyle="default" />
        <RootNavigator />
      </NavigationContainer>
      {bootError ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8', padding: 24 },
          ]}
        >
          {/* Boot-time palette only: ThemeProvider may not be hydrated yet. */}
          <Text style={{ color: '#2C2C28', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
            Unable to start Expyrico
          </Text>
          <Text style={{ color: '#8C8C85', marginTop: 8, textAlign: 'center' }}>
            Please close and reopen the app.
          </Text>
        </View>
      ) : !splashReady ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' },
          ]}
          testID="splash-overlay"
        >
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}

export function AppSyncManager() {
  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    startSyncTriggers();
    void ensurePushTokenRegistered().catch((error) => {
      console.warn('Failed to register FCM token', error);
    });
    return () => stopSyncTriggers();
  }, [accessToken]);

  return null;
}
