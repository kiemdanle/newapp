---
phase: 4
title: "Home Pantry Discovery CTA and Default Household Mode"
status: completed
priority: P1
effort: "4-5h"
dependencies: ["phase-03-mobile-join-household-modal-and-deep-link.md"]
---

# Phase 4: Home Pantry Discovery CTA and Default Household Mode

## Overview
Surface a gentle, Expyrico-themed "Share Pantry" invitation chip on the main pantry screen when a user has zero households, and introduce a "Save new groceries to this household by default" mode so families don't have to reassign items one by one.

## Requirements
- Functional:
  - In `apps/mobile/src/features/households/ScopeToggle.tsx`:
    - When `households.length === 0`, instead of rendering nothing (`null`), render an inviting pill prompt:
      `[ 👥 Share pantry with family or roommates ]`
    - Tapping this prompt navigates straight to the Household screen (`navigation.navigate('Household')`).
    - Solo users immediately discover that pantry sharing exists with zero intrusion.
  - Default Household Mode:
    - Add `defaultHouseholdId: string | null` and `setDefaultHouseholdId` in `apps/mobile/src/store/pantryScope.ts`.
    - Persist `defaultHouseholdId` in client storage so preference survives app restarts.
    - In `HouseholdSettings.tsx`, add an Expyrico switch row:
      `"Save new items to this household by default"`
    - Keep the active pantry scope on launch as `'all'` (preserving Expyrico's unified anti-food-waste list); default household applies strictly to grocery creation pre-selection.
    - In `AddRecordForm.tsx`:
      - When creating a new item:
        - If `activeScope === 'household'` -> pre-select active household.
        - If `activeScope === 'all'` and `defaultHouseholdId` is set -> pre-select `defaultHouseholdId`.
        - Otherwise -> pre-select `null` (personal).
      - Users retain full ability to manually switch location before saving.
- Non-functional / Visual:
  - The discovery pill matches Expyrico Warm White `#FAFAF8`, Mint Mist `#D6F0E6`, and Fresh Sage `#4BAE8A` styling with zero visual clutter.
  - Accessible touch targets ($\ge 44$pt) and screen reader labels.

## Architecture
```
[Pantry Home Screen]
        │
   Households Count?
   ├── 0  ──► [ 👥 Share pantry with family ] ──► Navigate to Household Setup
   └── ≥1 ──► [ All │ Personal │ Family Kitchen ]
                    │
                    ▼
[Grocery Creation: AddRecordForm / Scan]
        │
   Pre-selection Hierarchy:
   1. Locked draft scope? ──────────────► null (Personal)
   2. Explicit 'household' tab active? ──► active household
   3. 'All' tab active + Default set? ───► defaultHouseholdId
   4. Fallback ──────────────────────────► null (Personal)
```

## Related Code Files
- Modify: `apps/mobile/src/features/households/ScopeToggle.tsx`
- Modify: `apps/mobile/src/store/pantryScope.ts`
- Modify: `apps/mobile/src/features/households/HouseholdSettings.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Create: `apps/mobile/tests/unit/pantry-share-discovery-and-default.test.tsx`

## Implementation Steps
1. Update `pantryScope.ts` with `defaultHouseholdId` and persistent AsyncStorage hydration.
2. Update `ScopeToggle.tsx` to display the `Share with family` prompt when `households.length === 0`.
3. Update `HouseholdSettings.tsx` with a clean toggle to mark a household as the default kitchen.
4. Update `AddRecordForm.tsx` to automatically inherit `defaultHouseholdId` when in unified `'all'` mode.
5. Add unit and component tests in `apps/mobile/tests/unit/pantry-share-discovery-and-default.test.tsx` verifying:
   - ScopeToggle renders discovery CTA when households is empty.
   - Tapping discovery CTA navigates to Household screen.
   - Setting a default household assigns new items to that household in `AddRecordForm`.
   - Disabling default household falls back to personal scope.
   - Launch view defaults to `'all'` even when default household is active.

## Success Criteria
- [x] Solo users see a helpful "Share pantry with family" prompt on the pantry screen.
- [x] Users can toggle a household as their default pantry.
- [x] Scanning or adding new items in `All` mode automatically tags them with the default household when configured.
- [x] All unit and regression tests pass with 100% assertions green.
<!-- Updated: Validation Session 1 - Launch view preserves 'all' while default household governs creation -->

## Risk Assessment
- **Risk**: If the default household is deleted or the user leaves it, subsequent item adds could fail with an invalid `householdId`.
- **Mitigation**: When `useDissolveHousehold` or `useRemoveMember` runs, or if the stored `defaultHouseholdId` is not found in `useMyHouseholds()`, automatically reset `defaultHouseholdId` to `null`.
- **Observable Signal**: Items failing sync due to foreign key constraints on deleted household.
- **Pre-decided Response**: In `pantryScope.ts`, validate `defaultHouseholdId` against `households` list and auto-clear if missing.
