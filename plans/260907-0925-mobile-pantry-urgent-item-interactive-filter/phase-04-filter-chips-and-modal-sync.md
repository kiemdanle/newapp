---
phase: 4
title: "Filter Chips & Modal Synchronization"
status: completed
priority: P2
effort: "45m"
dependencies: ["phase-01-filter-pipeline-and-types", "phase-03-header-pill-toggle-and-tab-switching"]
---

# Phase 4: Filter Chips & Modal Synchronization

## Overview
Synchronize the `'urgent'` filter state across all auxiliary filtering UI surfaces: render an active chip in `PantryActiveFilterChips.tsx` so users can dismiss the urgent filter with one tap from the list controls, and add an "Urgent" quick-pill option in `PantryFilterModal.tsx`.

## Requirements
- Functional:
  - In `apps/mobile/src/features/records/PantryActiveFilterChips.tsx`, add a case for `filters.expiryStatus === 'urgent'`:
    - Label: `Status: Urgent (≤ 7 days)`
    - Styling: Honey / Soft Butter accent background (`theme.colors.accentLight`) and dark primary text (`theme.colors.primaryDark`).
    - Dismiss action: Calls `onRemoveFilter('expiryStatus')` which sets `expiryStatus: undefined` (resetting to all), automatically deactivating the header pill.
  - In `apps/mobile/src/features/records/PantryFilterModal.tsx`, add `'urgent'` to the `EXPIRY STATUS` pill list:
    - Options: `All Items`, `Urgent`, `Expiring Soon`, `Fresh / Good`, `Expired`.
    - Selection style for `'urgent'` uses Soft Butter background with Honey border.
  - When resetting filters via `handleClearAll` or Modal Reset, ensure `expiryStatus` resets to `'all'`, clearing both chip and header pill.
- Non-functional:
  - Accessible touch targets for chip dismiss `(X)` buttons ($\ge 44 \times 44\text{ pt}$ hitSlop).
  - Consistent token usage from Expyrico palette.

## Architecture
```
User Actions & Synchronized Surfaces:

[Header Pill Tap] ──► sets expiryStatus='urgent' ──► shows 'Urgent (≤ 7 days)' chip
                                                 ──► selects 'Urgent' in Filter Modal

[Chip (X) Tap]   ──► clears expiryStatus         ──► un-highlights Header Pill
                                                 ──► selects 'All Items' in Filter Modal

[Filter Modal]   ──► select 'Urgent' + Apply    ──► highlights Header Pill
                                                 ──► shows 'Urgent (≤ 7 days)' chip
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/PantryActiveFilterChips.tsx`
- Modify: `apps/mobile/src/features/records/PantryFilterModal.tsx`

## Implementation Steps
1. **Add Urgent Chip in `PantryActiveFilterChips.tsx`**:
   Update `filters.expiryStatus` formatting:
   ```typescript
   if (filters.expiryStatus && filters.expiryStatus !== 'all') {
     let label = 'Status: Good';
     let color = theme.colors.primaryDark;
     let bg = theme.colors.primaryLight;

     if (filters.expiryStatus === 'urgent') {
       label = 'Status: Urgent (≤ 7 days)';
       color = theme.colors.primaryDark;
       bg = theme.colors.accentLight;
     } else if (filters.expiryStatus === 'expired') {
       label = 'Status: Expired';
       color = theme.colors.danger;
       bg = theme.colors.bgGlass;
     } else if (filters.expiryStatus === 'expiring_soon') {
       label = 'Status: Expiring soon';
       color = theme.colors.primaryDark;
       bg = theme.colors.accentLight;
     }

     chips.push({
       id: 'expiryStatus',
       label,
       color,
       bg,
       onRemove: () => onRemoveFilter('expiryStatus'),
     });
   }
   ```
2. **Add Urgent Option in `PantryFilterModal.tsx`**:
   Under `EXPIRY STATUS` pills:
   ```typescript
   [
     { id: 'all', label: 'All Items' },
     { id: 'urgent', label: 'Urgent' },
     { id: 'expiring_soon', label: 'Expiring Soon' },
     { id: 'good', label: 'Fresh / Good' },
     { id: 'expired', label: 'Expired' },
   ]
   ```
   Apply `accentLight` and `accent` border when `item.id === 'urgent'`.
3. **Verify Chip Dismiss Flow**:
   Ensure clicking the chip's `(X)` removes the chip, clears `expiryStatus` in `RecordList`, and resets `isUrgentActive` in `HomeTab`.

## Success Criteria
- [x] Active filter chips bar displays `Status: Urgent (≤ 7 days)` when urgent filter is on.
- [x] Tapping `(X)` on the urgent chip clears the filter and toggles off the header pill.
- [x] Tapping "Clear all" in active chips or modal clears the urgent filter.
- [x] Opening the Filter Modal shows "Urgent" pill selected when urgent filter is active.
- [x] Selecting "Urgent" in the Filter Modal and applying activates the header pill.

## Risk Assessment
- *Risk*: Desynchronization between `PantryFilterModal` draft state and external header state.
- *Mitigation*: `PantryFilterModal` already synchronizes its draft filters from incoming `filters` whenever `visible` becomes true.
