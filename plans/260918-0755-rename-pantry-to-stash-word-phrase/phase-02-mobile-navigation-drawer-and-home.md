---
phase: 2
title: "Mobile Navigation, Drawer & Home Screen"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1]
---

# Phase 2: Mobile Navigation, Drawer & Home Screen

## Overview

Update the top-level mobile navigation structures, slide-out drawer, Home screen header, tabs, scope toggles, empty state, and connection notice banners from "Pantry" to "Stash".

## Requirements

### Functional Requirements
- **Navigation Drawer (`LeftDrawerMenu.tsx`)**:
  - Drawer menu item label updated from `'Pantry'` to `'Stash'`. Subtitle remains `'Expiring & in stock'`.
  - Active scope pill updated:
    - Household: `'Household Stash'` (was `'Household Pantry'`).
    - Personal: `'Personal Stash'` (was `'Personal Pantry'`).
    - All: `'All Stashes'` (was `'All Pantries'`).
- **Bottom Tabs (`TabsNavigator.tsx`)**:
  - Home tab sublabel updated to `'Stash inventory'` (was `'Pantry inventory'`).
- **Stack Header (`AppNavigator.tsx`)**:
  - Record screen header title updated to `'Stash item'` (was `'Pantry item'`).
- **Home Tab Screen (`home.tsx`)**:
  - Top bar title updated to `'Stash'` (was `'Pantry'`).
  - Share button accessibility label updated to `'Share stash with family or roommates'`.
  - History tab accessibility label updated to `'Stash history and discarded items'`.
  - Empty state title updated to `'Start your stash'` (was `'Start your pantry'`).
- **Scope Toggle (`ScopeToggle.tsx`)**:
  - Accessibility labels updated to `'Filter stash: All'`, `'Filter stash: Personal'`, `'Filter stash: {Name}'`.
- **Sync & Offline Banners (`ConnectionNotice.tsx`, `SyncStatusBar.tsx`)**:
  - Connection notice copy: `"Expyrico requires an active connection to keep your stash, household sharing, and catalogue safely in sync."` and `"Your stash and household data are safe..."`.
  - Sync status bar: `"Offline — showing local stash (tap to retry)"`.

### Non-Functional Requirements
- Maintain UK English conventions (`catalogue`).
- Keep test IDs and navigation keys stable (`testID="nav-Home"`, `testID="home-share-pantry-btn"`, `testID="pantry-tab-in-stock"`, `testID="pantry-tab-history"`) unless updating test files concurrently to avoid breaking automation hooks.

## Architecture

```
User opens Mobile App
  │
  ├──> Left Drawer Menu: "Stash" · "Personal Stash" / "All Stashes"
  │
  ├──> Home Header: "Stash" greeting · Share stash button
  │
  ├──> Scope Toggle: Filter stash: All / Personal / Household
  │
  ├──> Tabs: In Stock · Stash history
  │
  ├──> Empty State: "Start your stash"
  │
  └──> Offline Notice: "...keep your stash, household sharing..."
```

## Related Code Files

### Modify
- `apps/mobile/src/navigation/LeftDrawerMenu.tsx`
- `apps/mobile/src/navigation/TabsNavigator.tsx`
- `apps/mobile/src/navigation/AppNavigator.tsx`
- `apps/mobile/app/(app)/(tabs)/home.tsx`
- `apps/mobile/src/features/households/ScopeToggle.tsx`
- `apps/mobile/src/components/ConnectionNotice.tsx`
- `apps/mobile/src/components/SyncStatusBar.tsx`
- Related snapshot tests: `apps/mobile/tests/snapshots/__snapshots__/`

## Implementation Steps

1. Edit `apps/mobile/src/navigation/LeftDrawerMenu.tsx`:
   - Change `label: 'Pantry'` to `label: 'Stash'`.
   - Update scope pill ternary to return `'Household Stash'`, `'Personal Stash'`, `'All Stashes'`.
2. Edit `apps/mobile/src/navigation/TabsNavigator.tsx`:
   - Update Home tab sublabel to `'Stash inventory'`.
3. Edit `apps/mobile/src/navigation/AppNavigator.tsx`:
   - Update `Record` screen title to `'Stash item'`.
4. Edit `apps/mobile/app/(app)/(tabs)/home.tsx`:
   - Replace greeting text `<Text style={styles.greeting}>Pantry</Text>` with `'Stash'`.
   - Update share button `accessibilityLabel` to `'Share stash with family or roommates'`.
   - Update history tab `accessibilityLabel` to `'Stash history and discarded items...'`.
   - Update `emptyTitle` to `'Start your stash'`.
5. Edit `apps/mobile/src/features/households/ScopeToggle.tsx`:
   - Update `accessibilityLabel` from `Filter pantry: ${segment.label}` to `Filter stash: ${segment.label}`.
6. Edit `apps/mobile/src/components/ConnectionNotice.tsx` and `SyncStatusBar.tsx`:
   - Update descriptions to reference `stash` instead of `pantry`.
7. Update associated tests and snapshots:
   - Update test expectations matching the new labels.

## Success Criteria

- [x] Navigation drawer displays "Stash" and "Personal Stash" / "All Stashes".
- [x] Home tab header renders "Stash" title.
- [x] Home empty state displays "Start your stash".
- [x] Offline notice displays "keep your stash, household sharing, and catalogue safely in sync".
- [x] Scope toggle buttons provide "Filter stash: ..." accessibility labels.
- [x] Mobile navigation and home tests pass cleanly.

## Risk Assessment

- **Risk**: Stale Jest snapshots failing due to text diffs.
- **Mitigation**: Update snapshots with `pnpm --filter @expyrico/mobile test -u` after verifying string changes.
