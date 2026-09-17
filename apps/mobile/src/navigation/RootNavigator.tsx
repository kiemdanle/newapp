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
      <RootStack.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
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
function parseQueryString(query: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!query) return result;
  const cleaned = query.startsWith('?') ? query.slice(1) : query;
  for (const pair of cleaned.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) {
      result[decodeURIComponent(pair)] = '';
    } else {
      const k = decodeURIComponent(pair.slice(0, eq));
      const v = decodeURIComponent(pair.slice(eq + 1));
      result[k] = v;
    }
  }
  return result;
}

function DeepLinkHandler() {
  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      try {
        if (!url || !url.startsWith('expyrico://')) return;

        const withoutScheme = url.slice('expyrico://'.length);
        const [hostPath, queryStr = ''] = withoutScheme.split('?');
        const host = (hostPath || '').split('/')[0]?.toLowerCase();
        const queryParams = parseQueryString(queryStr);

        if (host === 'navigate') {
          const screen = queryParams.screen;
          if (screen) {
            let parsedParams: Record<string, unknown> | undefined;
            if (queryParams.params) {
              try { parsedParams = JSON.parse(queryParams.params); } catch { /* ignore */ }
            }
            if (!parsedParams) {
              const extra: Record<string, string> = {};
              for (const [k, v] of Object.entries(queryParams)) {
                if (k !== 'screen' && k !== 'params') extra[k] = v;
              }
              if (Object.keys(extra).length > 0) parsedParams = extra;
            }
            navigate(screen, parsedParams);
          }
        } else if (host === 'invite') {
          const code = queryParams.code;
          if (code) void capturePendingReferralCode(code);
        } else if (host === 'household' || host === 'join-household') {
          const code = queryParams.code;
          const token = queryParams.token;
          if (token) {
            capturePendingHouseholdInvitationToken(token);
          } else if (code) {
            void capturePendingHouseholdInviteCode(code);
            navigate('Household', { joinCode: code });
          }
        }
      } catch (err) {
        console.warn('Deep link handling error:', err);
      }
    };

    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    }).catch(() => {});
    return () => sub.remove();
  }, []);

  return null;
}
