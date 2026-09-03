---
title: "Mobile Pantry Search, Filter, Sort, and Pagination"
description: "Comprehensive implementation plan for adding search, multi-attribute filtering, flexible sorting, and infinite scroll pagination to the mobile app Pantry all items inventory screen."
status: completed
priority: P1
effort: "3d"
tags: ["mobile", "pantry", "search", "filter", "sort", "pagination", "watermelondb", "react-native", "ui-ux"]
created: 2026-09-03
---

# Mobile Pantry Search, Filter, Sort, and Pagination

## Overview

The Expyrico mobile app currently displays active pantry records in `HomeTab` (`apps/mobile/app/(app)/(tabs)/home.tsx`) via `RecordList` (`apps/mobile/src/features/records/RecordList.tsx`). Items are fetched from local WatermelonDB and grouped into fixed urgency sections (`Expired`, `Expires today`, `Use this week`, `Later`). As a user's pantry grows, finding specific groceries, filtering by food category or expiry urgency, sorting by quantity or alphabet, and scrolling smoothly without rendering overhead becomes critical.

This plan delivers a complete, production-grade search, filter, sort, and pagination system for the mobile Pantry items experience. It integrates seamlessly into the existing offline-first WatermelonDB architecture and adheres strictly to the Expyrico design system, color palette, and accessibility requirements.

## Architecture & Design Approach

```
+-------------------------------------------------------------------------+
|                  HomeTab (apps/mobile/app/(app)/(tabs)/home.tsx)        |
|  - Brand Header ("Your pantry", attention pill)                         |
|  - ScopeToggle (Personal vs Household)                                  |
|  - UseNextHero (Collapsible or preserved when unfiltered)               |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
|                 Pantry Controls (Sticky or Top of List)                 |
|  +-------------------------------------------------------------------+  |
|  | PantrySearchBar: Search input (300ms debounce) + Filter Modal Btn |  |
|  +-------------------------------------------------------------------+  |
|  | PantrySortPills: Horizontal pills (Expiring Soon, A-Z, Stock, etc)|  |
|  +-------------------------------------------------------------------+  |
|  | PantryActiveFilterChips: Removable tags + "Clear all"             |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
       [Default Unfiltered Mode]         [Filtered / Sorted Mode]
       SectionList by Urgency            FlatList with Result Count
       (Expired, Today, Week, Later)     (Showing 20 of 48 items)
                    |                               |
                    +---------------+---------------+
                                    |
+-------------------------------------------------------------------------+
|     usePantryPagination & filterAndSortRecords Engine                   |
|  - Reactive WatermelonDB observe() feed (LocalRecord[])                 |
|  - Client-side fast filtering (query, category, expiry, scope)          |
|  - Stable comparator sorting (expiry, name, quantity, created_at)       |
|  - Infinite scroll pagination (pageSize = 20, onEndReached)             |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
|                 PantryFilterModal (Bottom Sheet Modal)                  |
|  - Expiry Status (All, Expired [Red], Expiring Soon [Amber], Fresh)     |
|  - Categories (Dynamic chips from pantry items + standard food types)   |
|  - In-stock only toggle                                                 |
|  - Reset & Apply actions with real-time match counter                   |
+-------------------------------------------------------------------------+
```

### Key Architectural Invariants

1. **Offline-First Reactive Pipeline**: Data originates from local WatermelonDB via `useActiveRecords()`. The filtering, sorting, and pagination engine operates reactively over this data in memory without requiring synchronous network round-trips or schema migrations, keeping the pantry 100% functional offline.
2. **Dual View Presentation**:
   - **Default View** (No search query, default `expiry_asc` sort, no active filters): Retains the beloved urgency `SectionList` (`Expired`, `Expires today`, `Use this week`, `Later`) and the `UseNextHero`.
   - **Filtered/Sorted View** (Active search query, custom sort selected, or category/status filters applied): Transitions smoothly to a paginated `FlatList` with clear item cards, active filter summary, and item count.
3. **Expyrico Palette & Design Token Compliance**:
   - Primary: Fresh Sage (`#4BAE8A`) for headers, active pills, Good status.
   - Primary Dark: Deep Sage (`#3A8F6F`) for pressed states and contrast text.
   - Primary Light: Mint Mist (`#D6F0E6`) for soft badges and success highlights.
   - Accent: Honey (`#F5A623`) for CTAs, filter badges, Expiring Soon status.
   - Accent Light: Soft Butter (`#FEEFC3`) for expiring soon badge backgrounds.
   - Reserved Destructive: Alert Red (`#E0442A`) used exclusively for Expired status indicators.
   - Neutrals: Warm White (`#FAFAF8`), Stone (`#F0F0ED`), Pebble (`#8C8C85`), Almost Black (`#2C2C28`).
4. **Unified Infinite Scroll Pagination & Performance**:
   - **Unified Chronologically Sorted Pipeline (`filteredRecords`)**: `RecordList.tsx` always feeds the sorted and filtered dataset `filteredRecords = filterAndSortRecords(records, filters, selectedSort)` to `usePantryPagination(filteredRecords, 20, resetKey)`. When `!isFiltered`, `filteredRecords` represents all active records sorted in `expiry_asc` order. Slicing after sorting guarantees that the 20 most urgent items (Expired, Today, This Week) always appear on page 1, regardless of arbitrary physical row order in WatermelonDB. `isFiltered` is used strictly as a UI view selector (`SectionList` vs `FlatList`), never to bypass sorting.
   - **Batch size**: 20 records per page.
   - **Derived Slice**: `paginatedItems = useMemo(() => items.slice(0, currentPage * pageSize), [items, currentPage, pageSize])` is derived directly from `currentPage` and `items` without separate redundant state.
   - **Stable Reset Contract (`resetKey`)**: Derived from `[scope, householdId, searchQuery, filters.category, filters.expiryStatus, filters.inStockOnly, selectedSort].join(':')`. Hook resets `currentPage` to 1, sets `isLoadingMore(false)`, resets `inFlightRef.current = false`, and clears any pending timer when `resetKey` changes, while preserving loaded pages across unrelated re-renders.
   - **Ref Guards & Event Ownership**:
     - `inFlightRef = useRef(false)` and `timerRef = useRef<NodeJS.Timeout | null>(null)` live inside `usePantryPagination`. On `resetKey` change, the hook resets `currentPage` to 1, sets `isLoadingMore(false)`, resets `inFlightRef.current = false`, and clears any pending timer.
     - `onEndReachedCalledDuringMomentumRef = useRef(true)` lives directly in `RecordList.tsx`. It is reset to `false` on **both** `onScrollBeginDrag` and `onMomentumScrollBegin`, ensuring continuous user dragging as well as flick momentum properly prime `onEndReached` without locking out slow drags to bottom.
   - **Cross-Frame Lifecycle & Intentional Minimum Spinner Duration**:
     - *Frame 1 (Paint Spinner)*: `setIsLoadingMore(true)` renders `ActivityIndicator` (Fresh Sage `#4BAE8A`) in `ListFooterComponent`.
     - *Frame 2 (Intentional Minimum Duration)*: Because in-memory array slicing is near-instantaneous, `timerRef.current = setTimeout(..., 180)` provides an intentional minimum spinner duration across paint boundaries so users receive tangible visual feedback.
     - *Frame 3 (Commit & Release)*: Timer callback increments `currentPage`, causing the derived slice to recompute, calls `setIsLoadingMore(false)`, and releases `inFlightRef.current = false`.
     - *Cleanup*: `clearTimeout(timerRef.current)` and `inFlightRef.current = false` run on unmount or `resetKey` change.
   - **Default Mode (`SectionList`)**: Groups visible items via `groupRecords(paginatedItems)` so urgency sections expand seamlessly as the user scrolls to the bottom.
   - **Filtered Mode (`FlatList`)**: Renders `data={paginatedItems}` with result count banner.
   - **End-of-List Indicator**: Shows `"All ${totalCount} items loaded"` when `!hasMore && totalCount > pageSize`.
   - **Virtualized Windowing**: Uses `removeClippedSubviews={true}`, `initialNumToRender={10}`, `maxToRenderPerBatch={10}`, and `windowSize={5}`, with render timing benchmarks measured in Phase 5.
## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Create robust, pure filtering and sorting engine with complete TypeScript types and unit tests | P1 |
| 2 | Build accessible UI search bar with debounce, horizontal sort pills, and active filter chips | P1 |
| 3 | Build interactive bottom-sheet filter modal for category, expiry status, and stock toggles | P1 |
| 4 | Integrate pagination and controls into `RecordList.tsx` and `HomeTab`, supporting both urgency sections and sorted feeds | P1 |
| 5 | Verify through comprehensive snapshot tests, unit tests, accessibility audits, and 60fps performance benchmarks | P1 |

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Phase 1: Filtering and Sorting Engine](./phase-01-start.md) | Completed | 4h |
| 2 | [Phase 2: Search Bar, Sort Pills, and Active Filter Chips](./phase-02-search-bar-and-sort-controls.md) | Completed | 6h |
| 3 | [Phase 3: Filter Modal and Multi-Attribute Sheet](./phase-03-filter-modal-and-chips.md) | Completed | 6h |
| 4 | [Phase 4: Record List Integration, Pagination, and View Modes](./phase-04-record-list-pagination-and-view-integration.md) | Completed | 8h |
| 5 | [Phase 5: Verification, Testing, and Accessibility](./phase-05-verification-testing-and-accessibility.md) | Completed | 4h |

## Success Criteria

- [x] Searching by food name, brand, category, store, or notes instantly filters the pantry items with debounced input.
- [x] Sorting options (Expiring Soonest, Expiring Latest, Name A-Z, Name Z-A, Highest Quantity, Lowest Quantity, Recently Added) accurately reorder the items.
- [x] Multi-attribute filter modal allows combining category, expiry status (Good, Expiring Soon, Expired), and in-stock toggles.
- [x] Applied filters are visualized as removable chips with a one-tap "Clear all" action.
- [x] Scrolling to the bottom automatically triggers loading the next page of 20 items, appending them to the current list with a centered spinning `ActivityIndicator` styled in Fresh Sage (`#4BAE8A`).
- [x] Displays a subtle "All X items loaded" footer once all items in the filtered inventory have been appended.
- [x] When unfiltered with default sorting, the pantry retains its urgency grouping (`Expired`, `Expires today`, `Use this week`, `Later`); when filtered or custom-sorted, it displays a clean, paginated list.
- [x] Swipe gestures (Quick +1, Edit, Delete) and tap navigation to item details remain fully functional.
- [x] All UI adheres to the Expyrico color palette and accessibility standards (WCAG AA for color contrast >= 4.5:1 text and touch targets >= 44x44pt; verifies layout integrity under the existing app font cap maxFontSizeMultiplier = 1.5 per apps/mobile/src/App.tsx:32,34 without claiming WCAG AA for text resize).
- [x] Unit and snapshot test suites pass cleanly.

## Validation Log

### Verification Results
- **Tier:** Full (5 phases, all active roles satisfied)

#### Existing Codebase Facts (24 Verified Claims — Exact Codebase Evidence)
1. [Fact Checker] `apps/mobile/src/api/records.ts:8` defines `LocalRecord` interface with `customName`, `category`, `expiryDate`, `quantity`, `unit`, `notes`, `store`, `productId`. (VERIFIED)
2. [Fact Checker] `apps/mobile/src/api/records.ts:54` exports `useActiveRecords()` hook. (VERIFIED)
3. [Fact Checker] `apps/mobile/src/features/records/expiryStatus.ts:16` exports `expiryStatus()` function. (VERIFIED)
4. [Fact Checker] `apps/mobile/src/features/records/expiryStatus.ts:30` exports `EXPIRY_STATUS_TOKEN` mapping. (VERIFIED)
5. [Fact Checker] `apps/mobile/src/theme/useTheme.ts:1` re-exports `useTheme` from `./ThemeProvider`. (VERIFIED)
6. [Fact Checker] `packages/theme/src/palette.ts:3` defines `expyricoPalette` tokens (`primary`: `#4BAE8A`, `primaryDark`: `#3A8F6F`, `primaryLight`: `#D6F0E6`, `accent`: `#F5A623`, `accentLight`: `#FEEFC3`, `expired`: `#E0442A`, `neutralDark`: `#2C2C28`, `neutralLight`: `#F0F0ED`, `neutralMid`: `#8C8C85`, `secondary`: `#FAFAF8`). (VERIFIED)
7. [Fact Checker] `packages/theme/src/palette.ts:17` defines semantic `expyricoColors`. (VERIFIED)
8. [Fact Checker] `packages/theme/src/tokens.ts:58` defines `RadiusTokens` (sm, md, lg, xl, pill). (VERIFIED)
9. [Fact Checker] `apps/mobile/src/features/records/RecordList.tsx:46` exports `RecordList()` component. (VERIFIED)
10. [Fact Checker] `apps/mobile/src/features/records/RecordList.tsx:12` defines `SECTION_TITLES` for urgency grouping. (VERIFIED)
11. [Fact Checker] `apps/mobile/src/features/records/RecordList.tsx:133` contains existing `testID="pantry-record-list"`. (VERIFIED)
12. [Fact Checker] `apps/mobile/src/features/records/UseNextHero.tsx:22` exports `UseNextHero()` component. (VERIFIED)
13. [Fact Checker] `apps/mobile/app/(app)/(tabs)/home.tsx:12` exports `HomeTab()` pantry screen. (VERIFIED)
14. [Fact Checker] `apps/mobile/src/App.tsx:32` sets `(Text as any).defaultProps.maxFontSizeMultiplier = 1.5`. (VERIFIED)
15. [Fact Checker] `apps/mobile/src/App.tsx:34` sets `(TextInput as any).defaultProps.maxFontSizeMultiplier = 1.5`. (VERIFIED)
16. [Fact Checker] `apps/mobile/src/db/sync.ts:12` exports `runSync()` push/pull sync trigger. (VERIFIED)
17. [Fact Checker] `apps/mobile/tests/snapshots/home.test.tsx:2` tests `HomeTab` with snapshot harness. (VERIFIED)
18. [Fact Checker] `apps/mobile/tests/helpers/renderWithTheme.tsx:8` exports `renderWithTheme()` test utility. (VERIFIED)
19. [Fact Checker] `apps/mobile/src/features/deals/DealSearchBar.tsx:12` implements debounced search bar pattern. (VERIFIED)
20. [Fact Checker] `apps/mobile/src/features/deals/DealFilterModal.tsx:46` implements draft filter modal pattern. (VERIFIED)
21. [Flow Tracer] `useActiveRecords()` subscribes to WatermelonDB `records` table query and emits on change (`records.ts:70-74`). (VERIFIED)
22. [Flow Tracer] `expiryStatus()` calculates difference from UTC midnight and maps to status tokens (`expiryStatus.ts:16-27`). (VERIFIED)
23. [Flow Tracer] `RecordCard` swipeable actions fire `patchLocalRecord` (+1 qty) and `deleteLocalRecord` (`RecordCard.tsx:46-88`). (VERIFIED)
24. [Flow Tracer] `RefreshControl` in `RecordList` triggers `runSync()` to push pending and pull remote records (`RecordList.tsx:64-76`). (VERIFIED)

#### Planned Design Specifications (Contracts Defined for Implementation in Phases 1–5)
- [PLANNED SPECIFICATION — PHASE 1] `filterAndSortRecords`: Pure computation returning a new `LocalRecord[]` sorted by primary criterion and secondary ID tie-breaker without input mutation.
- [PLANNED SPECIFICATION — PHASE 1] `PantrySortOption`: 7-option sorting union (`expiry_asc`, `expiry_desc`, `name_asc`, `name_desc`, `quantity_desc`, `quantity_asc`, `recently_added`).
- [PLANNED SPECIFICATION — PHASE 1] `PantryFilterState`: Filter criteria interface (`query`, `category`, `expiryStatus`, `inStockOnly`, `householdScope`).
- [PLANNED SPECIFICATION — PHASE 2] `PantrySearchBar`: Search input with 300ms debounce, clear button, and filter badge count.
- [PLANNED SPECIFICATION — PHASE 2] `PantrySortPills`: Horizontal sort selector with `pantry-sort-pill-${id}` testIDs.
- [PLANNED SPECIFICATION — PHASE 2] `PantryActiveFilterChips`: Active filter tags with dismiss (X) and "Clear all" action.
- [PLANNED SPECIFICATION — PHASE 3] `PantryFilterModal`: Slide-up modal with draft state, category chips with item counts, and live match count preview on Honey CTA.
- [PLANNED SPECIFICATION — PHASE 4] `usePantryPagination`: Unified pagination hook with `inFlightRef`, `timerRef`, stable `resetKey`, and intentional 180ms minimum spinner duration over in-memory slice; resets `inFlightRef.current = false` and clears timer on `resetKey` change.
- [PLANNED SPECIFICATION — PHASE 4] Unified Dual-Mode Pagination: Both `SectionList` (default mode) and `FlatList` (filtered mode) consume `usePantryPagination(filteredRecords, 20, resetKey)` and render `PantryPaginationFooter`.
- [PLANNED SPECIFICATION — PHASE 4] `PantryPaginationFooter`: Centered Fresh Sage (`#4BAE8A`) `ActivityIndicator` with `"Loading more items..."` (`testID="pantry-pagination-spinner"`) while loading, and `"All X items loaded"` when complete.
- [PLANNED SPECIFICATION — PHASE 5] Benchmarks & Accessibility: Jest benchmark measuring `filterAndSortRecords` on 500 mock records; WCAG AA contrast verification; touch target audit (>= 44x44pt); dynamic type test asserting text inherits `maxFontSizeMultiplier = 1.5`.

### Validation Interview Decisions (Session 1 & 2)
1. **Search Scope**: Confirmed **Broad multi-attribute search** — matches across item custom name, linked product brand/title, category, storage notes, and store location.
2. **View Mode Transition**: Confirmed **Adaptive dual-mode** — maintains urgency `SectionList` when unfiltered and default-sorted; automatically transitions to paginated `FlatList` with result summary and active filter chips when searching, filtering, or custom-sorting.
3. **Category Filter Taxonomy**: Confirmed **Dynamic hybrid taxonomy** — dynamically surfaces categories present in the user's pantry, supplemented by standard pantry presets (Produce, Dairy, Bakery, Meat, etc.) with real-time count badges.
4. **Pagination Batch Size**: Confirmed **20 items per page** — optimal balance between initial render speed and smooth infinite scrolling.
5. **Scroll-to-Bottom Auto-Load & Spinning Effect (User Update)**: Confirmed — scrolling near the bottom automatically loads and appends the next page of 20 items in BOTH `SectionList` and `FlatList` modes, displaying a centered spinning `ActivityIndicator` (Fresh Sage `#4BAE8A`) with `"Loading more items..."` label across render frames, followed by `"All X items loaded"` at the end of the list.
6. **Accessibility & Font Scale Baseline**: Confirmed — WCAG AA compliance applies to color contrast (>= 4.5:1 text, >= 3:1 UI components) and touch targets (>= 44x44pt). The plan does not claim WCAG AA for text resizing (since WCAG 1.4.4 requires 200%), instead verifying visual layout integrity under the existing app baseline cap (`maxFontSizeMultiplier = 1.5` per `apps/mobile/src/App.tsx:32,34`).
7. **Momentum Guard Reset & Event Ownership**: Confirmed — `RecordList.tsx` owns `onEndReachedCalledDuringMomentumRef`, initializing it to `true` and resetting it to `false` on both `onScrollBeginDrag` and `onMomentumScrollBegin` so that continuous user dragging as well as fling momentum reliably load pages.

### Whole-Plan Consistency Sweep
- **Contradictions detected:** 0
- **Consistency Status:** Fully reconciled and verified.
- Reconciled alignments across all 5 phase documents and `plan.md`:
  - **Pagination parity**: Phase 4 explicitly paginates both the default urgency `SectionList` and the filtered `FlatList` using the sorted `filteredRecords` pipeline via `usePantryPagination(filteredRecords, 20, resetKey)` and footer spinner.
  - **Scroll event ownership**: `RecordList.tsx` handles `onScrollBeginDrag` and `onMomentumScrollBegin`, resetting `onEndReachedCalledDuringMomentumRef` to `false` to support both drag-to-bottom and flick momentum.
  - **Cross-frame lifecycle**: Phase 4 and `plan.md` define the three-stage lifecycle with ref-based in-flight guard (`inFlightRef`), intentional 180ms minimum spinner duration timer, and unmount/resetKey cleanup.
  - **Accessibility wording**: Excluded WCAG AA claims for text resizing; retained WCAG AA strictly for contrast and touch targets, while verifying layout integrity under the app's `maxFontSizeMultiplier = 1.5` cap.
  - **Evidence integrity**: Clean distinction between verified codebase facts (file:line) and planned design contracts.
<!-- slug: mobile-pantry-search-filter-sort-pagination -->
