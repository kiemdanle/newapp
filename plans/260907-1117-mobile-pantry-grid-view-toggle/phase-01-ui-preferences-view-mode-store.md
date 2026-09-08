---
phase: 1
title: "UI Preferences View Mode Store"
status: completed
priority: P1
effort: "45m"
dependencies: []
---

# Phase 1: UI Preferences View Mode Store

## Overview
Extend `useUiPreferencesStore` to manage and persist the user's pantry view layout preference (`'list' | 'grid'`), defaulting to `'list'` and persisting to `AsyncStorage` under `@expyrico_pantry_view_mode`.

## Requirements
- Functional:
  - Export `type PantryViewMode = 'list' | 'grid'`.
  - Add `pantryViewMode: PantryViewMode` (default `'list'`) to `UiPreferencesState`.
  - Add `setPantryViewMode: (mode: PantryViewMode) => Promise<void>` to store actions.
  - Automatically hydrate `pantryViewMode` from `AsyncStorage` key `@expyrico_pantry_view_mode` on app launch.
  - When `setPantryViewMode` is invoked, immediately update local state and write to `AsyncStorage`.
  - Reset `pantryViewMode` to default `'list'` and remove `@expyrico_pantry_view_mode` in `clearAllLocalUserData` on user logout to prevent cross-account leakage.
<!-- Updated: Red Team Session 1 - Scoped local persistence & logout cleanup -->
- Non-functional:
  - Synchronous immediate UI state update (zero perceivable delay when toggling).
  - TypeScript strict compliance with full unit test coverage.

## Architecture
```typescript
export type PantryViewMode = 'list' | 'grid';

const PANTRY_VIEW_MODE_STORAGE_KEY = '@expyrico_pantry_view_mode';

interface UiPreferencesState {
  menuButtonPosition: MenuButtonPosition | null;
  pantryViewMode: PantryViewMode;
  setMenuButtonPosition: (pos: MenuButtonPosition) => Promise<void>;
  setPantryViewMode: (mode: PantryViewMode) => Promise<void>;
  hydrate: () => Promise<void>;
}
```

## Related Code Files
- Modify: `apps/mobile/src/store/uiPreferencesStore.ts`
- Modify: `apps/mobile/src/auth/session-store.ts` (logout cleanup)
- Create/Modify: `apps/mobile/src/store/uiPreferencesStore.test.ts`

## Implementation Steps
1. **Update Types and Storage Key**:
   In `apps/mobile/src/store/uiPreferencesStore.ts`, export `type PantryViewMode = 'list' | 'grid'` and define `const PANTRY_VIEW_MODE_STORAGE_KEY = '@expyrico_pantry_view_mode'`.
2. **Implement State and Action**:
   In `useUiPreferencesStore`:
   - Initialize `pantryViewMode: 'list'`.
   - In the initial AsyncStorage hydration block, read `PANTRY_VIEW_MODE_STORAGE_KEY` and set `pantryViewMode` if value is `'list'` or `'grid'`.
   - Implement `setPantryViewMode`:
     ```typescript
     setPantryViewMode: async (mode: PantryViewMode) => {
       set({ pantryViewMode: mode });
       try {
         await AsyncStorage.setItem(PANTRY_VIEW_MODE_STORAGE_KEY, mode);
       } catch {}
     },
     ```
   - In `apps/mobile/src/auth/session-store.ts`, add removal of `PANTRY_VIEW_MODE_STORAGE_KEY` and reset `useUiPreferencesStore.setState({ pantryViewMode: 'list' })` in `clearAllLocalUserData`.
3. **Unit Testing**:
   Create or extend `uiPreferencesStore.test.ts` asserting:
   - Default value is `'list'`.
   - Calling `setPantryViewMode('grid')` updates state and calls `AsyncStorage.setItem`.
   - Launch hydration restores stored `'grid'` preference.

## Success Criteria
- [x] `useUiPreferencesStore.getState().pantryViewMode` defaults to `'list'`.
- [x] Calling `setPantryViewMode('grid')` sets `pantryViewMode` to `'grid'`.
- [x] Storage key `@expyrico_pantry_view_mode` stores the selected mode.
- [x] Unit tests pass cleanly.

## Risk Assessment
- *Risk*: Corrupted or invalid string in AsyncStorage could crash store.
- *Mitigation*: Validate `val === 'list' || val === 'grid'` before applying hydrated value; fallback to `'list'`.
