---
phase: 1
title: "Filtering and Sorting Engine"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Filtering and Sorting Engine
<!-- Updated: Validation Session 1 - Confirmed broad multi-attribute search (customName, brand, category, notes, store) and stable deterministic sorting -->

## Overview

Deliver the foundational TypeScript interfaces, state contracts, and pure computational functions for searching, filtering, and sorting local WatermelonDB pantry records. This phase creates a thoroughly tested engine (`filterAndSortRecords.ts`) with zero UI dependencies, allowing complex filtering and multi-attribute sorting to run with predictable, sub-millisecond execution.

## Requirements

### Functional
- Define `PantrySortOption` enum/union supporting:
  - `'expiry_asc'`: Expiring soonest first (default pantry sort).
  - `'expiry_desc'`: Expiring latest first.
  - `'name_asc'`: Alphabetical A-Z by item display name (customName or fallback).
  - `'name_desc'`: Alphabetical Z-A.
  - `'quantity_desc'`: Highest quantity / stock first.
  - `'quantity_asc'`: Lowest quantity / stock first.
  - `'recently_added'`: Most recently created/updated items first.
- Define `PantryFilterState` interface supporting:
  - `query?: string`: Free-text search string.
  - `category?: string`: Selected food category (e.g., `'Produce'`, `'Dairy'`).
  - `expiryStatus?: 'all' | 'expired' | 'expiring_soon' | 'good'`: Expiry status filter.
  - `inStockOnly?: boolean`: Whether to exclude items with `quantity <= 0`.
  - `householdScope?: 'all' | 'personal' | 'household'`: Scope filter.
- Implement `filterAndSortRecords(records: LocalRecord[], filters: PantryFilterState, sort: PantrySortOption, productNameLookup?: Record<string, string>): LocalRecord[]`:
  - Search: matches case-insensitively against `customName`, `productNameLookup[productId]`, `category`, `notes`, and `store`.
  - Category: exact match (case-insensitive) against `record.category`.
  - Expiry status: evaluates `expiryStatus(record.expiryDate)` (`'red'` = expired, `'amber'` = expiring soon, `'green'` = good) and filters accordingly.
  - In stock: filters `record.quantity > 0` when `inStockOnly` is true.
  - Sorting: performs a deterministic, stable sort with secondary tie-breaker by `record.id`.

### Non-functional
- Pure functions: no side effects, mutations, or I/O.
- In-memory array operations designed for efficient execution, with timing benchmarks executed in Phase 5.
- 100% test coverage covering every sort option, filter combination, and edge cases (empty strings, null values, identical dates).

## Architecture

```
                       +-------------------------+
                       |  LocalRecord[] (from DB) |
                       +-------------------------+
                                    |
                                    v
                       +-------------------------+
                       |   Filter Predicates     |
                       |  - Text Search (q)      |
                       |  - Category             |
                       |  - Expiry Status        |
                       |  - In-stock Only        |
                       +-------------------------+
                                    |
                                    v
                       +-------------------------+
                       |    Stable Sorting       |
                       |  - Primary: Selected    |
                       |  - Secondary: Expiry    |
                       |  - Tie-breaker: ID      |
                       +-------------------------+
                                    |
                                    v
                       +-------------------------+
                       | Filtered & Sorted List  |
                       +-------------------------+
```

## Related Code Files

- Create: `apps/mobile/src/features/records/pantryFilterTypes.ts`
- Create: `apps/mobile/src/features/records/filterAndSortRecords.ts`
- Create: `apps/mobile/src/features/records/filterAndSortRecords.test.ts`
- Modify: `apps/mobile/src/features/records/index.ts` (if exporting shared features)

## Implementation Steps

1. **Create Type Definitions (`pantryFilterTypes.ts`)**:
   - Export `PantrySortOption` with all 7 sorting modes.
   - Export `PantryFilterState` with optional fields for `query`, `category`, `expiryStatus`, `inStockOnly`, and `householdScope`.
   - Export metadata mapping for sort labels, icons, and descriptions to ensure consistency across UI layers.
2. **Implement Filter Logic (`filterAndSortRecords.ts`)**:
   - Build individual filter predicate functions for modularity and testability (`matchesQuery`, `matchesCategory`, `matchesExpiryStatus`, `matchesStock`).
   - Use normalized lowercase strings for case-insensitive matching.
   - Guard against `null` or `undefined` properties on `LocalRecord`.
   - Utilize existing `expiryStatus()` helper from `apps/mobile/src/features/records/expiryStatus.ts` for semantic alignment with color tokens.
3. **Implement Sort Comparators (`filterAndSortRecords.ts`)**:
   - Implement comparator functions for each `PantrySortOption`.
   - Use `Intl.Collator` or `String.prototype.localeCompare` with `sensitivity: 'base'` for accurate natural string sorting.
   - Ensure null dates or missing values sort predictably to the end.
   - Always apply fallback tie-breaker `a.id.localeCompare(b.id)` to guarantee deterministic order across render cycles.
4. **Write Comprehensive Unit Tests (`filterAndSortRecords.test.ts`)**:
   - Test empty list returns empty list.
   - Test search matching across `customName`, `category`, `notes`, `store`, and product name lookup.
   - Test filter by category with exact and case-insensitive values.
   - Test filter by expiry status (expired, expiring soon, good).
   - Test in-stock only toggle excluding items with quantity 0.
   - Test each of the 7 sort orders with varied datasets.
   - Test combined search + filter + sort execution.

## Success Criteria

- [x] All types are strictly typed with zero `any` declarations.
- [x] `filterAndSortRecords` accurately filters and sorts test records across all defined options.
- [x] Ties are deterministically broken by `record.id`.
- [x] All unit tests in `filterAndSortRecords.test.ts` pass without warnings.

## Risk Assessment

- **Risk**: Product name lookup might be unavailable if records only store `productId` and product cache is still loading.
  - **Mitigation**: Fall back gracefully to `record.customName || 'Item'` if `productNameLookup` does not contain the entry.
  - **Broken Assumption Signal**: Search fails to match brand-name products where user did not enter a custom name.
  - **Response**: Provide optional `productNameLookup: Record<string, string>` map populated from React Query or WatermelonDB `products_cache`.
