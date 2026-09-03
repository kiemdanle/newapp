---
phase: 3
title: "Filter Modal and Multi-Attribute Sheet"
status: pending
priority: P1
effort: "6h"
dependencies: [1, 2]
---

# Phase 3: Filter Modal and Multi-Attribute Sheet
<!-- Updated: Validation Session 1 - Confirmed dynamic hybrid category taxonomy and match preview -->

## Overview

Implement a slide-up bottom sheet modal (`PantryFilterModal.tsx`) providing multi-attribute filtering capabilities for pantry inventory. The modal allows users to filter by expiry status, food categories, in-stock status, and household scope, complete with a live count preview of matching items on the primary CTA button and a one-tap reset.

## Requirements

### Functional
- **Modal Lifecycle**:
  - Open/close via `visible` and `onClose` props.
  - Semi-transparent backdrop dismissing the modal on press.
  - Header with title "Filters", close `(X)` icon, and accessible labels.
- **Expiry Status Section**:
  - Segmented pills for:
    - `All`: All items regardless of date.
    - `Expiring soon`: Items expiring within 7 days (Honey `#F5A623` text, Soft Butter `#FEEFC3` background).
    - `Expired`: Items past expiration date (Alert Red `#E0442A` text, light glass background).
    - `Good`: Items with plenty of shelf life (Fresh Sage `#4BAE8A` text, Mint Mist `#D6F0E6` background).
- **Category Filter Section**:
  - Dynamic category list aggregated from the user's active pantry records plus standard pantry presets:
    - `'Produce'`, `'Dairy'`, `'Meat & Seafood'`, `'Bakery'`, `'Pantry'`, `'Frozen'`, `'Beverages'`, `'Snacks'`, `'Condiments'`, `'Other'`.
  - Wrapping chip layout displaying category name and item count badge (e.g. `"Dairy (5)"`).
  - Single-select or multi-select toggle with visual checkmark / active state.
- **Stock & Scope Toggles**:
  - Switch/Toggle for "In-stock only" (excludes records where `quantity <= 0`).
  - Household scope selector if user belongs to an active household (`'all' | 'personal' | 'household'`).
- **Footer Actions**:
  - "Reset" button reverting local modal state to defaults.
  - "Apply Filters" button displaying dynamic matching count (e.g., `"Apply Filters (14 items)"`).
  - Tapping "Apply Filters" calls `onApply(updatedFilters)` and closes the modal.

### Non-functional
- Strict Expyrico palette compliance:
  - Primary CTA uses Honey (`#F5A623`) background with Almost Black (`#2C2C28`) bold text.
  - Alert Red (`#E0442A`) is used strictly for the "Expired" status badge and nowhere else.
  - Sheet background uses `theme.colors.bg` (`#FAFAF8`).
- Smooth animation with React Native `Modal` (`animationType="slide"`).
- Keyboard avoiding handling for small screens.

## Architecture

```
+-------------------------------------------------------------------------------+
| PantryFilterModal (Modal Sheet)                                               |
|                                                                               |
|  [Header: "Filters"                                                    (X)]   |
|                                                                               |
|  EXPIRY STATUS                                                                |
|  [ All ]  [ ⏳ Expiring Soon ]  [ ⚠️ Expired ]  [ ✅ Good ]                  |
|                                                                               |
|  CATEGORY                                                                     |
|  [ All ]  [ Dairy (4)* ]  [ Produce (6) ]  [ Bakery (2) ]  [ Pantry (12) ]    |
|                                                                               |
|  STOCK & AVAILABILITY                                                         |
|  [ Toggle: In-stock items only (>0)                                       [X] ]|
|                                                                               |
|  HOUSEHOLD SCOPE                                                              |
|  (•) All Items      ( ) Personal Only      ( ) Household Only                 |
|                                                                               |
|  ---------------------------------------------------------------------------  |
|  [ Reset All ]                           [ Apply Filters (14 Items) (CTA) ]   |
+-------------------------------------------------------------------------------+
```

## Related Code Files

- Create: `apps/mobile/src/features/records/PantryFilterModal.tsx`
- Create: `apps/mobile/tests/unit/pantry-filter-modal.test.tsx`
- Modify: `apps/mobile/src/features/records/pantryFilterTypes.ts` (if additional modal helper types needed)

## Implementation Steps

1. **Build `PantryFilterModal.tsx` Component**:
   - Create props: `visible`, `onClose`, `filters`, `onApply`, `records: LocalRecord[]`.
   - Maintain draft state for `draftFilters` inside the modal so adjustments don't immediately mutate the parent view until "Apply" is tapped.
   - Sync `draftFilters` from incoming `filters` whenever `visible` transitions from false to true.
2. **Implement Category Aggregator**:
   - Extract unique categories from `records` and calculate counts per category.
   - Merge with standard category taxonomy so empty categories are either omitted or shown with 0.
   - Render categories as touchable pills with active highlighting using `theme.colors.primary` and `theme.colors.primaryLight`.
3. **Implement Expiry Status Selector**:
   - Create status selector with proper semantic styling:
     - Amber/Soft Butter for `expiring_soon`.
     - Alert Red for `expired`.
     - Fresh Sage/Mint Mist for `good`.
4. **Implement Real-time Match Count Preview**:
   - Run `filterAndSortRecords(records, draftFilters, 'expiry_asc')` within `useMemo` to compute matching count in real time.
   - Update CTA button label to `"Apply Filters (${matchCount} items)"` or `"No Matching Items"` if count is 0.
5. **Implement Reset and Apply Callbacks**:
   - "Reset": resets `draftFilters` to default `{ expiryStatus: 'all', category: undefined, inStockOnly: false }`.
   - "Apply": calls `onApply(draftFilters)` and invokes `onClose()`.
6. **Write Unit Tests (`pantry-filter-modal.test.tsx`)**:
   - Verify modal renders all filter sections when `visible=true`.
   - Verify category selection updates draft state and preview count.
   - Verify expiry status toggles between All, Expiring Soon, Expired, and Good.
   - Verify Reset button clears draft selections.
   - Verify Apply button emits updated filters to parent callback.

## Success Criteria

- [x] Modal opens and closes smoothly with backdrop tap or close button.
- [x] Category list reflects the user's pantry contents with correct item counts.
- [x] Expiry status options apply the correct semantic brand colors.
- [x] Apply button displays live count preview of matching items.
- [x] All unit tests in `pantry-filter-modal.test.tsx` pass.

## Risk Assessment

- **Risk**: A user with hundreds of records might cause a re-render lag inside the modal when computing match preview.
  - **Mitigation**: Memoize category counts and filter preview using `useMemo` based on `[records, draftFilters]`.
  - **Broken Assumption Signal**: Lag when toggling category chips inside the modal.
  - **Response**: Filter computation is a simple array scan taking <1ms for up to 1,000 items; keep predicate functions strictly O(N) without nested lookups.
