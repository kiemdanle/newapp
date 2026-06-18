import '../global.css';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import { createQueryClient } from '../src/api/query-client';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../src/theme/store';
import { hydrateSession, useSessionStore } from '../src/auth/session-store';
import { wireApiClient } from '../src/auth/wire-client';
import { parseAuthDeepLink } from '../src/lib/linking';
import { startSyncTriggers, stopSyncTriggers } from '../src/db/triggers';

const queryClient = createQueryClient();

export default function RootLayout() {
  const [bootError, setBootError] = useState<string | null>(null);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    wireApiClient();
    Promise.all([initThemeStore(), hydrateSession()]).catch((e) => setBootError(String(e)));
  }, []);

  // Sync only runs while authenticated — starting it unauthenticated would fire
  // /records/sync with no token. Start on sign-in, stop on sign-out.
  useEffect(() => {
    if (!accessToken) return;
    startSyncTriggers();
    return () => stopSyncTriggers();
  }, [accessToken]);

  if (bootError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!themeHydrated || !sessionHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <StatusBar style="auto" />
            <AuthGate />
            <DeepLinkHandler />
            <Slot />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const accessToken = useSessionStore((s) => s.accessToken);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    if (!sessionHydrated) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (accessToken && inAuthGroup) {
      router.replace('/(app)/(tabs)/home');
    }
  }, [accessToken, sessionHydrated, segments, router]);

  return null;
}

function DeepLinkHandler() {
  const router = useRouter();
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const link = parseAuthDeepLink(url);
      if (!link) return;
      if (link.kind === 'reset-password')
        router.push({ pathname: '/(auth)/reset-password', params: { token: link.token } });
      if (link.kind === 'verify-email')
        router.push({ pathname: '/(auth)/verify-email', params: { token: link.token } });
    });
    return () => sub.remove();
  }, [router]);
  return null;
}
