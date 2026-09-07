---
title: "Mobile Pantry Urgent Items Interactive Filter and Urgency Section Preservation"
description: "Transform the static 'X urgent' header count pill into an accessible two-way toggle that filters the pantry in-place while preserving urgency sections (Expired, Expires today, Use this week) across all combined filter states."
status: completed
priority: P1
effort: "4h"
tags: ["mobile", "pantry", "filters", "a11y", "react-native", "ux"]
created: 2026-09-07
---

# Mobile Pantry Urgent Items Interactive Filter and Urgency Section Preservation

## Overview

The pantry screen top bar currently displays an informative count pill (e.g. `1 urgent`), but wraps it in an inert `<View>` with zero touch handling or accessibility traits. Tapping the pill produces no feedback, violating mobile affordance principles and frustrating users who want to immediately view and triage their urgent items.

This plan upgrades the count pill into an accessible, interactive two-way toggle button. Tapping it activates an `'urgent'` expiry filter (`expiry <= 7 days`, matching expired and expiring-soon items). Addressing the advisor concern, the filtered list **preserves distinct urgency sections (`Expired`, `Expires today`, `Use this week`) even when combined with text search or category filters**, rather than collapsing into an undifferentiated flat list. It also provides bidirectional synchronization with filter chips, Filter Modal options, and automatic tab switching from History to In Stock.

## Problem Statement & Context

1. **Dead Click Affordance**: In `apps/mobile/app/(app)/(tabs)/home.tsx`, `{totalUrgent > 0}` renders `<View style={styles.countPill}>`. Users tap this prominent badge expecting it to reveal the urgent items, but nothing happens.
2. **Conflated Urgency vs. Food Safety**: "Urgent" combines spoiled items (`Expired`) with edible items requiring prompt use (`Expires today`, `Use this week`). Standard pantry filters collapse results into a flat list (`filtered_results`), which would dangerously mix spoiled yogurt with fresh milk.
3. **Advisor Concern Reconciliation**: An earlier draft proposed keeping urgency sections only when `!normalizedSearchQuery`. As flagged in the advisory review, users explicitly selected both **"Keep Urgency Sections"** and **"Combine Filters"**. Restricting grouping to non-search queries silently broke grouping as soon as a user typed a character. Urgency sectioning must apply to all urgent results, including combined search and category queries.
4. **Cross-Tab Disconnect**: If a user is on the `History` tab, the urgent pill still reflects in-stock records, but tapping it had no path to take the user to the actionable items.

## Architecture & Data Flow

```
[HomeTab (home.tsx)]
  │
  ├── State: activeTab ('in_stock' | 'history')
  ├── Computes: totalUrgent (from active in-stock records)
  │
  ├── Header Action: <Pressable testID="home-urgent-pill">
  │     ├── Visuals: Inactive (Soft Butter / Honey border) vs. Active (Honey fill / checkmark / ring)
  │     └── onPress:
  │           ├── If activeTab === 'history' → setActiveTab('in_stock')
  │           └── Toggles isUrgentActive via RecordList ref / callback bridge
  │
  └── <RecordList>
        ├── Filters State: PantryFilterState (supports expiryStatus: 'urgent')
        ├── Filter Pipeline: filterAndSortRecords matches status === 'red' || status === 'amber'
        ├── Section Pipeline:
        │     └── If expiryStatus === 'urgent':
        │           Runs groupRecords(paginatedItems)
        │           Renders sections: 'Expired', 'Expires today', 'Use this week'
        │           (Omits 'Later'; works with or without search queries)
        ├── Filter Chips: PantryActiveFilterChips displays 'Urgent (≤ 7 days)' [X]
        └── Filter Modal: PantryFilterModal includes 'Urgent (Expired & Soon)' option
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Convert top-bar count pill into an accessible, responsive `<Pressable>` with $44 \times 44\text{ pt}$ hit-box and clear active/inactive visual states | P1 |
| 2 | Support `'urgent'` in `PantryFilterState` and filter pipeline ($\le 7\text{ days}$, status `'red'` or `'amber'`) | P1 |
| 3 | Preserve urgency sections (`Expired`, `Expires today`, `Use this week`) for all urgent queries (fixing the advisor concern: including urgent+search and urgent+category) | P1 |
| 4 | Synchronize active filter state bidirectionally between top-bar pill, filter chips (`PantryActiveFilterChips`), and the Filter Modal | P2 |
| 5 | Automatically switch from `History` tab to `In Stock` tab when urgent pill is tapped | P2 |
| 6 | Comprehensive automated integration tests covering isolated urgent filter, combined search+urgent grouping, chip clearing, and cross-tab switching | P1 |

## Non-Goals

- Do not replace or hide `UseNextHero` when unfiltered (it continues spotlighting the single top priority item).
- Do not introduce a separate modal sheet, drawer, or dedicated urgent navigation route.
- Do not alter the core date-math logic in `expiryStatus.ts` or `groupRecords.ts`.
- Do not introduce arbitrary non-Expyrico colors.

## Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| 1 | [Filter Pipeline & Types](./phase-01-filter-pipeline-and-types.md) | Completed | Extend `PantryFilterState.expiryStatus` with `'urgent'` and update `filterAndSortRecords.ts` |
| 2 | [Sectioned Urgency Grouping in RecordList](./phase-02-sectioned-urgency-grouping.md) | Completed | Group paginated results by urgency sections for all urgent queries (resolving advisor concern) |
| 3 | [Header Pill Toggle & Tab Switching](./phase-03-header-pill-toggle-and-tab-switching.md) | Completed | Convert pill to `<Pressable>`, build state bridge, and handle cross-tab auto-switch |
| 4 | [Filter Chips & Modal Synchronization](./phase-04-filter-chips-and-modal-sync.md) | Completed | Add active chip in `PantryActiveFilterChips` and option in `PantryFilterModal` |
| 5 | [Integration Tests & Verification](./phase-05-integration-tests-and-verification.md) | Completed | Integration test suite in Jest and local Android build/smoke verification |

## Success Criteria

- [x] Tapping `X urgent` pill in `home.tsx` toggles in-place filtering on/off.
- [x] When active, `RecordList` renders separate `Expired`, `Expires today`, and `Use this week` section headers without `Later`.
- [x] Typing in the search bar while `urgent` is active filters results while maintaining the urgency section headers.
- [x] An active `Urgent (≤ 7 days)` chip appears in `PantryActiveFilterChips`; tapping its `(X)` clears the filter and returns the pill to its inactive state.
- [x] Tapping the urgent pill while on the `History` tab switches to `In Stock` and filters to urgent items.
- [x] All integration tests in `apps/mobile/tests/integration/pantry-filtering-and-pagination.test.tsx` pass cleanly.
- [x] Local Android Gradle build succeeds without compilation or lint errors.

## Validation Log

### Session 1 — 2026-09-07
**Trigger:** Post-plan validation interview (`/ak:plan validate`)
**Questions asked:** 3

#### Verification Results
- Claims checked: 15
- Verified: 15 | Failed: 0 | Unverified: 0
- Tier: Full (5 phases)
- Key verifications: `PantryFilterState` interface in `pantryFilterTypes.ts`, `filterAndSortRecords.ts` pipeline, `RecordList.tsx` section handling, `home.tsx` count pill markup, `PantryActiveFilterChips.tsx` chip builder, and `PantryFilterModal.tsx` modal state.

#### Questions & Answers

1. **[Visual Feedback]** Which icon or styling should indicate active filtering on the header pill?
   - Options: Funnel Filter Icon | Alert / Warning Icon | Background Color Only
   - **Answer:** Funnel Filter Icon (Recommended)
   - **Rationale:** Clear visual distinction between informational count state (inactive) and operational filter state (active), avoiding confusion with standard warning badges.

2. **[Live State Mutation]** How should urgent list items update when their expiry or status changes while filtering?
   - Options: Instant Removal | Keep with Faded State
   - **Answer:** Instant Removal (Recommended)
   - **Rationale:** Follows existing reactive queries in TanStack/SQLite; as soon as an item is marked used/discarded or its date is updated, the reactive active records list updates and drops the non-urgent item immediately.

3. **[Scope Switching]** When switching household scope (e.g. All -> Personal), how should the urgent filter behave?
   - Options: Reset on Scope Switch | Persist Across Scope Switch
   - **Answer:** Reset on Scope Switch (Recommended)
   - **Rationale:** Preserves consistency with existing `RecordList.tsx` scope-change effect which clears all active filters and search queries whenever `scope` or `householdId` changes.

#### Confirmed Decisions
- **Funnel Filter Icon**: When `isUrgentActive` is true, render `Ionicons` `funnel` icon (size 11) beside the count text on the Honey background.
- **Instant Removal**: Re-running reactive filtering automatically prunes modified/used items from the urgent view without artificial delay.
- **Scope Reset Synchronization**: When `RecordList` resets filters on household scope switch, also notify `HomeTab` via `onUrgentFilterChange(false)` to deactivate the header pill.

#### Action Items
- [x] Propagate funnel icon and scope reset handling to Phase 3.
- [x] Ensure Phase 2 documents instant removal upon reactive database mutation.

#### Whole-Plan Consistency Sweep
- Contradictions detected: 0
- Stale references found: 0
- Embedded code reconciliation: All code snippets in `plan.md` and phase files align with the Funnel icon, instant removal, and scope-reset behaviors.

## Red Team Review

### Session 1 — 2026-09-07
**Findings:** 3 (3 accepted, 0 rejected)
**Severity breakdown:** 0 Critical, 2 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Hidden Selected Items in Bulk Mutation During Filter Switch | High | Accept | Phase 2 / RecordList.tsx |
| 2 | Vanishing Header Pill Traps User When Last Urgent Item Cleared | High | Accept | Phase 3 / home.tsx |
| 3 | Stale Urgency Grouping on App Resume Across Midnight | Medium | Accept | Phase 3 / home.tsx |

#### Finding Details & Rationale

1. **Hidden Selected Items in Bulk Mutation [HIGH]**
   - **Reviewer:** Security Adversary / Data Integrity
   - **Location:** `apps/mobile/src/features/records/RecordList.tsx:156-161`
   - **Flaw:** Toggling `urgentFilterActive` or changing `filters` previously left `selectedIds` populated with hidden items.
   - **Fix Applied:** In `RecordList.tsx`, added an effect resetting `selectionMode(false)` and `selectedIds(new Set())` whenever `filters` or `urgentFilterActive` changes.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Selection mode reset on filter change -->`

2. **Vanishing Header Pill Traps User When Last Urgent Item Cleared [HIGH]**
   - **Reviewer:** Failure Mode Analyst
   - **Location:** `apps/mobile/app/(app)/(tabs)/home.tsx:37-41`
   - **Flaw:** When `totalUrgent` dropped to 0, the count pill unmounted, but `isUrgentActive` remained `true` in state.
   - **Fix Applied:** In `home.tsx`, added an effect resetting `setIsUrgentActive(false)` whenever `totalUrgent === 0 && isUrgentActive`.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Auto-reset urgent filter when totalUrgent reaches 0 -->`

3. **Stale Urgency Grouping on App Resume Across Midnight [MEDIUM]**
   - **Reviewer:** Assumption Destroyer / Freshness
   - **Location:** `apps/mobile/app/(app)/(tabs)/home.tsx:21-35`
   - **Flaw:** Grouping relied on `new Date()` at render time without an `AppState` listener refreshing dates when the app resumed from background across midnight.
   - **Fix Applied:** In `home.tsx`, added an `AppState` listener updating `dayTick` when transitioning to `active`, ensuring fresh date calculations across midnight.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Midnight rollover AppState listener -->`

### Whole-Plan Consistency Sweep
- Contradictions detected: 0
- Stale references found: 0
- Decision delta reconciled: Selection reset, zero-count auto-reset, and midnight AppState refresh are all reflected in code, integration tests, and plan files.

<!-- slug: mobile-pantry-urgent-item-interactive-filter -->
