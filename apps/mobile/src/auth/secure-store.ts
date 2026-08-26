import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY_ACCESS = 'pantry.access_token';
const KEY_REFRESH = 'pantry.refresh_token';
const KEY_THEME = 'pantry.theme_preference';
const KEY_PUSH_REGISTERED = 'pantry.pushRegisteredV1';

export type ThemePreference = 'system' | 'expyrico' | 'expyricoDark';

const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'expyrico', 'expyricoDark'];

export function isThemePreference(v: string): v is ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(v);
}

async function getValue(service: string): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({ service });
    if (result && result.password) return result.password;
  } catch {}

  // Fallback to persistent storage if Android Keystore keys were invalidated during APK update/reinstall
  try {
    const fallback = await AsyncStorage.getItem(`@secure_${service}`);
    if (fallback) {
      // Restore back into Keychain for future reads
      await Keychain.setGenericPassword(service, fallback, { service }).catch(() => {});
      return fallback;
    }
  } catch {}

  return null;
}

async function setValue(service: string, value: string): Promise<void> {
  if (!value || typeof value !== 'string' || value === 'undefined' || value === 'null') {
    return;
  }
  await Promise.allSettled([
    Keychain.setGenericPassword(service, value, { service }),
    AsyncStorage.setItem(`@secure_${service}`, value),
  ]);
}

async function deleteValue(service: string): Promise<void> {
  await Promise.allSettled([
    Keychain.resetGenericPassword({ service }),
    AsyncStorage.removeItem(`@secure_${service}`),
  ]);
}
export const secureStore = {
  async getAccessToken(): Promise<string | null> {
    return getValue(KEY_ACCESS);
  },
  async setAccessToken(token: string): Promise<void> {
    await setValue(KEY_ACCESS, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return getValue(KEY_REFRESH);
  },
  async setRefreshToken(token: string): Promise<void> {
    await setValue(KEY_REFRESH, token);
  },

  async getThemePreference(): Promise<ThemePreference | null> {
    const v = await getValue(KEY_THEME);
    if (v && isThemePreference(v)) return v;
    return null;
  },
  async setThemePreference(v: ThemePreference): Promise<void> {
    if (!isThemePreference(v)) throw new Error(`invalid theme preference: ${v}`);
    await setValue(KEY_THEME, v);
  },

  async clearAll(): Promise<void> {
    await deleteValue(KEY_ACCESS);
    await deleteValue(KEY_REFRESH);
    await deleteValue(KEY_THEME);
    await deleteValue(KEY_PUSH_REGISTERED);
    await deleteValue('pantry.pushRegisteredUserIdV1');
  },
};

// Generic key/value helpers for non-auth persisted state (sync cursor, push
// registration flag). Namespaced keys are passed by the caller.
export async function getItem(key: string): Promise<string | null> {
  return getValue(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await setValue(key, value);
}
