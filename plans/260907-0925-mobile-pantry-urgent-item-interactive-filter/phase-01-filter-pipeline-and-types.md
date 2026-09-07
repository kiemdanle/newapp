---
phase: 1
title: "Filter Pipeline & Types"
status: completed
priority: P1
effort: "45m"
dependencies: []
---

# Phase 1: Filter Pipeline & Types

## Overview
Extend `PantryFilterState` to include the `'urgent'` expiry status and update the core `filterAndSortRecords` filtering pipeline to match records that are either expired or expiring within 7 days.

## Requirements
- Functional:
  - Add `'urgent'` to `PantryFilterState.expiryStatus` type union (`'all' | 'expired' | 'expiring_soon' | 'good' | 'urgent'`).
  - In `filterAndSortRecords.ts`, add a branch for `filters.expiryStatus === 'urgent'` that returns true if `expiryStatus(record.expiryDate)` is `'red'` or `'amber'`.
  - Ensure compatibility with other filter dimensions (search `query`, `category`, `inStockOnly`, `householdScope`, `store`).
- Non-functional:
  - Strict TypeScript compliance across all consumers of `PantryFilterState`.
  - Zero performance regression in the filter loop ($O(N)$ single pass).

## Architecture
`PantryFilterState` defines all active pantry filtering dimensions. When `expiryStatus` is set to `'urgent'`, `filterAndSortRecords` evaluates each item against the canonical `expiryStatus()` helper. Because `expiryStatus()` returns `'red'` for expired/today items and `'amber'` for items expiring within `DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS` (7 days), matching `'red' | 'amber'` exactly covers the definition of `totalUrgent` from `groupRecords`.

## Related Code Files
- Modify: `apps/mobile/src/features/records/pantryFilterTypes.ts`
- Modify: `apps/mobile/src/features/records/filterAndSortRecords.ts`

## Implementation Steps
1. **Update Filter Types**:
   In `apps/mobile/src/features/records/pantryFilterTypes.ts`, update `PantryFilterState`:
   ```typescript
   export interface PantryFilterState {
     query?: string;
     category?: string;
     expiryStatus?: 'all' | 'expired' | 'expiring_soon' | 'good' | 'urgent';
     inStockOnly?: boolean;
     householdScope?: 'all' | 'personal' | 'household';
     store?: string;
   }
   ```
2. **Update Filter Pipeline Logic**:
   In `apps/mobile/src/features/records/filterAndSortRecords.ts`, update the `expiryStatus` block:
   ```typescript
   if (filters.expiryStatus && filters.expiryStatus !== 'all') {
     const status = expiryStatus(record.expiryDate);
     if (filters.expiryStatus === 'urgent' && status !== 'red' && status !== 'amber') {
       return false;
     }
     if (filters.expiryStatus === 'expired' && status !== 'red') {
       return false;
     }
     if (filters.expiryStatus === 'expiring_soon' && status !== 'amber') {
       return false;
     }
     if (filters.expiryStatus === 'good' && status !== 'green') {
       return false;
     }
   }
   ```
3. **Verify Type Checking**:
   Run TypeScript type check on `apps/mobile` to verify no broken consumers.

## Success Criteria
- [x] `PantryFilterState.expiryStatus` type includes `'urgent'`.
- [x] `filterAndSortRecords` returns only records with status `'red'` or `'amber'` when `filters.expiryStatus === 'urgent'`.
- [x] All other filters (query, category, store, stock) compose cleanly with `expiryStatus === 'urgent'`.
- [x] TypeScript compilation succeeds with zero errors in `pantryFilterTypes.ts` and `filterAndSortRecords.ts`.

## Risk Assessment
- *Risk*: Discrepancy between `groupRecords` (which uses start of day UTC + 7 days) and `expiryStatus` (which uses days diff $\le 7$).
- *Mitigation*: Both already align on 7 days threshold (`DEFAULT_EXPIRING_SOON_THRESHOLD_DAYS = 7`). Add integration test verifying that items grouped under `expired`, `today`, and `thisWeek` all evaluate to status `'red'` or `'amber'`.
