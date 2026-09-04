---
phase: 2
title: "Scan and Create Scope Picker with User Settings Default"
status: done
priority: P1
effort: "3-4h"
dependencies: [1]
---

# Phase 2: Scan and Create Scope Picker with User Settings Default

## Overview
Empower users to explicitly designate where new items should be saved (Personal Pantry or a shared Household) during both barcode/QR scanning and manual item creation. The selector automatically defaults to the user's preferred pantry destination configured in User Settings, eliminating redundant manual choices while retaining full item-by-item control.

## Requirements

### Functional
- **Creation Scope Selector**:
  - `scan.tsx`, `product/new.tsx`, and `AddRecordForm.tsx` provide an interactive `ScopeSelectorPill`:
    - Shows `"Personal"` (Private) and each joined household (e.g., `"Our Kitchen"`).
    - If user belongs to 0 households, the selector is cleanly hidden and items automatically save to Personal.
  - Pre-selected by default according to the user's configured default pantry setting.
- **Configurable Default in User Settings**:
  - In `apps/mobile/app/(app)/settings/index.tsx`, introduce a dedicated `"Default Pantry for New Items"` preference item.
  - Opening the setting presents an option list:
    - `"Personal Pantry (Private)"`
    - `"Household: [Household Name]"` (for each household the user belongs to).
  - Changing this setting immediately persists the choice:
    <!-- Updated: Red Team Review - Use PATCH /v1/me/preferences and uiPreferences column -->
    1. In local `AsyncStorage` (`@expyrico_default_pantry_target`) for zero-latency offline reads.
    2. Synchronized to the backend database via `PATCH /v1/me/preferences` (saving `uiPreferences.defaultPantryScope` and `uiPreferences.defaultHouseholdId`).
- **Scope Indicator on Confirmation**:
  - Scanning confirmation banner / toast explicitly states destination: `"Added milk to Our Kitchen"` or `"Added milk to Personal Pantry"`.

### Non-Functional
- **Zero-Friction Default**: Users who prefer all items to go to their household or personal pantry never need to interact with the picker; it automatically defaults to their saved preference.
- **Theme Consistency**: Selector adheres to the Expyrico palette:
  - Active segment: Fresh Sage (`#4BAE8A`) with white text.
  - Inactive segment: Transparent with text muted (`#8C8C85`).
  - Container: Elevated background with 1px Stone border (`#F0F0ED`).

## Architecture & Data Flow

```
[User Settings] ──► Tap "Default Pantry for New Items" ──► Select "Our Kitchen"
       │
       ├──► AsyncStorage.setItem('@expyrico_default_pantry_target', ...)
       └──► PATCH /v1/me/preferences { defaultPantryScope: 'household', defaultHouseholdId: '...' }
       │
       ▼
[User Scans Item in scan.tsx]
       │
       ├── Reads active default from usePantryScope() store
       ├── Renders ScopeSelectorPill pre-selecting "Our Kitchen"
       │
[User can tap "Personal" to override for this specific item]
       │
       ▼
[Save Item] ──► createLocalRecord({ ..., householdId: selectedHouseholdId })
       │
       ▼
Syncs to Postgres under resolved householdId or null
```

## Related Code Files

### Create
- `apps/mobile/src/features/records/ScopeSelectorPill.tsx` — Reusable segmented scope picker component.
- `apps/mobile/tests/unit/scope-selector-pill.test.tsx` — Unit tests for rendering, selection change, and 0-household hide behavior.
- `apps/mobile/src/features/settings/DefaultPantryModal.tsx` — Modal sheet in settings to configure default pantry target.

### Modify
- `apps/mobile/src/store/pantryScope.ts` — Expand store to track `defaultPantryTarget: { scope: 'personal' | 'household', householdId: string | null }`.
- `apps/mobile/app/(app)/scan.tsx` — Integrate `ScopeSelectorPill` into scan preview / review cards.
- `apps/mobile/src/features/records/AddRecordForm.tsx` — Replace single-switch logic with full `ScopeSelectorPill`.
- `apps/mobile/app/(app)/settings/index.tsx` — Add "Default Pantry for New Items" settings row.
- `api/src/routes/me/preferences.ts` — Accept and validate `defaultPantryScope` and `defaultHouseholdId` in user preferences.
- `packages/shared/src/schemas/user.ts` — Add validation schema for pantry preferences.

## Implementation Steps

1. **Shared Schema & API (`packages/shared`, `api`)**:
   <!-- Updated: Red Team Review - Registered under /v1/me/preferences -->
   - In `packages/shared/src/schemas/user.ts`, define `userUiPreferencesSchema`:
     ```typescript
     export const userUiPreferencesSchema = z.object({
       defaultPantryScope: z.enum(['personal', 'household']).optional(),
       defaultHouseholdId: z.string().uuid().nullable().optional(),
     }).strict();
     ```
   - In `api/src/routes/me/preferences.ts` (registered in `api/src/routes/me/index.ts`), implement `PATCH /v1/me/preferences` allowing the authenticated user to update their own `uiPreferences`.
   - Props:
     ```typescript
     interface ScopeSelectorPillProps {
       selectedScope: 'personal' | 'household';
       selectedHouseholdId: string | null;
       onChange: (scope: 'personal' | 'household', householdId: string | null) => void;
     }
     ```
   - Renders segmented pill control with smooth selection transitions.
   - If user has multiple households, provides household picker dropdown/sheet.

4. **Integration into Scan & Creation Flows**:
   - `scan.tsx`: Render `ScopeSelectorPill` directly above the "Add to Pantry" button.
   - `AddRecordForm.tsx`: Replace basic toggle with `ScopeSelectorPill`.

5. **Settings UI (`settings/index.tsx` & `DefaultPantryModal.tsx`)**:
   - Add new settings row under Account / Preferences:
     - Title: `"Default Pantry for New Items"`
     - Subtitle: Reflects current choice (e.g. `"Our Kitchen"` or `"Personal Pantry"`).
     - Tapping opens `DefaultPantryModal` with radio options.

## Success Criteria

- [x] Scan and manual item creation forms display `ScopeSelectorPill` with options for Personal and joined households.
- [x] Selector automatically defaults to the user's configured default pantry setting.
- [x] User Settings offers a dedicated "Default Pantry for New Items" configuration sheet.
- [x] Changing default pantry updates local storage immediately and syncs to backend user preferences.
- [x] If user has 0 households, the selector is cleanly hidden and items default to Personal.
- [x] All new components covered with automated unit tests.

## Risk Assessment

- **Risk**: User selects a household they were recently removed from while offline.
  <!-- Updated: Red Team Review - Do not destroy record, revert to Personal pantry -->
  - **Observable Signal**: Backend returns 403 `HOUSEHOLD_NOT_MEMBER` during sync push.
  - **Mitigation**: Update `apps/mobile/src/db/sync.ts:80`: on 403/404, instead of calling `rec.destroyPermanently()`, revert `householdId = null` and clear `pendingSync = false`. The user's item is safely preserved in their Personal Pantry, accompanied by an in-app banner: `"Removed from shared household — item saved to your Personal Pantry."`
