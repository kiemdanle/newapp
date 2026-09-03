---
phase: 5
title: "FilterModal Integration, Search, and End-to-End Verification"
status: completed
priority: P1
effort: "4-5h"
dependencies: ["phase-04-move-and-assign-scope-ux.md"]
---

# Phase 5: FilterModal Integration, Search, and End-to-End Verification

## Overview
Harmonize the advanced `PantryFilterModal` with top-level pantry scope, verify search and urgency sorting across unified personal and shared records, and run complete multi-tier automated test verification.

## Requirements
- Functional:
  - Verify `filterAndSortRecords` in `apps/mobile/src/features/records/filterAndSortRecords.ts` operates seamlessly across mixed personal and shared records.
  - Search queries match items regardless of whether they are personal or shared.
  - Expiry urgency sorting (`expiry_asc`) groups and sorts mixed items purely by days remaining until expiration.
  - `PantryFilterModal` and `PantryActiveFilterChips` harmonize with the active scope without conflicting states.
- Non-functional:
  - Zero UI lag: Filter and sort operations on lists of up to 500 local records complete under 16ms (60 fps frame budget).
  - Memory isolation: Filter states reset cleanly when switching scopes.
- Verification & Test Coverage:
  - Integration test: `apps/mobile/tests/integration/unified-pantry-sharing.test.tsx`.
  - Unit tests across all touched features.
  - Typecheck verification with zero TypeScript diagnostics.

## Architecture

### Test Matrix

| Layer | Target | Test File | Key Assertions |
|-------|--------|-----------|----------------|
| **Store & Query** | `pantryScope.ts` & `records.ts` | `tests/unit/pantry-scope.test.ts` | Scope initialization, transitions (`all`, `personal`, `household`), query conditions without `household_id` |
| **UI Switcher** | `ScopeToggle.tsx` | `tests/unit/scope-toggle.test.tsx` | Hidden when 0 households, renders segments when $\ge 1$ household, click updates store |
| **Visual Attribution** | `RecordCard.tsx` | `tests/unit/record-card-household-badge.test.tsx` | Renders badge on shared items, hides badge on personal items, accessibility labels |
| **Reassignment** | `RecordDetail` & `patchLocalRecord` | `tests/unit/record-scope-reassign.test.tsx` | Move personal $\rightarrow$ household, move household $\rightarrow$ personal, database update |
| **End-to-End** | Full Pantry Flow | `tests/integration/unified-pantry-sharing.test.tsx` | Unified list sorting, switching to Personal, switching to Household, searching shared items |

## Related Code Files
- Modify:
  - `apps/mobile/src/features/records/PantryFilterModal.tsx`
  - `apps/mobile/src/features/records/filterAndSortRecords.ts`
  - `apps/mobile/src/features/records/PantryActiveFilterChips.tsx`
- Create:
  - `apps/mobile/tests/integration/unified-pantry-sharing.test.tsx`

## Implementation Steps
1. Review `filterAndSortRecords.ts` to ensure `householdScope` filter respects `'all'`, `'personal'`, and `'household'`.
2. Verify `PantryFilterModal.tsx` displays household scope options only when member households exist.
3. Write end-to-end integration test in `apps/mobile/tests/integration/unified-pantry-sharing.test.tsx`.
4. Run full Jest test suite across `apps/mobile/tests/`.
5. Run TypeScript compiler to ensure 0 diagnostics across the entire mobile package.

## Success Criteria
- [x] In `All` mode, search returns matching items whether they are personal or shared.
- [x] Urgency sort (`Expiring Soon`) correctly interleaves personal and shared groceries according to expiration date.
- [x] Comprehensive integration test validates:
  1. Default `All` view displays combined records.
  2. Tapping `Personal` filters to personal only.
  3. Tapping `Household` filters to household only.
  4. Moving an item updates view membership immediately.
  5. Badges accurately reflect household names.
- [x] 100% of mobile unit and integration tests pass.
- [x] Zero TypeScript errors in `apps/mobile`.

## Risk Assessment
- **Risk**: Filter modal's internal `draftFilters.householdScope` could conflict with `ScopeToggle`'s active selection.
- **Mitigation**: Synchronize `householdScope` in `PantryFilterModal` with `usePantryScope()` when the modal opens, treating the modal as an alternate editor of the same underlying preference.
- **Observable Signal**: Closing the filter modal unexpectedly changes the active tab.
- **Pre-decided Response**: If filter modal has `householdScope`, applying it calls `setScope(draftFilters.householdScope)`.
