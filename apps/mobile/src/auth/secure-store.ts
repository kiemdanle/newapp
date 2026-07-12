import * as SecureStore from 'expo-secure-store';
import type { ThemeId } from '@expyrico/theme';

const KEY_ACCESS = 'pantry.access_token';
const KEY_REFRESH = 'pantry.refresh_token';
const KEY_THEME = 'pantry.theme_preference';

export type ThemePreference = ThemeId | 'system';

const THEME_IDS: readonly ThemeId[] = ['expyrico', 'expyricoDark', 'bento', 'clay', 'material'];
const THEME_PREFERENCES: readonly ThemePreference[] = ['system', ...THEME_IDS];

function isThemePreference(v: string): v is ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(v);
}

export const secureStore = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_ACCESS);
  },
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_ACCESS, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_REFRESH);
  },
  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_REFRESH, token);
  },

  async getThemePreference(): Promise<ThemePreference | null> {
    const v = await SecureStore.getItemAsync(KEY_THEME);
    if (v && isThemePreference(v)) return v;
    return null;
  },
  async setThemePreference(v: ThemePreference): Promise<void> {
    if (!isThemePreference(v)) throw new Error(`invalid theme preference: ${v}`);
    await SecureStore.setItemAsync(KEY_THEME, v);
  },

  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY_ACCESS);
    await SecureStore.deleteItemAsync(KEY_REFRESH);
    await SecureStore.deleteItemAsync(KEY_THEME);
  },
};

// Generic key/value helpers for non-auth persisted state (sync cursor, push
// registration flag). Namespaced keys are passed by the caller.
export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}
