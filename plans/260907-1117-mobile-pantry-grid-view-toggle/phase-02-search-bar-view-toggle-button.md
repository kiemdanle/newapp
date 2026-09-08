---
phase: 2
title: "Search Bar View Toggle Button"
status: completed
priority: P1
effort: "45m"
dependencies: ["phase-01-ui-preferences-view-mode-store"]
---

# Phase 2: Search Bar View Toggle Button

## Overview
Add an accessible, theme-styled view switch toggle button next to the filter button in `PantrySearchBar.tsx`, allowing users to seamlessly toggle between List and Grid layouts with clear visual feedback.

## Requirements
- Functional:
  - Add `viewMode?: 'list' | 'grid'` and `onToggleViewMode?: () => void` to `PantrySearchBarProps`.
  - Render `<Pressable testID="pantry-view-mode-toggle-btn">` immediately to the right of `pantry-filter-toggle-btn`.
  - When `viewMode === 'list'`, display `Ionicons` `grid-outline` icon with label `"Switch to grid view"`.
  - When `viewMode === 'grid'`, display `Ionicons` `list-outline` icon with label `"Switch to list view"`.
  - Tapping the button calls `onToggleViewMode`.
- Non-functional:
  - Minimum $44 \times 44\text{ pt}$ touch target (`width: 44, height: 44, borderRadius: theme.radii.lg`).
  - Active/pressed feedback using `theme.colors.bgGlass`.
  - Proper TalkBack/VoiceOver accessibility traits (`accessibilityRole="button"`, descriptive label).

## Architecture & Layout

```
Header Row Layout:
┌──────────────────────────────────────────────┬──────────────┬──────────────┐
│ [🔍 Search name, brand, category...]     [✕] │ [⚙ Filter 1] │ [⊞ Grid/List]│
│ (flex: 1, minHeight: 44)                     │ (44 x 44 pt) │ (44 x 44 pt) │
└──────────────────────────────────────────────┴──────────────┴──────────────┘
```

```typescript
// In PantrySearchBar.tsx
<Pressable
  testID="pantry-view-mode-toggle-btn"
  accessibilityRole="button"
  accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
  onPress={onToggleViewMode}
  style={({ pressed }) => [
    styles.iconBtn,
    {
      backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
    },
  ]}
>
  <Ionicons
    name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
    size={20}
    color={theme.colors.text}
  />
</Pressable>
```

## Related Code Files
- Modify: `apps/mobile/src/features/records/PantrySearchBar.tsx`
- Modify: `apps/mobile/src/features/records/RecordList.tsx` (passes props down)

## Implementation Steps
1. **Extend `PantrySearchBarProps`**:
   Add `viewMode?: 'list' | 'grid'` and `onToggleViewMode?: () => void`.
2. **Add View Switch Button**:
   In `PantrySearchBar.tsx`, append the `<Pressable testID="pantry-view-mode-toggle-btn">` inside the `styles.container` flex row next to `pantry-filter-toggle-btn`.
3. **Style Consistency**:
   Use matching `styles.iconBtn` properties:
   ```typescript
   iconBtn: {
     width: 44,
     height: 44,
     borderWidth: 1,
     alignItems: 'center',
     justifyContent: 'center',
   }
   ```
4. **Wire Props in `RecordList.tsx`**:
   In `RecordList.tsx`'s `renderControls()`, pass:
   ```typescript
   const viewMode = useUiPreferencesStore((s) => s.pantryViewMode);
   const setViewMode = useUiPreferencesStore((s) => s.setPantryViewMode);
   const handleToggleViewMode = useCallback(() => {
     void setViewMode(viewMode === 'grid' ? 'list' : 'grid');
   }, [viewMode, setViewMode]);
   ```

## Success Criteria
- [x] View toggle button renders beside the filter button with a 44x44pt hit target.
- [x] Icon renders `grid-outline` in list mode and `list-outline` in grid mode.
- [x] Tapping triggers `onToggleViewMode`.
- [x] Accessibility label matches current state and action.

## Risk Assessment
- *Risk*: Narrow screen width (e.g. 320–360pt) could wrap or shrink the search input too much.
- *Mitigation*: Both buttons are 44pt fixed width with 8pt gap (total 96pt). On a 360pt viewport with 32pt horizontal padding, the search box retains 232pt, which is plenty for placeholder and clear button.
