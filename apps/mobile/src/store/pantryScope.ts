// apps/mobile/src/store/pantryScope.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PantryScope = 'all' | 'personal' | 'household';

const DEFAULT_HH_STORAGE_KEY = '@expyrico_default_household_id';

interface ScopeState {
  scope: PantryScope;
  householdId: string | null;
  defaultHouseholdId: string | null;
  setScope: (scope: PantryScope, householdId?: string | null) => void;
  setDefaultHouseholdId: (defaultHouseholdId: string | null) => void;
}

export const usePantryScope = create<ScopeState>((set) => {
  // Hydrate stored default household preference asynchronously
  AsyncStorage.getItem(DEFAULT_HH_STORAGE_KEY)
    .then((stored) => {
      if (stored) {
        set({ defaultHouseholdId: stored });
      }
    })
    .catch(() => {});

  return {
    scope: 'all',
    householdId: null,
    defaultHouseholdId: null,
    setScope: (scope, householdId = null) => set({ scope, householdId }),
    setDefaultHouseholdId: (defaultHouseholdId) => {
      set({ defaultHouseholdId });
      if (defaultHouseholdId) {
        void AsyncStorage.setItem(DEFAULT_HH_STORAGE_KEY, defaultHouseholdId);
      } else {
        void AsyncStorage.removeItem(DEFAULT_HH_STORAGE_KEY);
      }
    },
  };
});
