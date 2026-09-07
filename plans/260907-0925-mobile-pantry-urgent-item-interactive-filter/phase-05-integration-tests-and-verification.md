---
phase: 5
title: "Integration Tests & Verification"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-01-filter-pipeline-and-types", "phase-02-sectioned-urgency-grouping", "phase-03-header-pill-toggle-and-tab-switching", "phase-04-filter-chips-and-modal-sync"]
---

# Phase 5: Integration Tests & Verification

## Overview
Implement automated regression and integration tests covering the urgent filtering pipeline, the advisor concern (urgent section preservation under combined search queries), cross-tab switching, and bidirectional chip synchronization, followed by local Android Gradle build verification.

## Requirements
- Functional:
  - Unit tests in `filterAndSortRecords.test.ts` or `pantry-filtering-and-pagination.test.tsx`:
    - Verify `expiryStatus === 'urgent'` returns all records $\le 7$ days out and excludes records $> 7$ days out.
    - Verify combined filter: `query: 'milk'` + `expiryStatus: 'urgent'` filters to only urgent items matching "milk".
  - Section rendering tests:
    - Verify `sections` contains `Expired`, `Expires today`, `Use this week` and omits `Later` when `expiryStatus === 'urgent'`.
    - **Advisor Concern Regression Test**: When `expiryStatus === 'urgent'` AND a search query is active (e.g. `query = 'bread'`), assert that results remain grouped in `Expired`, `Expires today`, `Use this week` sections instead of collapsing into a single `filtered_results` list.
    - When search finds no matches under urgent filter, assert `sections` is empty array (`[]`) and `pantry-filter-empty-card` is rendered.
  - Header pill & tab switching tests:
    - Tapping `testID="home-urgent-pill"` toggles `isUrgentActive`.
    - When `activeTab === 'history'`, tapping `testID="home-urgent-pill"` switches `activeTab` to `'in_stock'` and sets `isUrgentActive = true`.
    - Tapping the `(X)` dismiss on `PantryActiveFilterChips` resets `isUrgentActive` to `false` on the header pill.
- Non-functional:
  - Follow local Android build policy from `AGENTS.md` (local Gradle toolchain, no Expo CLI/EAS).

## Architecture & Test Scenarios

```
Test Matrix:
┌───────────────────────────┬─────────────────────────┬───────────────────────────────┐
│ Input Scenario            │ Expected Filtering      │ Expected List Presentation    │
├───────────────────────────┼─────────────────────────┼───────────────────────────────┤
│ Tap '3 urgent' pill       │ Filter records <= 7d    │ Sections: Expired, Today, Week│
│ Type 'Organic' in search  │ Records with 'Organic'  │ Sections: Expired, Today, Week│
│                           │ AND <= 7 days           │ (Advisor Concern Verifier)    │
│ Clear filter chip (X)     │ Reset to all records    │ Sections: Expired..Later (4)  │
│ Tap pill while in History │ Switch tab to In Stock  │ In Stock tab active +         │
│                           │ + filter <= 7 days      │ Urgent Sections               │
└───────────────────────────┴─────────────────────────┴───────────────────────────────┘
```

## Related Code Files
- Modify: `apps/mobile/tests/integration/pantry-filtering-and-pagination.test.tsx`
- Run: `apps/mobile/android` Gradle build

## Implementation Steps
1. **Write Filter Pipeline Tests**:
   Add test cases to `apps/mobile/tests/integration/pantry-filtering-and-pagination.test.tsx`:
   ```typescript
   it('filters records by urgent expiry status (expired, today, this week)', () => {
     const records = [
       makeRecord({ id: '1', expiryDate: '2026-09-01' }), // Expired
       makeRecord({ id: '2', expiryDate: '2026-09-07' }), // Today
       makeRecord({ id: '3', expiryDate: '2026-09-10' }), // This week
       makeRecord({ id: '4', expiryDate: '2026-09-30' }), // Later
     ];
     const urgent = filterAndSortRecords(records, { expiryStatus: 'urgent' });
     expect(urgent.map(r => r.id)).toEqual(['1', '2', '3']);
   });
   ```
2. **Write Advisor Concern Regression Test**:
   ```typescript
   it('preserves urgency sections when urgent filter is combined with search query', () => {
     const records = [
       makeRecord({ id: '1', customName: 'Organic Milk Expired', expiryDate: '2026-09-01' }),
       makeRecord({ id: '2', customName: 'Organic Milk Today', expiryDate: '2026-09-07' }),
       makeRecord({ id: '3', customName: 'Organic Milk Week', expiryDate: '2026-09-11' }),
       makeRecord({ id: '4', customName: 'Regular Cheese Expired', expiryDate: '2026-09-01' }),
     ];
     // Filtered by query "Organic" + urgent
     const filtered = filterAndSortRecords(records, { query: 'Organic', expiryStatus: 'urgent' });
     expect(filtered).toHaveLength(3);
     const groups = groupRecords(filtered);
     expect(groups.expired).toHaveLength(1);
     expect(groups.today).toHaveLength(1);
     expect(groups.thisWeek).toHaveLength(1);
     expect(groups.later).toHaveLength(0);
   });
   ```
3. **Execute Test Suite**:
   Run `npm test apps/mobile/tests/integration/pantry-filtering-and-pagination.test.tsx` and verify 100% pass rate.
4. **Android Build Verification**:
   Execute local debug build per `AGENTS.md`:
   ```bash
   cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
   ```

## Success Criteria
- [x] All new and existing pantry filter tests pass.
- [x] Advisor concern test explicitly verifies section preservation with search queries.
- [x] Gradle build generates `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk` without errors.

## Risk Assessment
- *Risk*: Pre-existing tests checking `isFiltered` might assume all filtered states yield `filtered_results`.
- *Mitigation*: Inspect existing tests in `pantry-filtering-and-pagination.test.tsx` and ensure tests expecting `filtered_results` specifically test non-urgent filters (e.g. `category` or `search` without `urgent`).
