import { create } from 'zustand';
import type { ThemeId } from '@expyrico/theme';
import { secureStore } from '../auth/secure-store';
import { syncThemeToServer } from './sync';

interface ThemeState {
  themeId: ThemeId;
  hydrated: boolean;
  setTheme: (id: ThemeId) => Promise<void>;
}

const VALID_IDS: readonly ThemeId[] = ['expyrico', 'bento', 'clay', 'material'];

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: 'expyrico',
  hydrated: false,
  setTheme: async (id) => {
    if (!(VALID_IDS as readonly string[]).includes(id)) {
      throw new Error(`invalid theme id: ${id}`);
    }
    await secureStore.setThemePreference(id);
    set({ themeId: id });
    void syncThemeToServer(id);
  },
}));

export async function initThemeStore(): Promise<void> {
  const stored = await secureStore.getThemePreference();
  useThemeStore.setState({ themeId: stored ?? 'expyrico', hydrated: true });
}
