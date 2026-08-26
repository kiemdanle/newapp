import 'react-native-get-random-values';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet, TextInput, AppState, Platform, type AppStateStatus } from 'react-native';
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
import { setItem } from './auth/secure-store';
import { registerPushTokenApi } from './api/push';
import { ensurePushTokenRegistered, PUSH_REGISTERED_FLAG_KEY, PUSH_REGISTERED_USER_ID_KEY } from './features/push/registerPushToken';
import { handleNotificationTap, registerModerationNotificationBatch } from './features/push/handle-notification-open';
import { navigationRef } from './navigation/navigationRef';
import messaging from '@react-native-firebase/messaging';
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
      <NavigationContainer ref={navigationRef}>
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
  const user = useSessionStore((s) => s.user);
  const openedModerationBatches = useRef(new Set<string>());

  useEffect(() => {
    if (!accessToken) return;
    startSyncTriggers();
    void ensurePushTokenRegistered(user?.id).catch((error) => {
      console.warn('Failed to register FCM token', error);
    });

    // Re-check permissions when app transitions to active foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void ensurePushTokenRegistered(user?.id);
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    // Listen for FCM token rotation and re-register
    let unsubRefresh: (() => void) | undefined;
    let unsubMessage: (() => void) | undefined;
    let unsubOpened: (() => void) | undefined;

    try {
      unsubRefresh = messaging().onTokenRefresh(async (newToken) => {
        try {
          await registerPushTokenApi({
            deviceToken: newToken,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            deviceInfo: { model: null, os: Platform.Version },
          });
          await setItem(PUSH_REGISTERED_FLAG_KEY, newToken);
          if (user?.id) {
            await setItem(PUSH_REGISTERED_USER_ID_KEY, user.id);
          }
        } catch (e) {
          console.warn('Failed to sync rotated FCM token', e);
        }
      });

      // Foreground push notification listener
      unsubMessage = messaging().onMessage(async (remoteMessage) => {
        // Invalidate record/product caches so data is fresh
        if (remoteMessage.data?.recordId) {
          queryClient.invalidateQueries({ queryKey: ['records'] });
        }
      });

      const handleOpenedNotification = (message: { data?: Record<string, string | object> | undefined }) => {
        const type = message.data?.type;
        const batchId = message.data?.batchId;
        if (type === 'moderation_queue' && !registerModerationNotificationBatch(batchId, openedModerationBatches.current)) return;
        void handleNotificationTap(message.data as Record<string, unknown> | undefined);
      };

      unsubOpened = messaging().onNotificationOpenedApp(handleOpenedNotification);
      void messaging().getInitialNotification().then((message) => {
        if (message) {
          queueMicrotask(() => handleOpenedNotification(message));
        }
      }).catch((err) => {
        console.warn('FCM getInitialNotification error', err);
      });
    } catch (e) {
      console.warn('FCM listener registration failed', e);
    }

    return () => {
      appStateSub.remove();
      try {
        unsubRefresh?.();
        unsubMessage?.();
        unsubOpened?.();
      } catch {}
      stopSyncTriggers();
    };
  }, [accessToken, user?.id]);

  return null;
}
