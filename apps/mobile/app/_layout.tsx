import 'react-native-get-random-values';
import '../global.css';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text, TextInput, StyleSheet } from 'react-native';

// Global font-scale cap at 1.5x (200% system text size per WCAG). Prevents
// layout shatter at extreme accessibility text sizes while allowing the
// full dynamic-type range up to 200%. Only badge / tight-overlay components
// may opt out with an explicit allowFontScaling={false}.
(Text as any).defaultProps = (Text as any).defaultProps || {};
(Text as any).defaultProps.maxFontSizeMultiplier = 1.5;
(TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.5;
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { createQueryClient } from '../src/api/query-client';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../src/theme/store';
import { hydrateSession, useSessionStore } from '../src/auth/session-store';
import { wireApiClient } from '../src/auth/wire-client';
import { capturePendingReferralCode } from '../src/referral/pendingReferralStore';
import { startSyncTriggers, stopSyncTriggers } from '../src/db/triggers';

const queryClient = createQueryClient();

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [bootError, setBootError] = useState<string | null>(null);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  const accessToken = useSessionStore((s) => s.accessToken);

  useEffect(() => {
    wireApiClient();
    Promise.all([initThemeStore(), hydrateSession()]).catch((e) => setBootError(String(e)));
  }, []);

  const splashReady = Boolean(bootError) || (themeHydrated && sessionHydrated);

  useEffect(() => {
    if (splashReady) void SplashScreen.hideAsync();
  }, [splashReady]);

  // Sync only runs while authenticated — starting it unauthenticated would fire
  // /records/sync with no token. Start on sign-in, stop on sign-out.
  useEffect(() => {
    if (!accessToken) return;
    startSyncTriggers();
    return () => stopSyncTriggers();
  }, [accessToken]);

  // expo-router requires <Slot /> (or another navigator) to be present on
  // the FIRST render so the navigation container mounts. The previous early
  // returns rendered only <ActivityIndicator /> before hydration, so the
  // container never mounted and AuthGate's router.replace failed with
  // "Attempted to navigate before mounting the Root Layout component". Render
  // Slot always and overlay a loading indicator until hydration completes.
  const booting = !splashReady;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <StatusBar style="auto" />
            <AuthGate />
            <DeepLinkHandler />
            <Slot />
            {booting ? (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' },
                ]}
              >
                <ActivityIndicator />
              </View>
            ) : bootError ? (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8', padding: 24 },
                ]}
              >
                <Text style={{ color: '#2C2C28', fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
                  Unable to start Expyrico
                </Text>
                <Text style={{ color: '#8C8C85', marginTop: 8, textAlign: 'center' }}>
                  Please close and reopen the app.
                </Text>
              </View>
            ) : null}
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
    const inAppGroup = segments[0] === '(app)';
    // Authenticated users belong in (app); redirect home whenever they land
    // outside it. This includes a cold start at the root path "/" (segments
    // empty), which matched neither branch before and fell through to the Expo
    // Router "Unmatched Route" screen.
    if (!accessToken && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (accessToken && !inAppGroup) {
      router.replace('/(app)/(tabs)/home');
    }
  }, [accessToken, sessionHydrated, segments, router]);

  return null;
}

function DeepLinkHandler() {
  const router = useRouter();
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      // Referral code capture — best-effort, post-install only.
      // v1.x provisions no universal/app-link infra, so this fires only when
      // the app is already installed and the link opens through it.
      try {
        const parsed = Linking.parse(url);
        if (parsed.path === 'invite' && typeof parsed.queryParams?.code === 'string') {
          void capturePendingReferralCode(parsed.queryParams.code);
        }
      } catch {
        // ignore parse failures on non-referral URLs
      }
    });
    return () => sub.remove();
  }, [router]);
  return null;
}
