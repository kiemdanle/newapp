---
title: "Mobile Pantry Grid View and View Switch Toggle"
description: "Implement persistent 2-column grid view alongside default list view in the mobile pantry with view toggle button next to filter controls, preserving sectioned grouping, pagination, and bulk selection."
status: completed
priority: P1
effort: "4h"
tags: ["mobile", "pantry", "grid-view", "ui", "react-native", "ux"]
created: 2026-09-07
---

# Mobile Pantry Grid View and View Switch Toggle

## Overview

Currently, the mobile pantry screen (`RecordList.tsx`) only supports a single-column list view (`RecordCard.tsx`). While compact, a 1-column list requires significant vertical scrolling and does not take advantage of visual product browsing (thumbnails, packaging, and shelf-like scanning) that users expect in grocery and kitchen inventory apps.

This plan adds a rich, interactive **2-column Grid View** to the mobile pantry alongside the existing List View:
1. A 44×44pt **view switch toggle button** is added directly to the right of the search/filter controls in `PantrySearchBar.tsx`.
2. A dedicated, responsive **`PantryGridCard.tsx`** component is created, honoring the Expyrico design system (`Warm White #FAFAF8`, `Stone #F0F0ED`, `Pebble #8C8C85`, `Fresh Sage #4BAE8A`).
3. The underlying **`SectionList` remains a single stable instance**, chunking section items into pairs of two for grid mode, ensuring search input focus, keyboard connection, pull-to-refresh, urgency section headers (`Expired`, `Expires today`, `Use this week`, `Later`), and pagination are 100% preserved.
4. User preference (`'list' | 'grid'`) is persistently stored via `useUiPreferencesStore` in `AsyncStorage` and restored on app launch.

## Problem Statement & Context

1. **Browsing Inefficiency**: Users with 20–50+ pantry items must scroll extensively through full-width list rows. Grid view provides a shelf-like visual layout allowing users to scan more items per screen height.
2. **Missing View Customization**: Users currently have no choice over item presentation in the pantry.
3. **Control Row Real Estate**: The search bar header row currently houses `[ Search Input ] [ Filter Button ]`. Adding a 44pt view toggle button next to the filter button creates a balanced, thumb-accessible toolbar (`[ Search Input ] [ Filter (Badge) ] [ View Switch ]`).
4. **Preserving SectionList Architecture**: React Native's `SectionList` does not natively support `numColumns={2}`. Replacing `SectionList` with a `FlatList` would destroy section headers (`Expired`, `Today`, `This week`, `Later`) and break keyboard focus continuity. The architectural solution is to chunk section arrays into 2-item row tuples, keeping the stable `SectionList` in place.

## Architecture & Data Flow

```
[PantrySearchBar (PantrySearchBar.tsx)]
  ├── Search Input Box (flex: 1)
  ├── Filter Button (<Pressable testID="pantry-filter-toggle-btn">)
  └── View Mode Switch Button (<Pressable testID="pantry-view-mode-toggle-btn">)
        ├── Icon: 'grid-outline' (in list mode) | 'list-outline' (in grid mode)
        ├── Label: "Switch to grid view" | "Switch to list view"
        └── onPress: toggles pantryViewMode in useUiPreferencesStore

[UiPreferencesStore (uiPreferencesStore.ts)]
  ├── State: pantryViewMode ('list' | 'grid')
  ├── Hydration: loads @expyrico_pantry_view_mode from AsyncStorage
  └── Mutation: setPantryViewMode(mode) persists to AsyncStorage & syncs to backend

[RecordList (RecordList.tsx)]
  ├── Reads: pantryViewMode = useUiPreferencesStore((s) => s.pantryViewMode)
  ├── Sections Transformation (when pantryViewMode === 'grid'):
  │     Transforms each section's data from `LocalRecord[]`
  │     to chunked rows: `Array<[LocalRecord, LocalRecord?]>`
  └── RenderItem:
        ├── If 'list': renders <RecordRow> (wrapping <RecordCard>)
        └── If 'grid': renders <PantryGridRow>
              ├── Item A: <PantryGridCard record={itemA} ... />
              └── Item B: <PantryGridCard record={itemB} ... /> (or spacer <View style={{ flex: 1 }} />)
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Add `pantryViewMode: 'list' \| 'grid'` to `useUiPreferencesStore` with AsyncStorage persistence | P1 |
| 2 | Add accessible view switch toggle button next to filter button in `PantrySearchBar.tsx` | P1 |
| 3 | Create high-craft `PantryGridCard.tsx` component respecting Expyrico design system and WCAG contrast | P1 |
| 4 | Integrate 2-column grid rendering into `RecordList.tsx` preserving section headers, pagination, and search focus | P1 |
| 5 | Full automated integration tests covering view switching, preference persistence, grid card interactions, and selection mode | P1 |

## Non-Goals

- Do not replace `SectionList` with `FlatList` (section headers must remain intact in grid view).
- Do not alter the filtering pipeline or date calculations in `filterAndSortRecords.ts`.
- Do not introduce arbitrary non-Expyrico palette colors.
- Do not add complex multi-column layouts (3+ columns) on phone portrait viewports.
- Grid View is for the In Stock tab only. The History tab retains its chronological single-column audit log (`PantryHistoryView.tsx`). The view switch button lives inside `RecordList`'s search bar and does not appear on History.
- Grid cards do not support swipe actions (+1, Edit, Delete); users tap to open the detail screen, or use long-press for bulk selection.
## Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| 1 | [UI Preferences View Mode Store](./phase-01-ui-preferences-view-mode-store.md) | Completed | Extend `useUiPreferencesStore` with `pantryViewMode` and AsyncStorage persistence |
| 2 | [Search Bar View Toggle Button](./phase-02-search-bar-view-toggle-button.md) | Completed | Add view mode switch button next to filter toggle in `PantrySearchBar.tsx` |
| 3 | [Pantry Grid Card Component](./phase-03-pantry-grid-card-component.md) | Completed | Build `PantryGridCard.tsx` component with thumbnail, status, brand, and selection |
| 4 | [RecordList Grid Integration](./phase-04-record-list-grid-integration.md) | Completed | Wire 2-column row chunking and renderItem switching into `RecordList.tsx` |
| 5 | [Integration Tests & Verification](./phase-05-integration-tests-and-verification.md) | Completed | Unit, snapshot, and on-device ADB integration testing |

## Success Criteria

- [x] Tapping the view toggle button in `PantrySearchBar` smoothly toggles between List View and Grid View.
- [x] Grid View displays pantry items in a 2-column grid layout with equal card widths and consistent 12pt gaps.
- [x] Section headers (`Expired`, `Expires today`, `Use this week`, `Later`) remain fully functional in Grid View.
- [x] Tapping a grid card navigates to the item detail screen (`RecordScreen`).
- [x] Long-pressing a grid card enters selection mode and allows toggling checkboxes.
- [x] View mode preference persists across app relaunches via AsyncStorage.
- [x] Search input focus and typing are not interrupted when toggling views.
- [x] 100% test pass rate across Jest unit/integration suites and clean Android Gradle build.

## Validation Log

### Session 1 — 2026-09-07
**Trigger:** Post-plan validation interview (`/ak:plan validate`)
**Questions asked:** 3

#### Verification Results
- Claims checked: 15
- Verified: 15 | Failed: 0 | Unverified: 0
- Tier: Full (5 phases)
- Key verifications: `uiPreferencesStore.ts` shape, `PantrySearchBar.tsx` control row, `RecordList.tsx` SectionList, `ProductThumbnail.tsx` usage, Expyrico tokens, and selection mode bindings.

#### Questions & Answers

1. **[Visual Hierarchy]** In the 2-column Grid View, what visual proportion and layout should each pantry item card prioritize?
   - Options: Balanced Grocery Card (Recommended) | Compact Action Card | Visual-First Showcase Tile
   - **Answer:** Balanced Grocery Card (Recommended)
   - **Rationale:** Centered 72–80pt thumbnail on top, brand, 2-line title, quantity pill, and relative expiry below. Familiar e-commerce/grocery card proportion offering high scannability without clutter.

2. **[Transition Behavior]** When the user taps the view mode switch button, how should the transition between List and Grid layouts behave?
   - Options: Instant In-Place Swap (Recommended) | Smooth 150ms Cross-Fade
   - **Answer:** Instant In-Place Swap (Recommended)
   - **Rationale:** Immediate layout swap within the single stable SectionList, maintaining view hierarchy and search input focus with zero frame drops.

3. **[Selection UX]** In bulk selection mode, how should selectable and selected cards be indicated in Grid View?
   - Options: Top-Left Corner Checkbox (Recommended) | Card Outline Highlight
   - **Answer:** Top-Left Corner Checkbox (Recommended)
   - **Rationale:** Circular checkbox in top-left corner of each card (Pebble `#8C8C85` outline when unselected, Fresh Sage `#4BAE8A` fill when selected), matching standard gallery and list pickers.

#### Confirmed Decisions
- **Balanced Grocery Card**: Prominent top thumbnail (72pt) with structured text block below.
- **Instant In-Place Swap**: No artificial delay or layout animations that could drop frames or interrupt active typing.
- **Top-Left Corner Checkbox**: Standard circular checkbox overlay with WCAG AA Pebble `#8C8C85` unselected boundary.

#### Action Items
- [x] Propagate Balanced Grocery Card and Top-Left Checkbox decisions to Phase 3.
- [x] Propagate Instant In-Place Swap decision to Phase 4.

### Whole-Plan Consistency Sweep
- Contradictions detected: 0
- Stale references found: 0
- Embedded code reconciliation: All snippets in `plan.md`, `phase-03`, and `phase-04` align with the Balanced Grocery Card layout, instant swap, and top-left checkbox.

## Red Team Review

### Session 1 — 2026-09-07
**Findings:** 14 (7 accepted, 7 deduplicated/rejected)
**Severity breakdown:** 2 Critical, 12 High, 0 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Pagination Phantom-Append on View Mode Toggle | Critical | Accept | Phase 4 / RecordList.tsx |
| 2 | SectionList Chunked Tuple Keys & Header Original Count | Critical | Accept | Phase 4 / RecordList.tsx |
| 3 | Local Device Preference & Logout Cleanup | High | Accept | Phase 1 / uiPreferencesStore.ts |
| 4 | 360pt Toolbar & Grid Card Metadata Stack | High | Accept | Phase 2 / Phase 3 |
| 5 | Household Badge Classifier Gate & Privacy Allowlist | High | Accept | Phase 3 / PantryGridCard.tsx |
| 6 | Selection Long-Press Guard & Bulk Delete Removal | High | Accept | Phase 3 / Phase 4 |
| 7 | Strict Expyrico Token Compliance & Canonical Test Titles | High | Accept | Phase 3 / Phase 5 |

#### Finding Details & Rationale

1. **Pagination Phantom-Append on View Mode Toggle [CRITICAL]**
   - **Reviewer:** Failure Mode Analyst
   - **Location:** `apps/mobile/src/features/records/RecordList.tsx:251-266`
   - **Flaw:** Toggling to grid mode shrinks content height by ~50%, dropping distance-from-end under `onEndReachedThreshold={0.25}` and firing a spurious `loadMore()`.
   - **Fix Applied:** In `RecordList.tsx`, reset `onEndReachedCalledDuringMomentumRef.current = true` upon view mode toggle to suppress layout-triggered pagination.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Pagination momentum guard on view toggle -->`

2. **SectionList Chunked Tuple Keys & Header Original Count [CRITICAL]**
   - **Reviewer:** Assumption Destroyer & Failure Mode Analyst
   - **Location:** `apps/mobile/src/features/records/RecordList.tsx:462,586-628`
   - **Flaw:** Keying chunked rows by `item[0].id` causes key collisions when neighbors shift, and printing `section.data.length` in headers halves displayed counts.
   - **Fix Applied:** Key rows using composite IDs `${a.id}:${b?.id ?? 'empty'}`. Store `originalCount` before chunking and update all `renderSectionHeader` branches to read `originalCount ?? section.data.length`. Pass `extraData={{ viewMode, selectionMode, selectedIds }}`.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Composite keys, extraData, & original count headers -->`

3. **Local Device Preference & Logout Cleanup [HIGH]**
   - **Reviewer:** Security Adversary
   - **Location:** `apps/mobile/src/store/uiPreferencesStore.ts`
   - **Flaw:** `userUiPreferencesSchema` is `.strict()` on the backend; patching `pantryViewMode` throws Zod 400. In addition, un-namespaced `@expyrico_pantry_view_mode` persists across account sign-outs.
   - **Fix Applied:** Keep `pantryViewMode` as a resilient local device preference in `AsyncStorage`. Clear it and reset to `'list'` in `session-store.ts` (`clearAllLocalUserData`) upon sign-out.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Scoped local persistence & logout cleanup -->`

4. **360pt Toolbar & Grid Card Metadata Stack [HIGH]**
   - **Reviewer:** Assumption Destroyer
   - **Location:** `apps/mobile/src/features/records/PantryGridCard.tsx`
   - **Flaw:** Horizontal row of household badge + relative expiry date clips on 360pt screen widths.
   - **Fix Applied:** Wrap card footer metadata with `flexWrap: 'wrap'` or stacked layout so neither pill nor expiry text clips.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Responsive metadata wrap for 360pt screens -->`

5. **Household Badge Classifier Gate & Privacy Allowlist [HIGH]**
   - **Reviewer:** Security Adversary
   - **Location:** `apps/mobile/src/features/records/PantryGridCard.tsx`
   - **Flaw:** Naive `householdName ? ... : undefined` badge logic in grid cards mislabels shared items without cached names as personal.
   - **Fix Applied:** Match `RecordCard`'s classifier exactly: `isHouseholdItem = Boolean(record.householdId)`, `badgeLabel = householdName || 'Shared'`. Personal badge is only shown when `scope === 'all' && !record.householdId`. Strictly allowlist grid fields (no notes, price, or store).
   - **Marker:** `<!-- Updated: Red Team Session 1 - Household badge gate & privacy allowlist -->`

6. **Selection Long-Press Guard & Bulk Delete Removal [HIGH]**
   - **Reviewer:** Failure Mode Analyst & Security Adversary
   - **Location:** `apps/mobile/src/features/records/RecordList.tsx:376-379` & `PantryGridCard.tsx`
   - **Flaw:** Plan referenced bulk Delete (which does not exist; only Move exists), and long-pressing in selection mode would reset selected items to a single item.
   - **Fix Applied:** Remove bulk Delete mentions. In `PantryGridCard.tsx`, guard long-press: `if (!selectionMode) onLongPress?.(record.id)`. When `selectionMode === true`, tapping toggles selection.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Swipe non-goal & selection mode guard -->`

7. **Strict Expyrico Token Compliance & Canonical Test Titles [HIGH]**
   - **Reviewer:** Assumption Destroyer
   - **Location:** `apps/mobile/src/features/records/PantryGridCard.tsx` & Phase 5
   - **Flaw:** Hardcoded light hex codes break dark mode, and test matrix used non-canonical section names ('Today' vs 'Expires today').
   - **Fix Applied:** Mandate 100% theme token resolution (`theme.colors.bgElevated`, `theme.colors.border`, `theme.colors.text`, `theme.colors.textMuted`, `theme.colors.neutralMid`). Use canonical `SECTION_TITLES` in tests.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Expyrico dark tokens & canonical test titles -->`

### Whole-Plan Consistency Sweep
- Contradictions detected: 0
- Stale references found: 0
- Decision delta reconciled: In-Stock only scope, composite keys, pagination guard, logout reset, and household classifier gates are fully aligned across all phase files.

<!-- slug: mobile-pantry-grid-view-toggle -->
