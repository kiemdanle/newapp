import { create } from 'zustand';
import type { ThemeId } from '@expyrico/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStore, isThemePreference, type ThemePreference } from '../auth/secure-store';
import { syncThemeToServer } from './sync';

interface ThemeState {
  themeId: ThemeId | 'system';
  hydrated: boolean;
  setTheme: (id: ThemePreference) => Promise<void>;
}

const VALID_IDS: readonly ThemePreference[] = ['system', 'expyrico', 'expyricoDark'];
export const KEY_THEME_STORAGE = '@pantry_theme_preference';

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'system',
  hydrated: false,
  setTheme: async (id) => {
    if (!(VALID_IDS as readonly string[]).includes(id)) {
      throw new Error(`invalid theme preference: ${id}`);
    }
    set({ themeId: id, hydrated: true });
    await Promise.allSettled([
      AsyncStorage.setItem(KEY_THEME_STORAGE, id),
      secureStore.setThemePreference(id),
    ]);
    if (id !== 'system') void syncThemeToServer(id);
  },
}));

export async function initThemeStore(): Promise<void> {
  let stored: ThemePreference | null = null;
  try {
    const v = await AsyncStorage.getItem(KEY_THEME_STORAGE);
    if (v && isThemePreference(v)) stored = v;
  } catch {}

  if (!stored) {
    stored = await secureStore.getThemePreference().catch(() => null);
  }

  useThemeStore.setState({ themeId: stored ?? 'system', hydrated: true });
}
