---
phase: 4
title: "Record List Integration, Pagination, and View Modes"
status: pending
priority: P1
effort: "8h"
dependencies: [1, 2, 3]
---

# Phase 4: Record List Integration, Pagination, and View Modes
<!-- Updated: Validation Session 1 - Confirmed adaptive dual-mode rendering and 20-item page size -->

## Overview

Integrate search, multi-attribute filtering, sorting, and windowed infinite-scroll pagination into the core mobile Pantry screen (`RecordList.tsx` and `HomeTab` in `home.tsx`). The implementation introduces a clean dual-mode presentation: preserving the urgency `SectionList` when the user has not applied search or custom filters, while seamlessly switching to a paginated `FlatList` with active filter chips and item counts when filtering or sorting is active.

## Requirements

### Functional
- **Pagination Engine (`usePantryPagination.ts`)**:
  - Accepts `items: LocalRecord[]`, optional `pageSize` (default `20`), and optional `resetKey?: string`.
  - Tracks `currentPage: number` (starts at `1`) and `isLoadingMore: boolean` (starts at `false`).
  - Derived items slice: `paginatedItems = useMemo(() => items.slice(0, currentPage * pageSize), [items, currentPage, pageSize])` — derived directly from `currentPage` and `items`, never stored or updated as separate redundant state.
  - Exposes `hasMore: boolean`, `isLoadingMore: boolean`, `loadMore(): void`, `reset(): void`, and `totalCount: number`.
  - **Stable Reset Contract via `resetKey`**:
    - Rather than resetting on raw `items` array reference identity (which can churn on unrelated parent re-renders), the hook accepts `resetKey = [scope, householdId, searchQuery, filters.category, filters.expiryStatus, filters.inStockOnly, selectedSort].join(':')`.
    - An effect watching `resetKey` resets `currentPage` to 1, sets `isLoadingMore(false)`, resets `inFlightRef.current = false`, and clears any pending timer (`if (timerRef.current) clearTimeout(timerRef.current)`).
    - This guarantees that unrelated re-renders preserve the user's currently scrolled and loaded pages, while genuine filter, search, scope, or sort transitions cleanly reset pagination back to page 1.
  - **Cross-Frame Lifecycle & Intentional Minimum Spinner Duration**:
    - *Mechanism*: Because WatermelonDB active records reside in local memory, an immediate slice would batch `setIsLoadingMore(true)` and `setIsLoadingMore(false)` in the same tick, rendering the spinner invisible. The hook introduces an intentional 180ms minimum spinner duration via `timerRef.current = setTimeout(...)` so the native UI thread visibly draws the `ActivityIndicator` before the next batch appears.
    - *Ref Guards in Hook*:
      - `inFlightRef = useRef<boolean>(false)`: Immediate synchronous guard in the hook preventing concurrent execution across rapid event loops.
      - `timerRef = useRef<NodeJS.Timeout | null>(null)`: Retains intentional spinner delay timer with unmount and dataset change cleanup.
    - *Hook Execution Sequence*:
      1. *Trigger*: `if (inFlightRef.current || !hasMore) return; inFlightRef.current = true;`
      2. *Frame 1 (Paint Spinner)*: Calls `setIsLoadingMore(true)`. React Native renders `ActivityIndicator` in the footer and paints the frame to screen.
      3. *Frame 2 (Intentional Minimum Duration)*: Timer callback runs after 180ms across paint boundaries.
      4. *Frame 3 (Commit & Release)*: Timer callback increments `currentPage`, causing the derived slice to recompute, calls `setIsLoadingMore(false)`, and resets `inFlightRef.current = false`.
      5. *Unmount & Change Lifecycle*: Cleanup runs `clearTimeout(timerRef.current)` and resets `inFlightRef.current = false`.
  - Compute filtered records: `filteredRecords = useMemo(() => filterAndSortRecords(records, filters, selectedSort), [records, filters, selectedSort])`.
  - Detect `isFiltered`:
    ```typescript
    const isFiltered = Boolean(
      searchQuery.trim() ||
      filters.category ||
      (filters.expiryStatus && filters.expiryStatus !== 'all') ||
      filters.inStockOnly ||
      selectedSort !== 'expiry_asc'
    );
    ```
  - **Unified Sorted Data Pipeline (`filteredRecords`)**:
    - Always paginate the already-transformed `filteredRecords`: `usePantryPagination(filteredRecords, 20, resetKey)`.
    - *Correctness Invariant*: When `!isFiltered`, `filteredRecords` contains all pantry records sorted in `expiry_asc` order. Slicing after sorting guarantees that the 20 most urgent items (Expired, Today, This Week) always appear on page 1, regardless of arbitrary physical row order in WatermelonDB.
    - `isFiltered` is used **strictly as a UI view selector** (`SectionList` vs `FlatList`), never to switch the underlying data pipeline.
  - **Scroll Event Ownership in `RecordList.tsx`**:
    - `onEndReachedCalledDuringMomentumRef = useRef<boolean>(true)`: Scroll momentum guard owned directly by `RecordList.tsx`. Initialized to `true` to block spurious initial-mount triggers.
    - `handleScrollBegin = useCallback(() => { onEndReachedCalledDuringMomentumRef.current = false; }, [])`: Attached to **both** `onScrollBeginDrag` and `onMomentumScrollBegin`. This guarantees continuous manual drags as well as high-velocity flicks properly prime `onEndReached` without locking out slow drags to bottom.
    - `handleEndReached = useCallback(() => { if (onEndReachedCalledDuringMomentumRef.current) return; onEndReachedCalledDuringMomentumRef.current = true; loadMore(); }, [loadMore])`.
  - **Default Unfiltered Mode (`!isFiltered`)**:
    - Groups the visible slice via `groupRecords(paginatedItems)` into urgency buckets (`Expired`, `Expires today`, `Use this week`, `Later`).
    - Renders `SectionList` with:
      - `sections={sections}`
      - `onEndReached={handleEndReached}` with `onEndReachedThreshold={0.25}`
      - `onScrollBeginDrag={handleScrollBegin}`
      - `onMomentumScrollBegin={handleScrollBegin}`
      - `ListHeaderComponent` with `UseNextHero`, `PantrySearchBar`, and `PantrySortPills`
      - `ListFooterComponent={<PantryPaginationFooter isLoadingMore={isLoadingMore} hasMore={hasMore} totalCount={totalCount} pageSize={20} />}`
    - Scrolling near the bottom of the default urgency list automatically loads the next 20 items, expanding the sections seamlessly and displaying the Fresh Sage spinning indicator.
  - **Filtered / Sorted Mode (`isFiltered`)**:
    - Renders `FlatList` with `data={paginatedItems}`.
    - Renders identical `onEndReached={handleEndReached}`, `onEndReachedThreshold={0.25}`, `onScrollBeginDrag={handleScrollBegin}`, `onMomentumScrollBegin={handleScrollBegin}`, and `ListFooterComponent={<PantryPaginationFooter ... />}`.
    - Displays `PantrySearchBar`, `PantrySortPills`, `PantryActiveFilterChips`, and a result status bar: `"Showing ${paginatedItems.length} of ${totalCount} items"`.
    - Hides `UseNextHero` to focus on search/filter results.
  - **Shared Spinning Footer Component (`PantryPaginationFooter`)**:
    - When `isLoadingMore` is true: Displays a centered spinner container with React Native `ActivityIndicator` (`size="small"`, `color={theme.colors.primary}` [Fresh Sage `#4BAE8A`]) and a subtle label `"Loading more items..."` (`color={theme.colors.textMuted}`, `fontSize: 12`, `testID="pantry-pagination-spinner"`).
    - When `!hasMore` and `totalCount > pageSize`: Displays a subtle completion footer `"All ${totalCount} items loaded"` with a center dot separator.
    - When `totalCount <= pageSize`: Returns `null` (no unnecessary footer).
- **Empty States**:
  - **Zero Pantry Items**: Renders existing "Start fresh / Start your pantry" empty card.
  - **Zero Search/Filter Matches**: Renders empty state card with search icon, text "No matching pantry items", subcopy "Try adjusting your search or clearing active filters", and a Honey CTA button "Clear all filters".
- **Gestures and Actions**:
  - Retains existing swipe actions (`+1 Quantity`, `Edit`, `Delete`) on all cards via `RecordCard` across both SectionList and FlatList modes.
  - Pull-to-refresh (`RefreshControl`) remains active in both modes and triggers `runSync()` to refresh WatermelonDB.
### Non-functional
- Optimized for responsive rendering using virtualized windowing (`removeClippedSubviews={true}`, `maxToRenderPerBatch={10}`, `windowSize={5}`) to prevent dropped frames on both iOS and Android devices, with performance benchmarked in Phase 5.
- Proper key extraction using `record.id`.
- Responsive layout adapting to both light and dark Expyrico themes.

## Architecture

```
                                  useActiveRecords() (WatermelonDB)
                                                |
                                                v
                        +-----------------------------------------------+
                        | filterAndSortRecords(records, filters, sort)  |
                        +-----------------------------------------------+
                                                |
                        +-----------------------------------------------+
                        | usePantryPagination(filteredRecords, 20)      |
                        +-----------------------------------------------+
                                                |
                                 +--------------+--------------+
                                 |                             |
                                 v (isFiltered)                v (!isFiltered)
                 +-------------------------------+   +-----------------------------+
                 | Paginated FlatList            |   | Urgency SectionList         |
                 | - Result Count Bar            |   | - UseNextHero               |
                 | - Active Filter Chips         |   | - Expired Section           |
                 | - Infinite Scroll Footer      |   | - Today Section             |
                 | - "Clear Filters" Empty State |   | - This Week Section         |
                 +-------------------------------+   | - Later Section             |
                                                     +-----------------------------+
```

## Related Code Files

- Create: `apps/mobile/src/features/records/usePantryPagination.ts`
- Create: `apps/mobile/tests/unit/use-pantry-pagination.test.ts`
- Modify: `apps/mobile/src/features/records/RecordList.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/home.tsx`

## Implementation Steps

1. **Implement `usePantryPagination.ts`**:
   - Write hook taking `items: T[]`, `pageSize: number = 20`, and optional `resetKey?: string`.
   - Compute `paginatedItems = useMemo(() => items.slice(0, currentPage * pageSize), [items, currentPage, pageSize])`.
   - Instantiate `inFlightRef = useRef(false)` and `timerRef = useRef<NodeJS.Timeout | null>(null)` inside the hook.
   - Implement `loadMore`:
     - Guard: `if (inFlightRef.current || !hasMore) return; inFlightRef.current = true;`
     - Frame 1 (Paint Spinner): `setIsLoadingMore(true)`.
     - Frame 2 (Intentional Minimum Spinner Duration): `timerRef.current = setTimeout(..., 180)` over in-memory slice.
     - Frame 3 (Commit & Release): Callback increments `currentPage`, causing the derived slice to recompute, calls `setIsLoadingMore(false)`, and resets `inFlightRef.current = false`.
   - Add `useEffect` listening to `resetKey` to call `reset()`, set `isLoadingMore(false)`, reset `inFlightRef.current = false`, and clear pending timers when filters, search, or scope change.
   - Add unmount cleanup effect calling `clearTimeout(timerRef.current)`.
   - Write unit tests in `use-pantry-pagination.test.ts` verifying page slicing, `hasMore` calculation, inFlightRef guard, preservation of loaded pages across unrelated re-renders with identical `resetKey`, and reset on `resetKey` transition.
2. **Refactor `RecordList.tsx` for Unified Pagination**:
   - Add state: `searchQuery`, `selectedSort` (default `'expiry_asc'`), `filters: PantryFilterState` (default `{ expiryStatus: 'all' }`), `filterModalVisible`.
   - Compute sorted & filtered records: `filteredRecords = useMemo(() => filterAndSortRecords(records, filters, selectedSort), [records, filters, selectedSort])`.
   - Derive stable `resetKey = [scope, householdId, searchQuery, filters.category, filters.expiryStatus, filters.inStockOnly, selectedSort].join(':')`.
   - Feed `filteredRecords`, `20`, and `resetKey` to `usePantryPagination(filteredRecords, 20, resetKey)`. Always paginate `filteredRecords` so default `expiry_asc` ordering is preserved prior to page slicing.
   - Instantiate `onEndReachedCalledDuringMomentumRef = useRef(true)` in `RecordList`.
   - Define `handleScrollBegin = useCallback(() => { onEndReachedCalledDuringMomentumRef.current = false; }, [])` and wire to `onScrollBeginDrag` and `onMomentumScrollBegin`.
   - Define `handleEndReached = useCallback(() => { if (onEndReachedCalledDuringMomentumRef.current) return; onEndReachedCalledDuringMomentumRef.current = true; loadMore(); }, [loadMore])`.
   - Build reusable `PantryPaginationFooter` subcomponent:
     - Renders `ActivityIndicator` (`size="small"`, `color={theme.colors.primary}` [Fresh Sage `#4BAE8A`]) and `"Loading more items..."` (`testID="pantry-pagination-spinner"`) when `isLoadingMore` is true.
     - Renders `"All ${totalCount} items loaded"` when `!hasMore && totalCount > pageSize`.
     - Returns `null` when `totalCount <= pageSize`.
   - In **Default Unfiltered Mode (`!isFiltered`)**:
     - Groups `paginatedItems` via `groupRecords(paginatedItems)`.
     - Configures `SectionList` with `sections={sections}`, `onEndReached={handleEndReached}`, `onEndReachedThreshold={0.25}`, `onScrollBeginDrag={handleScrollBegin}`, `onMomentumScrollBegin={handleScrollBegin}`, `ListHeaderComponent`, and `ListFooterComponent={<PantryPaginationFooter ... />}`.
   - In **Filtered / Sorted Mode (`isFiltered`)**:
     - Configures `FlatList` with `data={paginatedItems}`, identical `onEndReached`, `onEndReachedThreshold={0.25}`, `onScrollBeginDrag={handleScrollBegin}`, `onMomentumScrollBegin={handleScrollBegin}`, and `ListFooterComponent={<PantryPaginationFooter ... />}`.
     - Displays result count banner: `"Showing ${paginatedItems.length} of ${totalCount} items"`.
   - Render `PantrySearchBar` with `activeFilterCount` and connect `onOpenFilter={() => setFilterModalVisible(true)}`.
   - Render `PantrySortPills` and wire `onSelectSort={setSelectedSort}`.
   - Render `PantryActiveFilterChips` with chip dismiss and "Clear all".
   - Include `PantryFilterModal` in JSX with `visible={filterModalVisible}`, `onClose={() => setFilterModalVisible(false)}`, and `onApply={setFilters}`.
3. **Refactor `HomeTab` (`home.tsx`)**:
   - Update header structure to allow `PantrySearchBar` and `PantrySortPills` to sit neatly below `ScopeToggle`.
   - Adjust `UseNextHero` visibility so it gracefully appears only in default, unfiltered mode.
   - Maintain full compatibility with existing theme and navigation props.

## Success Criteria

- [x] Scrolling near the bottom of the list automatically triggers `loadMore()` in BOTH default `SectionList` mode and filtered `FlatList` mode.
- [x] The spinning `ActivityIndicator` (Fresh Sage `#4BAE8A`) with "Loading more items..." visibly paints in the footer across render frames.
- [x] Ref and momentum guards prevent duplicate `loadMore` invocations during rapid scrolling.
- [x] The next batch of 20 items seamlessly appends without layout jumping or state collisions.
- [x] Once all items are loaded, the spinner cleanly transitions to "All X items loaded".
- [x] Searching pantry instantly filters records and shows matching items in a paginated list.
- [x] Changing sort pills immediately re-orders the list according to the selected criterion.
- [x] When all filters and search are cleared and sort is `expiry_asc`, the list seamlessly displays the urgency `SectionList` and `UseNextHero`.
- [x] Swipe gestures (+1, edit, delete) work properly in both SectionList and FlatList modes.
- [x] Unit tests for `usePantryPagination` and `RecordList` pass cleanly.
## Risk Assessment

- **Risk**: Switching between `SectionList` and `FlatList` could cause scroll position jumps or unmounting glitches.
  - **Mitigation**: Keep list headers unified and use stable keys on cards. When switching modes, smoothly scroll to top (`scrollToOffset({ offset: 0 })`).
  - **Broken Assumption Signal**: List flickers or crashes with "Cannot read property 'length' of undefined" when switching between filter and default views.
  - **Response**: Use distinct `testID`s and ensure data array types match `LocalRecord[]` across both renderers.
