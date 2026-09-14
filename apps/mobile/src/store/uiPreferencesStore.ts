import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

export type PantryViewMode = 'list' | 'grid';

export const PANTRY_VIEW_MODE_STORAGE_KEY = '@expyrico_pantry_view_mode';
export const DRAFTS_VIEW_MODE_STORAGE_KEY = '@expyrico_drafts_view_mode';

interface UiPreferencesState {
  pantryViewMode: PantryViewMode;
  draftsViewMode: PantryViewMode;
  setPantryViewMode: (mode: PantryViewMode) => Promise<void>;
  setDraftsViewMode: (mode: PantryViewMode) => Promise<void>;
  hydrate: () => Promise<void>;
}

let userHasToggledPantryViewMode = false;
let pantryViewModeGeneration = 0;

export function resetPantryViewModeState() {
  pantryViewModeGeneration++;
  userHasToggledPantryViewMode = false;
  useUiPreferencesStore.setState({ pantryViewMode: 'list' });
}

export function getPantryViewModeGeneration(): number {
  return pantryViewModeGeneration;
}

export const useUiPreferencesStore = create<UiPreferencesState>((set) => {
  const currentGen = pantryViewModeGeneration;
  AsyncStorage.getItem(PANTRY_VIEW_MODE_STORAGE_KEY)
    .then((stored) => {
      // Invariant: if resetPantryViewModeState() or setPantryViewMode() was invoked
      // while getItem was in flight, discard the stale result
      if (currentGen !== pantryViewModeGeneration) return;
      if (!userHasToggledPantryViewMode && (stored === 'list' || stored === 'grid')) {
        set({ pantryViewMode: stored });
      }
    })
    .catch(() => {});

  AsyncStorage.getItem(DRAFTS_VIEW_MODE_STORAGE_KEY)
    .then((stored) => {
      if (stored === 'list' || stored === 'grid') {
        set({ draftsViewMode: stored });
      }
    })
    .catch(() => {});

  return {
    pantryViewMode: 'list',
    draftsViewMode: 'list',
    setPantryViewMode: async (mode: PantryViewMode) => {
      pantryViewModeGeneration++;
      userHasToggledPantryViewMode = true;
      set({ pantryViewMode: mode });
      try {
        await AsyncStorage.setItem(PANTRY_VIEW_MODE_STORAGE_KEY, mode);
      } catch {
        /* best-effort */
      }
    },
    setDraftsViewMode: async (mode: PantryViewMode) => {
      set({ draftsViewMode: mode });
      try {
        await AsyncStorage.setItem(DRAFTS_VIEW_MODE_STORAGE_KEY, mode);
      } catch {
        /* best-effort */
      }
    },
    hydrate: async () => {
      const currentGen = pantryViewModeGeneration;
      try {
        const res = await apiClient.get<{
          uiPreferences?: {
            pantryViewMode?: PantryViewMode;
          } | null;
        }>('/me/preferences');

        if (currentGen !== pantryViewModeGeneration) return;
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
