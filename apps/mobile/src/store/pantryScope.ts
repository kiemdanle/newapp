// apps/mobile/src/store/pantryScope.ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

export type PantryScope = 'all' | 'personal' | 'household';

export interface DefaultPantryTarget {
  scope: 'personal' | 'household';
  householdId: string | null;
}

const DEFAULT_PANTRY_TARGET_KEY = '@expyrico_default_pantry_target';
const LEGACY_DEFAULT_HH_KEY = '@expyrico_default_household_id';

interface ScopeState {
  scope: PantryScope;
  householdId: string | null;
  defaultPantryTarget: DefaultPantryTarget;
  defaultHouseholdId: string | null;
  setScope: (scope: PantryScope, householdId?: string | null) => void;
  setDefaultHouseholdId: (defaultHouseholdId: string | null) => void;
  setDefaultPantryTarget: (target: DefaultPantryTarget) => Promise<void>;
  hydrateFromBackend: () => Promise<void>;
}

export const usePantryScope = create<ScopeState>((set, get) => {
  // Hydrate stored preference asynchronously
  AsyncStorage.getItem(DEFAULT_PANTRY_TARGET_KEY)
    .then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as DefaultPantryTarget;
          set({
            defaultPantryTarget: parsed,
            defaultHouseholdId: parsed.householdId,
          });
          return;
        } catch {}
      }
      // Fallback to legacy key
      return AsyncStorage.getItem(LEGACY_DEFAULT_HH_KEY).then((legacy) => {
        if (legacy) {
          const target: DefaultPantryTarget = { scope: 'household', householdId: legacy };
          set({ defaultPantryTarget: target, defaultHouseholdId: legacy });
        }
      });
    })
    .catch(() => {});

  return {
    scope: 'all',
    householdId: null,
    defaultPantryTarget: { scope: 'personal', householdId: null },
    defaultHouseholdId: null,
    setScope: (scope, householdId = null) => set({ scope, householdId }),
    setDefaultHouseholdId: (defaultHouseholdId) => {
      const target: DefaultPantryTarget = defaultHouseholdId
        ? { scope: 'household', householdId: defaultHouseholdId }
        : { scope: 'personal', householdId: null };
      void get().setDefaultPantryTarget(target);
    },
    setDefaultPantryTarget: async (target: DefaultPantryTarget) => {
      set({
        defaultPantryTarget: target,
        defaultHouseholdId: target.householdId,
      });
      try {
        await AsyncStorage.setItem(DEFAULT_PANTRY_TARGET_KEY, JSON.stringify(target));
        if (target.householdId) {
          await AsyncStorage.setItem(LEGACY_DEFAULT_HH_KEY, target.householdId);
        } else {
          await AsyncStorage.removeItem(LEGACY_DEFAULT_HH_KEY);
        }
      } catch {}

      // Synchronize with backend user preferences in background
      try {
        await apiClient.patch('/me/preferences', {
          uiPreferences: {
            defaultPantryScope: target.scope,
            defaultHouseholdId: target.householdId,
          },
        });
      } catch {
        // Silently fail if offline; local storage persists the choice
      }
    },
    hydrateFromBackend: async () => {
      try {
        const res = await apiClient.get<{
          uiPreferences?: {
            defaultPantryScope?: 'personal' | 'household';
            defaultHouseholdId?: string | null;
          } | null;
        }>('/me/preferences');
        if (res.uiPreferences?.defaultPantryScope) {
          const target: DefaultPantryTarget = {
            scope: res.uiPreferences.defaultPantryScope,
            householdId: res.uiPreferences.defaultHouseholdId ?? null,
          };
          set({
            defaultPantryTarget: target,
            defaultHouseholdId: target.householdId,
          });
          await AsyncStorage.setItem(DEFAULT_PANTRY_TARGET_KEY, JSON.stringify(target));
        }
      } catch {}
    },
  };
});
