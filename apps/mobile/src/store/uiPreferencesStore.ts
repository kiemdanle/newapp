import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

export type PantryViewMode = 'list' | 'grid';

export const PANTRY_VIEW_MODE_STORAGE_KEY = '@expyrico_pantry_view_mode';

interface UiPreferencesState {
  pantryViewMode: PantryViewMode;
  setPantryViewMode: (mode: PantryViewMode) => Promise<void>;
  hydrate: () => Promise<void>;
}

let userHasToggledPantryViewMode = false;

export function resetPantryViewModeState() {
  userHasToggledPantryViewMode = false;
  useUiPreferencesStore.setState({ pantryViewMode: 'list' });
}

export const useUiPreferencesStore = create<UiPreferencesState>((set) => {
  AsyncStorage.getItem(PANTRY_VIEW_MODE_STORAGE_KEY)
    .then((stored) => {
      if (!userHasToggledPantryViewMode && (stored === 'list' || stored === 'grid')) {
        set({ pantryViewMode: stored });
      }
    })
    .catch(() => {
      /* best-effort */
    });

  return {
    pantryViewMode: 'list',
    setPantryViewMode: async (mode: PantryViewMode) => {
      userHasToggledPantryViewMode = true;
      set({ pantryViewMode: mode });
      try {
        await AsyncStorage.setItem(PANTRY_VIEW_MODE_STORAGE_KEY, mode);
      } catch {
        /* best-effort */
      }
    },
    hydrate: async () => {
      try {
        const res = await apiClient.get<{
          uiPreferences?: {
            pantryViewMode?: PantryViewMode;
          } | null;
        }>('/me/preferences');

        if (res.uiPreferences?.pantryViewMode) {
          set({ pantryViewMode: res.uiPreferences.pantryViewMode });
          await AsyncStorage.setItem(
            PANTRY_VIEW_MODE_STORAGE_KEY,
            res.uiPreferences.pantryViewMode
          );
        }
      } catch {
        /* best-effort */
      }
    },
  };
});
