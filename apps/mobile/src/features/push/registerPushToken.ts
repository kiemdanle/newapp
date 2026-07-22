import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { getItem, setItem } from '../../auth/secure-store';
import { registerPushTokenApi } from '../../api/push';

/** Stores the last successfully registered FCM token (not a boolean). */
export const PUSH_REGISTERED_FLAG_KEY = 'pantry.pushRegisteredV1';

export async function ensurePushTokenRegistered(): Promise<void> {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  if (!enabled) return;

  const fcmToken = await messaging().getToken();
  if (!fcmToken) return;

  // Compare against the last registered token so a hard-revoked server row is
  // re-registered on the next authenticated boot without requiring sign-out.
  const lastRegistered = await getItem(PUSH_REGISTERED_FLAG_KEY);
  if (lastRegistered === fcmToken) return;

  await registerPushTokenApi({
    deviceToken: fcmToken,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceInfo: { model: null, os: Platform.Version },
  });
  await setItem(PUSH_REGISTERED_FLAG_KEY, fcmToken);
}
