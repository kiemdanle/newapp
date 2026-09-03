---
phase: 2
title: "Search Bar, Sort Pills, and Active Filter Chips"
status: pending
priority: P1
effort: "6h"
dependencies: [1]
---

# Phase 2: Search Bar, Sort Pills, and Active Filter Chips
<!-- Updated: Validation Session 1 - Confirmed search debounce and active filter count indicators -->

## Overview

Build the interactive front-of-house UI controls for the pantry screen: a responsive search bar with a 300ms debounce and active filter badge, a horizontal scrollable sort pill selector, and a row of dismissible active filter chips with a "Clear all" action. All components follow the mandated Expyrico palette and accessibility guidelines.

## Requirements

### Functional
- **`PantrySearchBar`**:
  - Controlled text input displaying `searchQuery`.
  - Debounce typing events by 300ms before propagating to parent query state to prevent UI stutter.
  - Instant clear `(X)` button when input has text.
  - Filter trigger button with icon and numeric badge indicating the count of active non-default filters.
  - Tap on filter button triggers `onOpenFilter` callback.
- **`PantrySortPills`**:
  - Horizontal `ScrollView` with `showsHorizontalScrollIndicator={false}` displaying sort options.
  - Pills:
    - `expiry_asc`: "⏳ Expiring Soon"
    - `expiry_desc`: "🗓️ Latest Expiry"
    - `name_asc`: "🔤 Name A-Z"
    - `name_desc`: "🔤 Name Z-A"
    - `quantity_desc`: "📦 Highest Stock"
    - `recently_added`: "⏱️ Recently Added"
  - Selecting a pill triggers `onSelectSort(sortOption)` and updates visual selection state.
- **`PantryActiveFilterChips`**:
  - Renders when any filter is active (e.g. category selected, expiry status != 'all', inStockOnly == true, or search query present).
  - Individual chip components with label and close `(X)` icon (e.g., `"Category: Dairy ✕"`, `"Expiring Soon ✕"`).
  - Tapping `(X)` on a chip removes only that filter.
  - "Clear all" button to reset all filters to default with one tap.

### Non-functional
- Fully compliant with Expyrico color tokens:
  - Container background: `theme.colors.bgElevated` (`#FAFAF8`).
  - Active pill: `theme.colors.primaryLight` (`#D6F0E6`) background, `theme.colors.primary` (`#4BAE8A`) border, `theme.colors.primaryDark` (`#3A8F6F`) text.
  - Inactive pill: `theme.colors.bgGlass` background, `theme.colors.border` (`#F0F0ED`), `theme.colors.textMuted` (`#8C8C85`) text.
  - Filter counter badge: `theme.colors.accent` (`#F5A623`) with `theme.colors.text` (`#2C2C28`).
- WCAG AA accessibility: `accessibilityRole="search"`, `accessibilityLabel="Search pantry items"`, touch targets >= 44x44 points.

## Architecture

```
+-------------------------------------------------------------------------------+
| PantrySearchBar                                                               |
|  [Search Icon] [TextInput: "Search pantry items..."] [(X) Clear] [Filter (2)] |
+-------------------------------------------------------------------------------+
                                        |
+-------------------------------------------------------------------------------+
| PantrySortPills (Horizontal ScrollView)                                       |
|  (⏳ Expiring Soon*)  (🗓️ Latest Expiry)  (🔤 Name A-Z)  (📦 Highest Stock)    |
+-------------------------------------------------------------------------------+
                                        |
+-------------------------------------------------------------------------------+
| PantryActiveFilterChips (Conditional)                                         |
|  [Category: Dairy ✕]  [Status: Expiring Soon ✕]              [Clear all]      |
+-------------------------------------------------------------------------------+
```

## Related Code Files

- Create: `apps/mobile/src/features/records/PantrySearchBar.tsx`
- Create: `apps/mobile/src/features/records/PantrySortPills.tsx`
- Create: `apps/mobile/src/features/records/PantryActiveFilterChips.tsx`
- Create: `apps/mobile/tests/unit/pantry-search-bar.test.tsx`
- Create: `apps/mobile/tests/unit/pantry-sort-pills.test.tsx`

## Implementation Steps

1. **Implement `PantrySearchBar.tsx`**:
   - Create props interface: `value`, `onChangeText`, `onOpenFilter`, `activeFilterCount`.
   - Manage local input state for instantaneous keystroke responsiveness while debouncing `onChangeText` via `useEffect` with a 300ms timer.
   - Add clear button appearing conditionally when `localText.length > 0`.
   - Add filter button displaying an `options-outline` icon and an absolute-positioned badge pill if `activeFilterCount > 0`.
   - Style with `useTheme()` using `theme.colors.bgElevated`, `theme.colors.border`, and `theme.radii.lg`.
2. **Implement `PantrySortPills.tsx`**:
   - Create props interface: `selectedSort`, `onSelectSort`.
   - Render horizontal `ScrollView` with items from sort options metadata.
   - For active pill: apply `primaryLight` background, `primary` border, and bold `primaryDark` text.
   - For inactive pills: apply neutral border and muted text.
   - Provide `testID={pantry-sort-pill-${item.id}}` on each pill.
3. **Implement `PantryActiveFilterChips.tsx`**:
   - Create props interface: `filters`, `searchQuery`, `onRemoveFilter`, `onClearSearch`, `onClearAll`.
   - Build chips for active search text, selected category, non-default expiry status, and in-stock toggle.
   - Style chips with rounded badge appearance (`radii.md`), subtle border, and touchable remove icon.
   - Add "Clear all" text button styled with `theme.colors.primary` or `theme.colors.accent`.
4. **Write Unit Tests**:
   - Verify `PantrySearchBar` debounces text input and calls `onChangeText` after 300ms.
   - Verify clear button resets text immediately.
   - Verify filter badge renders correct count and triggers `onOpenFilter`.
   - Verify `PantrySortPills` renders all sort options and fires `onSelectSort`.
   - Verify `PantryActiveFilterChips` triggers individual removal and clear all.

## Success Criteria

- [x] Typing into `PantrySearchBar` updates internal state smoothly and calls `onChangeText` after 300ms.
- [x] Active filter badge displays exact count of active non-default filters.
- [x] Sort pills horizontally scroll and highlight the selected sort with primary brand colors.
- [x] Filter chips render active tags with functional dismiss buttons and a "Clear all" button.
- [x] Unit tests in `pantry-search-bar.test.tsx` and `pantry-sort-pills.test.tsx` pass 100%.

## Risk Assessment

- **Risk**: Rapid text entry might cause debouncing lag or desync between parent and child state.
  - **Mitigation**: Sync `localText` from external `value` prop only when external `value` differs from current `localText`.
  - **Broken Assumption Signal**: Parent state clears search (e.g. from "Clear all" chip), but the text input retains previous typed characters.
  - **Response**: Add `useEffect(() => { setLocalText(value); }, [value])` to synchronize external resets.
