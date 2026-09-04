import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSessionStore } from '../auth/session-store';
import { capturePendingReferralCode } from '../referral/pendingReferralStore';
import { capturePendingHouseholdInviteCode } from '../features/households/pendingHouseholdInviteStore';
import {
  usePendingInvitationStore,
  capturePendingHouseholdInvitationToken,
} from '../features/households/pendingHouseholdInvitationStore';
import { HouseholdInvitationModal } from '../features/households/HouseholdInvitationModal';
import { useMyPendingInvitations } from '../api/households';
import { InAppNotificationBanner, type InAppNotification } from '../components/InAppNotificationBanner';
import { navigate } from './navigationRef';
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
  const refreshToken = useSessionStore((s) => s.refreshToken);
  const sessionHydrated = useSessionStore((s) => s.hydrated);
  const activeInvitationToken = usePendingInvitationStore((s) => s.activeInvitationToken);
  const setActiveInvitationToken = usePendingInvitationStore((s) => s.setActiveInvitationToken);

  const isAuthenticated = Boolean(accessToken || refreshToken) && sessionHydrated;
  return (
    <>
      <DeepLinkHandler />
      <AppSyncManager />
      <HouseholdInvitationBannerHandler isAuthenticated={isAuthenticated} />
      {activeInvitationToken && (
        <HouseholdInvitationModal
          visible={Boolean(activeInvitationToken)}
          token={activeInvitationToken}
          onClose={() => setActiveInvitationToken(null)}
        />
      )}
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


function HouseholdInvitationBannerHandler({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { data: invitationsData } = useMyPendingInvitations({ enabled: isAuthenticated });
  const activeInvitationToken = usePendingInvitationStore((s) => s.activeInvitationToken);
  const setActiveInvitationToken = usePendingInvitationStore((s) => s.setActiveInvitationToken);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);

  if (!isAuthenticated) return null;

  const pendingInvites = invitationsData?.items ?? [];
  const activeInvite = pendingInvites[0];

  if (
    !activeInvite ||
    !activeInvite.token ||
    activeInvitationToken ||
    dismissedToken === activeInvite.token
  ) {
    return null;
  }

  const notification: InAppNotification = {
    id: activeInvite.id,
    title: 'Household Invitation',
    body: `${activeInvite.inviterName ?? 'Someone'} invited you to join '${activeInvite.householdName}'`,
    data: { token: activeInvite.token },
  };

  return (
    <InAppNotificationBanner
      notification={notification}
      onPress={() => {
        if (activeInvite.token) {
          setActiveInvitationToken(activeInvite.token);
        }
      }}
      onDismiss={() => {
        if (activeInvite.token) {
          setDismissedToken(activeInvite.token);
        }
      }}
    />
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
        } else if (
          parsed.protocol === 'expyrico:' &&
          (parsed.hostname === 'household' || parsed.hostname === 'join-household')
        ) {
          const code = parsed.searchParams.get('code');
          const token = parsed.searchParams.get('token');
          if (token) {
            capturePendingHouseholdInvitationToken(token);
          } else if (code) {
            void capturePendingHouseholdInviteCode(code);
            navigate('Household', { joinCode: code });
          }
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
