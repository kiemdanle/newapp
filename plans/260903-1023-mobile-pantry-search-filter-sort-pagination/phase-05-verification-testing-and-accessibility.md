---
phase: 5
title: "Verification, Testing, and Accessibility"
status: pending
priority: P1
effort: "4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Verification, Testing, and Accessibility
<!-- Updated: Validation Session 1 - Confirmed test suite coverage for validated behaviors -->

## Overview

Execute a comprehensive verification suite ensuring the new search, filter, sort, and pagination features meet Expyrico's rigorous quality, security, and accessibility standards. This phase encompasses unit tests for computational logic, integration tests for full user flows, snapshot test updates across light and dark themes, accessibility audits (WCAG AA), and performance benchmarks on large pantry datasets.

## Requirements

### Functional
- **Unit & Integration Tests**:
  - Test filtering and sorting engine (`filterAndSortRecords.test.ts`) across all 7 sort options and 5 filter dimensions.
  - Test pagination hook (`use-pantry-pagination.test.ts`) with varied dataset sizes, boundary conditions, stable `resetKey` behavior (unrelated re-renders preserve page; filter/scope changes reset to 1), and intentional 180ms spinner duration.
  - Test chronological priority invariant: create a 45-item mock dataset where the most-expired item is placed at index 25 in the raw array; assert that after passing through `filterAndSortRecords` and `usePantryPagination`, this expired item correctly appears on page 1 in default mode.
  - Test UI components (`pantry-search-bar.test.tsx`, `pantry-sort-pills.test.tsx`, `pantry-filter-modal.test.tsx`).
  - Integration test (`pantry-filtering-and-pagination.test.tsx`):
    - Render `Home` screen with mock pantry data (45 items).
    - In default unfiltered mode (`SectionList`): scroll near bottom, trigger `onEndReached` -> assert `pantry-pagination-spinner` appears with `ActivityIndicator`, advance deferred timer -> assert urgency sections expand with 40 items rendered.
    - Type search query into `PantrySearchBar` and advance fake timers (300ms) -> assert list transitions to `FlatList` filtering to matching items.
    - Tap "Name A-Z" sort pill -> assert item ordering updates.
    - Open `PantryFilterModal`, select "Dairy" category, tap "Apply" -> assert list filters to Dairy items and displays active filter chip.
    - Tap "(X)" on filter chip -> assert filter is removed and list refreshes.
    - In filtered `FlatList` mode: scroll near bottom, trigger `onEndReached` -> assert `pantry-pagination-spinner` renders with active `ActivityIndicator`, verify `inFlightRef` prevents duplicate firing, advance deferred timer -> assert next batch of 20 items is appended, and spinner resolves.
    - Once all items are displayed, assert footer displays `"All 45 items loaded"`.
- **Snapshot Tests**:
  - Update `apps/mobile/tests/snapshots/home.test.tsx` for both `expyrico` (light) and `expyricoDark` (dark) themes to capture the new search bar, sort pills, and list layout.
- **Accessibility**:
  - All interactive elements have `accessibilityRole`, `accessibilityLabel`, and `testID`.
  - Color contrast ratio >= 4.5:1 for normal text and >= 3:1 for graphical UI components across both themes (WCAG AA compliance).
  - Touch targets meet or exceed 44x44 density-independent pixels (WCAG AA compliance).
  - App Font Scale Cap: Verify visual layout integrity and absence of text truncation or layout clipping under the existing app baseline cap (`maxFontSizeMultiplier = 1.5` per `apps/mobile/src/App.tsx:32,34`).
- **Performance Benchmarks**:
  - Run algorithmic timing benchmarks in `filterAndSortRecords.test.ts` on 500+ records to measure that array filtering and comparator execution completes within a standard frame budget (<16ms) without blocking the JS thread.
  - Verify virtualized windowing configuration (`removeClippedSubviews={true}`, `maxToRenderPerBatch={10}`, `windowSize={5}`) to maintain responsive scroll on mobile devices.
### Non-functional
- Zero regressions in existing pantry functionality (swipe actions, record edit, delete, scope toggling, sync triggers).
- Clean Jest and TypeScript compilation without any linting or type warnings.

## Architecture

```
                                  Test Verification Strategy
                                                |
          +------------------+------------------+------------------+
          |                  |                  |                  |
          v                  v                  v                  v
     [Unit Tests]     [Integration]        [Snapshots]       [Accessibility]
     - Pure engine    - Full User Flows    - Expyrico Light   - WCAG AA Contrast
     - Pagination     - Search -> Filter   - Expyrico Dark    - Touch Targets >= 44
     - UI Controls      -> Sort -> Page                       - Font Scale <= 1.5x
```

## Related Code Files

- Modify: `apps/mobile/tests/snapshots/home.test.tsx`
- Create: `apps/mobile/tests/integration/pantry-filtering-and-pagination.test.tsx`
- Create: `apps/mobile/tests/unit/pantry-accessibility.test.tsx`

## Implementation Steps

1. **Implement Integration Test (`pantry-filtering-and-pagination.test.tsx`)**:
   - Mock `useActiveRecords` with a rich sample dataset of 45 items spanning multiple categories (`Dairy`, `Produce`, `Bakery`, `Meat`), different expiry dates, and varying quantities.
   - Use `renderWithTheme` to mount `HomeTab`.
   - Test search flow: fire `changeText` on `pantry-search-input`, advance timer 300ms, assert filtered results.
   - Test sort flow: fire `press` on `pantry-sort-pill-name_asc`, assert alphabetical order of rendered item titles.
   - Test pagination flow: verify initial 20 items rendered, fire `onEndReached` on both `SectionList` and `FlatList`, assert `inFlightRef` blocks concurrent triggers, assert `pantry-pagination-spinner` appears with `ActivityIndicator`, resolve deferred append, assert 40 items now rendered, and assert end-of-list message when all items exhausted.
2. **Update Snapshot Tests (`home.test.tsx`)**:
   - Run Jest with `-u` flag to update snapshots for `Home` across both `expyrico` and `expyricoDark` themes.
3. **Perform Accessibility Audit (`pantry-accessibility.test.tsx`)**:
   - Assert all new touchable buttons (`pantry-search-input`, `pantry-filter-button`, `pantry-sort-pill-*`, filter modal chips) have proper accessibility roles, labels, and touch targets >= 44x44pt.
   - Validate color token contrast against `docs/design/expyrico-colour-palette.md` to ensure >= 4.5:1 text contrast and >= 3:1 graphical component contrast.
   - Verify UI layout integrity when rendered under the app's global `maxFontSizeMultiplier = 1.5` cap, confirming no unexpected container clipping.
   - Validate color token usage against `docs/design/expyrico-colour-palette.md` (ensuring Alert Red is used exclusively for Expired status).
4. **Run Performance Verification**:
   - Verify that list rendering uses `initialNumToRender={10}`, `maxToRenderPerBatch={10}`, and `removeClippedSubviews={true}`.
   - Run timing benchmark on `filterAndSortRecords` with 500 mock records in Jest to measure execution time, recording benchmark metrics before claiming 60fps compatibility.
## Success Criteria

- [x] All unit and integration test suites pass with 100% green status.
- [x] Accessibility audit confirms WCAG AA compliance for color contrast (>= 4.5:1 text, >= 3:1 UI) and touch targets (>= 44x44pt), with verified layout integrity under the app's maxFontSizeMultiplier = 1.5 baseline cap.
- [x] Performance benchmarks measure sub-16ms execution for filtering/sorting 500 records in Jest, and scrolling near bottom triggers smooth next-page append with spinner.
- [x] No regression on existing record card swipe gestures, details navigation, or pull-to-refresh sync.

## Risk Assessment

- **Risk**: Updating snapshot tests might mask unintended side effects in unrelated parts of `HomeTab`.
  - **Mitigation**: Carefully review snapshot diff lines to ensure only the intended header controls and list presentation changed.
  - **Broken Assumption Signal**: Snapshots show `UseNextHero` missing in default state or missing safe area insets.
  - **Response**: Keep `UseNextHero` explicitly mounted when `!isFiltered` and ensure `Screen` padding props remain intact.
