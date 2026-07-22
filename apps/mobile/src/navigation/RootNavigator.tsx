import React, { useEffect } from 'react';
import { Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSessionStore } from '../auth/session-store';
import { capturePendingReferralCode } from '../referral/pendingReferralStore';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { AppSyncManager } from '../App';

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const sessionHydrated = useSessionStore((s) => s.hydrated);

  const isAuthenticated = Boolean(accessToken) && sessionHydrated;

  return (
    <>
      <DeepLinkHandler />
      <AppSyncManager />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="App" component={AppNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </>
  );
}

function DeepLinkHandler() {
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'expyrico:' && parsed.hostname === 'invite') {
          const code = parsed.searchParams.get('code');
          if (code) void capturePendingReferralCode(code);
        }
      } catch {
        // ignore parse failures on non-referral URLs
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    }).catch(() => {
      // ignore
    });
    return () => sub.remove();
  }, []);

  return null;
}
