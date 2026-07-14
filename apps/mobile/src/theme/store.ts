import { create } from 'zustand';
import type { ThemeId } from '@expyrico/theme';
import { secureStore, type ThemePreference } from '../auth/secure-store';
import { syncThemeToServer } from './sync';

interface ThemeState {
  themeId: ThemeId | 'system';
  hydrated: boolean;
  setTheme: (id: ThemePreference) => Promise<void>;
}

const VALID_IDS: readonly ThemePreference[] = ['system', 'expyrico', 'expyricoDark'];

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'system',
  hydrated: false,
  setTheme: async (id) => {
    if (!(VALID_IDS as readonly string[]).includes(id)) {
      throw new Error(`invalid theme preference: ${id}`);
    }
    await secureStore.setThemePreference(id);
    set({ themeId: id });
    if (id !== 'system') void syncThemeToServer(id);
  },
}));

export async function initThemeStore(): Promise<void> {
  const stored = await secureStore.getThemePreference();
  useThemeStore.setState({ themeId: stored ?? 'system', hydrated: true });
}
