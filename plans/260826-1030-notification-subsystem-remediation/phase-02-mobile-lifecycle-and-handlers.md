---
phase: 2
title: "Mobile Lifecycle and Handlers"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Mobile Lifecycle and Handlers

## Overview
Implements complete client-side push notification lifecycle management in the React Native app. This includes multi-account token tracking, automatic token registration on login, token revocation and cache clearing on logout, token refresh listeners, foreground notification presentation, permission recovery on foreground transitions, and reliable notification tap deep-linking for expiring inventory items.

<!-- Updated: Red-Team Review - Added AppState foreground permission re-check & cold-launch navigation buffering -->

---

## Requirements

### Functional Requirements
- `ensurePushTokenRegistered()` must track both the active user ID and device token in secure storage so switching accounts on the same device triggers registration for the new user.
- User sign-out must invoke token cleanup on both the backend and local secure store.
- App must listen to `messaging().onTokenRefresh` and sync rotated FCM tokens to the backend immediately.
- App must listen to `AppState` changes: when returning from system settings in foreground, re-evaluate permission status and register token if granted.
- App must listen to `messaging().onMessage` while in the foreground and surface alerts/banners to the user instead of silently dropping incoming push notifications.
- Tapping an expiry notification (`type === 'expiry'`, `recordId`) must navigate the user directly to the relevant record in their pantry, buffering cold-boot taps until navigation is ready.

### Non-Functional Requirements
- Fail-closed security validation on notification payloads (prevent URL smuggling and malicious deep links).
- Zero memory leaks: all messaging and AppState event listeners must clean up on unmount or session invalidation.

---

## Architecture & Code Changes

### 1. Token Registration with User-Scoping
* **`apps/mobile/src/features/push/registerPushToken.ts`**:
  Store both user ID and token to prevent stale cache skipping across account switches:
  ```typescript
  export const PUSH_TOKEN_KEY = 'pantry.pushTokenV1';
  export const PUSH_USER_ID_KEY = 'pantry.pushUserIdV1';

  export async function ensurePushTokenRegistered(currentUserId: string): Promise<void> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) return;

      const fcmToken = await messaging().getToken();
      if (!fcmToken) return;

      const lastToken = await getItem(PUSH_TOKEN_KEY);
      const lastUser = await getItem(PUSH_USER_ID_KEY);

      if (lastToken === fcmToken && lastUser === currentUserId) {
        return; // Already registered for this user and token
      }

      await registerPushTokenApi({
        deviceToken: fcmToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        deviceInfo: { model: null, os: Platform.Version },
      });

      await setItem(PUSH_TOKEN_KEY, fcmToken);
      await setItem(PUSH_USER_ID_KEY, currentUserId);
    } catch (error) {
      console.warn('Failed to ensure FCM push token registered', error);
    }
  }
  ```

### 2. Sign-out Cleanup
* **`apps/mobile/src/api/endpoints.ts` & `apps/mobile/src/auth/session-store.ts`**:
  On logout, revoke active push token and clear local registration keys:
  ```typescript
  export async function handleLogoutCleanup(): Promise<void> {
    try {
      const token = await getItem(PUSH_TOKEN_KEY);
      if (token) {
        await apiClient.request<void>({
          method: 'POST',
          path: '/me/push-token/revoke-by-token',
          body: { deviceToken: token },
        }).catch(() => {});
      }
    } finally {
      await setItem(PUSH_TOKEN_KEY, '');
      await setItem(PUSH_USER_ID_KEY, '');
    }
  }
  ```

### 3. Foreground Notifications, AppState & Token Refresh in AppSyncManager
* **`apps/mobile/src/App.tsx`**:
  Wire `AppState`, `onTokenRefresh`, `onMessage`, and tap routing with cold-boot navigation safety:
  ```typescript
  import { AppState, type AppStateStatus } from 'react-native';

  export function AppSyncManager() {
    const user = useSessionStore((s) => s.user);
    const accessToken = useSessionStore((s) => s.accessToken);

    useEffect(() => {
      if (!accessToken || !user?.id) return;
      startSyncTriggers();
      void ensurePushTokenRegistered(user.id);

      // Re-check permission if user enabled it in system settings and returns to app
      const handleAppStateChange = (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          void ensurePushTokenRegistered(user.id);
        }
      };
      const appStateSub = AppState.addEventListener('change', handleAppStateChange);

      const unsubRefresh = messaging().onTokenRefresh(async (newToken) => {
        try {
          await registerPushTokenApi({
            deviceToken: newToken,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
            deviceInfo: { model: null, os: Platform.Version },
          });
          await setItem(PUSH_TOKEN_KEY, newToken);
          await setItem(PUSH_USER_ID_KEY, user.id);
        } catch (e) {
          console.warn('Failed to re-register refreshed FCM token', e);
        }
      });

      const unsubMessage = messaging().onMessage(async (remoteMessage) => {
        // Show in-app banner or toast with action button
        if (remoteMessage.notification) {
          // Trigger in-app banner component
        }
      });

      const handleOpenedNotification = (message: { data?: Record<string, string | object> | undefined }) => {
        void handleNotificationTap(message.data);
      };

      const unsubOpened = messaging().onNotificationOpenedApp(handleOpenedNotification);
      
      // Buffer cold-launch notification until navigation container is ready
      void messaging().getInitialNotification().then((message) => {
        if (message) {
          queueMicrotask(() => handleOpenedNotification(message));
        }
      });

      return () => {
        appStateSub.remove();
        unsubRefresh();
        unsubMessage();
        unsubOpened();
        stopSyncTriggers();
      };
    }, [accessToken, user?.id]);

    return null;
  }
  ```

### 4. Notification Tap Navigation
* **`apps/mobile/src/features/push/handle-notification-open.ts`**:
  Add handler for `type === 'expiry'`:
  ```typescript
  export async function handleNotificationTap(data: Record<string, unknown> | undefined): Promise<void> {
    if (!data) return;
    if (data.type === 'moderation_queue') {
      await handleModerationNotificationOpen(data);
      return;
    }
    if (data.type === 'expiry' && typeof data.recordId === 'string') {
      // Navigate to record detail screen safely
      navigate('RecordDetail', { id: data.recordId });
    }
  }
  ```

---

## Related Code Files
- Modify: `apps/mobile/src/features/push/registerPushToken.ts`
- Modify: `apps/mobile/src/features/push/handle-notification-open.ts`
- Modify: `apps/mobile/src/App.tsx`
- Modify: `apps/mobile/src/api/endpoints.ts`
- Modify: `apps/mobile/src/auth/session-store.ts`
- Test: `apps/mobile/src/features/push/registerPushToken.test.ts`
- Test: `apps/mobile/src/features/push/handle-notification-open.test.ts`

---

## Implementation Steps
1. Refactor `registerPushToken.ts` to accept `currentUserId` and compare user + token state.
2. Add `AppState` foreground listener in `AppSyncManager` to automatically detect permission grants from system settings.
3. Add `onTokenRefresh` listener to `AppSyncManager` to automatically sync rotated tokens.
4. Add `onMessage` listener in `AppSyncManager` for in-app alert presentation.
5. Expand `handle-notification-open.ts` to route `expiry` notification taps to the record view.
6. Add token revocation hook to session logout handler in `session-store.ts` / `endpoints.ts`.
7. Update unit tests in `registerPushToken.test.ts` and `handle-notification-open.test.ts`.

---

## Success Criteria
- [ ] Switching between two accounts on the same device registers the token for both users consecutively without throwing 409 Conflict.
- [ ] Enabling notification permissions in OS system settings immediately triggers token registration when returning to the app.
- [ ] Logging out clears the local registration flag and revokes the token on the server.
- [ ] Token refresh events call the registration API with the new token.
- [ ] Foreground push notifications display in-app feedback rather than being silently dropped.
- [ ] Tapping an expiry notification on cold boot navigates cleanly to the relevant pantry record.

---

## Risk Assessment
- **Navigation container reference before mount:** Cold-launch taps are deferred via microtask / `navigationRef.isReady()` guards to prevent navigation failure before mount.
