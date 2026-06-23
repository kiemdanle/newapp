// apps/mobile/src/store/pantryScope.ts
import { create } from 'zustand';

export type PantryScope = 'personal' | 'household';

interface ScopeState {
  scope: PantryScope;
  householdId: string | null;
  setScope: (scope: PantryScope, householdId?: string | null) => void;
}

export const usePantryScope = create<ScopeState>((set) => ({
  scope: 'personal',
  householdId: null,
  setScope: (scope, householdId = null) => set({ scope, householdId }),
}));
