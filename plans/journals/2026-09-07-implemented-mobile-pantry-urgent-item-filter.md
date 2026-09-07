---
title: Delivered Mobile Pantry Urgent Items Interactive Filter and Urgency Section Preservation
date: 2026-09-07
summary: "Implemented 2-way interactive urgent filter toggle on top-bar pill, preserved urgency sections (Expired, Today, This week) across all combined queries including search/category, wired bidirectional chip/modal sync, auto-switch from History, and resolved all code-review findings."
---

# Delivered Mobile Pantry Urgent Items Interactive Filter and Urgency Section Preservation

## Summary of Implementation

1. **Filter Pipeline & Types (`pantryFilterTypes.ts`, `filterAndSortRecords.ts`)**:
   - Added `'urgent'` to `PantryFilterState.expiryStatus`.
   - Updated `filterAndSortRecords` to match records with `expiryStatus` of `'red'` or `'amber'` ($\le 7\text{ days}$).
   - Threaded `now: Date` parameter through `filterAndSortRecords` and `expiryStatus` to guarantee accurate date-math across calendar midnight.

2. **Urgency Section Preservation (`RecordList.tsx`)**:
   - Resolved advisor concern: when `filters.expiryStatus === 'urgent'`, `paginatedItems` are grouped by urgency into `Expired`, `Expires today`, and `Use this week` sections across **all** combined queries (including text search and category filters), preventing list collapse into a single flat view.
   - Enforced `activeSort = 'expiry_asc'` when urgent filter is active to eliminate pagination clustering fragmentation.
   - Tied `currentDate` and `dayTick` to `groups` and `filteredRecords` memoization.

3. **Accessible Header Pill Toggle (`home.tsx`)**:
   - Upgraded static count pill into an accessible `<Pressable>` with $44 \times 44\text{ pt}$ hit-box (`hitSlop={8}`).
   - Rendered active Honey (`#F5A623`) background with Almost Black (`#2C2C28`) label and `funnel` icon, ensuring full WCAG 2.1 AA contrast ($> 6.9:1$) across both light and dark themes (`expyricoDark`).
   - Wired cross-tab continuity: tapping urgent pill while viewing `History` tab switches to `In Stock` tab and applies the urgent filter.
   - Added `usePantryScope` listener to deactivate the urgent filter on household scope changes.
   - Auto-resets filter when `totalUrgent` drops to 0.

4. **Bidirectional Synchronization (`PantryActiveFilterChips.tsx`, `PantryFilterModal.tsx`)**:
   - Added `Status: Urgent (≤ 7 days)` chip with $\ge 44\text{ pt}$ accessible dismiss touch target.
   - Added `Urgent` choice pill to `EXPIRY STATUS` section in Filter Modal with `accessibilityState.selected`.

5. **Verification & Hardening**:
   - 100% test pass rate across unit and integration suites (766 tests in mobile suite).
   - Added comprehensive integration tests covering combined search+urgent grouping, category+urgent grouping, zero-urgent auto-reset, and scope-change resets.
   - Android Gradle local debug APK assembled cleanly (`BUILD SUCCESSFUL in 30s`).
