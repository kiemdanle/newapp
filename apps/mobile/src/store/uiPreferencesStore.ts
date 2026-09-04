import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

export interface MenuButtonPosition {
  x: number;
  y: number;
}

const MENU_POSITION_STORAGE_KEY = '@expyrico_menu_button_position';

interface UiPreferencesState {
  menuButtonPosition: MenuButtonPosition | null;
  setMenuButtonPosition: (pos: MenuButtonPosition) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useUiPreferencesStore = create<UiPreferencesState>((set) => {
  // Hydrate from AsyncStorage immediately on launch
  AsyncStorage.getItem(MENU_POSITION_STORAGE_KEY)
    .then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as MenuButtonPosition;
          if (
            typeof parsed.x === 'number' &&
            typeof parsed.y === 'number' &&
            Number.isFinite(parsed.x) &&
            Number.isFinite(parsed.y)
          ) {
            set({ menuButtonPosition: parsed });
          }
        } catch {}
      }
    })
    .catch(() => {});

  return {
    menuButtonPosition: null,
    setMenuButtonPosition: async (pos: MenuButtonPosition) => {
      set({ menuButtonPosition: pos });
      try {
        await AsyncStorage.setItem(MENU_POSITION_STORAGE_KEY, JSON.stringify(pos));
      } catch {}

      // Sync to backend user preferences
      try {
        await apiClient.patch('/me/preferences', {
          uiPreferences: {
            menuButtonPosition: pos,
          },
        });
      } catch {
        // Silently tolerate offline state; local storage retains coordinates
      }
    },
    hydrate: async () => {
      try {
        const res = await apiClient.get<{
          uiPreferences?: {
            menuButtonPosition?: MenuButtonPosition;
          } | null;
        }>('/me/preferences');

        if (res.uiPreferences?.menuButtonPosition) {
          const pos = res.uiPreferences.menuButtonPosition;
          set({ menuButtonPosition: pos });
          await AsyncStorage.setItem(MENU_POSITION_STORAGE_KEY, JSON.stringify(pos));
        }
      } catch {}
    },
  };
});
