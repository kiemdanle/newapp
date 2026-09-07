---
phase: 2
title: "Sectioned Urgency Grouping in RecordList"
status: completed
priority: P1
effort: "1h"
dependencies: ["phase-01-filter-pipeline-and-types"]
---

# Phase 2: Sectioned Urgency Grouping in RecordList

## Overview
Update `RecordList.tsx` section composition so that whenever `filters.expiryStatus === 'urgent'`, items are grouped into distinct urgency sections (`Expired`, `Expires today`, `Use this week`). This directly resolves the advisor concern by preserving urgency grouping across **all** combined queries (including text search and category filters), preventing the SectionList from collapsing into a flat list.

## Requirements
- Functional:
  - When `filters.expiryStatus === 'urgent'`, group `paginatedItems` by urgency using `groupRecords(paginatedItems)`.
  - Render sections for `expired`, `today`, and `thisWeek` whenever their respective grouped arrays contain $\ge 1$ item.
  - Automatically exclude the `later` group since all urgent items expire within 7 days.
  - **Advisor Concern Resolution**: Do NOT disable grouping when a search query (`searchQuery`) or category filter is present. Typing in the search bar or choosing a category while urgent filtering is active must continue to group the matching results under their respective urgency sections.
  - If `paginatedItems.length === 0`, return `[]` to trigger the existing `renderFilterEmptyState` ("No matching pantry items").
  - When `filters.expiryStatus !== 'urgent'`, preserve existing behavior (flat `filtered_results` if filtered; standard 4 sections if unfiltered).
  - **Instant Mutation Reactivity**: When an item is marked used/discarded or its date is edited beyond 7 days, it is instantly removed from the reactive active records list and urgent sections without artificial delay.
<!-- Updated: Validation Session 1 - Instant removal on reactive mutation confirmed -->
  - **Selection Mode Reset**: Whenever `filters` or `urgentFilterActive` changes, reset `selectionMode(false)` and `selectedIds(new Set())` to prevent hidden non-urgent items from lingering in bulk selection.
<!-- Updated: Red Team Session 1 - Selection mode reset on filter change -->
- Non-functional:
  - Smooth section rendering without list layout jank or scroll jump.
  - Stable memoization using `useMemo` over `paginatedItems` and `filters.expiryStatus`.

## Architecture & Data Flow

```typescript
// RecordList.tsx
const urgentGroups = useMemo(() => {
  if (filters.expiryStatus !== 'urgent') return null;
  return groupRecords(paginatedItems);
}, [filters.expiryStatus, paginatedItems]);

const sections = useMemo(() => {
  // 1. Urgent Expiry Mode: Always preserve urgency breakdown, even with search/category filters
  if (filters.expiryStatus === 'urgent') {
    if (paginatedItems.length === 0) return [];
    const urgencyKeys: Array<keyof typeof SECTION_TITLES> = ['expired', 'today', 'thisWeek'];
    return urgencyKeys
      .filter((key) => (urgentGroups?.[key].length ?? 0) > 0)
      .map((key) => ({
        key,
        title: SECTION_TITLES[key],
        data: urgentGroups![key],
      }));
  }

  // 2. Standard Filtered Mode: Single flat list
  if (isFiltered) {
    if (paginatedItems.length === 0) return [];
    return [
      {
        key: 'filtered_results',
        title: totalCount > 0 ? `Showing ${paginatedItems.length} of ${totalCount} items` : '',
        data: paginatedItems,
      },
    ];
  }

  // 3. Unfiltered Default Mode: All 4 sections (Expired, Expires today, Use this week, Later)
  return (Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>)
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, title: SECTION_TITLES[key], data: groups[key] }));
}, [filters.expiryStatus, isFiltered, urgentGroups, groups, paginatedItems, totalCount]);
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/RecordList.tsx`

## Implementation Steps
1. **Memoize Urgent Grouping**:
   In `RecordList.tsx`, create `urgentGroups` computed via `groupRecords(paginatedItems)` when `filters.expiryStatus === 'urgent'`.
2. **Update `sections` Builder**:
   Add the priority check for `filters.expiryStatus === 'urgent'` before the generic `if (isFiltered)` branch.
   Ensure that:
   - Only `expired`, `today`, and `thisWeek` are included.
   - `SECTION_TITLES` titles (`'Expired'`, `'Expires today'`, `'Use this week'`) are assigned.
   - Empty groups are filtered out.
   - No check on `!normalizedSearchQuery` exists.
3. **Empty State Compatibility**:
   Confirm that if `paginatedItems.length === 0` (e.g. searching for a nonexistent item under urgent filter), `sections` is `[]`, displaying `renderFilterEmptyState` with the "Clear active filters" button.

## Success Criteria
- [x] Tapping urgent filter renders separate `Expired`, `Expires today`, and `Use this week` sections.
- [x] The `Later` section header never appears when `expiryStatus === 'urgent'`.
- [x] **Advisor Concern Verification**: Typing in the search bar (e.g. "milk") while urgent filter is active keeps the matching items in their respective urgency sections (`Expired` vs `Expires today` vs `Use this week`).
- [x] If search finds zero matches under urgent filter, `No matching pantry items` empty state renders cleanly.

## Risk Assessment
- *Risk*: Pagination slicing could split items across sections unpredictably if paginated items are sliced before grouping.
- *Mitigation*: `filteredRecords` is sorted by `expiry_asc` before pagination, meaning all expired items appear before today's items, which appear before this week's items. The paginated slice retains continuous urgency clusters without fragmentation.
