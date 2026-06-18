import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { getItem, setItem } from '../../auth/secure-store';
import { registerPushTokenApi } from '../../api/push';

const FLAG_KEY = 'pantry.pushRegisteredV1';

export async function ensurePushTokenRegistered(): Promise<void> {
  if (!Device.isDevice) return;
  if (await getItem(FLAG_KEY)) return;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  await registerPushTokenApi({
    expoPushToken: tokenData.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceInfo: { model: Device.modelName ?? null, os: Platform.Version },
  });
  await setItem(FLAG_KEY, '1');
}
