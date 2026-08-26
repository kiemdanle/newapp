import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { getItem, setItem } from '../../auth/secure-store';
import { registerPushTokenApi } from '../../api/push';

/** Stores the last successfully registered FCM token and user ID. */
export const PUSH_REGISTERED_FLAG_KEY = 'pantry.pushRegisteredV1';
export const PUSH_REGISTERED_USER_ID_KEY = 'pantry.pushRegisteredUserIdV1';

export async function ensurePushTokenRegistered(currentUserId?: string): Promise<void> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return;

    const fcmToken = await messaging().getToken();
    if (!fcmToken) return;

    // Compare against the last registered token AND user so switching accounts
    // re-registers the token for the newly authenticated user.
    const lastRegisteredToken = await getItem(PUSH_REGISTERED_FLAG_KEY);
    const lastRegisteredUser = await getItem(PUSH_REGISTERED_USER_ID_KEY);
    if (lastRegisteredToken === fcmToken && (!currentUserId || lastRegisteredUser === currentUserId)) {
      return;
    }

    await registerPushTokenApi({
      deviceToken: fcmToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceInfo: { model: null, os: Platform.Version },
    });
    await setItem(PUSH_REGISTERED_FLAG_KEY, fcmToken);
    if (currentUserId) {
      await setItem(PUSH_REGISTERED_USER_ID_KEY, currentUserId);
    }
  } catch (error) {
    console.warn('Failed to ensure FCM push token registered', error);
  }
}
