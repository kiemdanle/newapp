---
title: "Mobile Pantry Grid Card Swipe Action Drawer"
description: "Port the left-swipe quick action menu (+1, Edit, Delete) to the 2-column Grid View using an in-place full-surface action drawer with horizontal gesture detection, single-drawer mutual exclusivity, and SectionList scroll coordination."
status: completed
priority: P1
effort: "4h"
tags: ["mobile", "pantry", "grid-view", "gestures", "react-native", "ui", "ux"]
created: 2026-09-07
---

# Mobile Pantry Grid Card Swipe Action Drawer

## Overview

Currently, the single-column List View (`RecordCard.tsx`) supports a horizontal swipe-to-reveal action menu with three quick actions: **+1 Quantity**, **Edit**, and **Delete**. In the 2-column Grid View (`PantryGridCard.tsx`), swiping was initially a non-goal due to narrow card width physics ($\sim 160\text{ pt}$ on mobile screens).

This plan implements **Approach 2 (In-Place Full-Surface Action Drawer)** for the 2-column Grid View:
1. Swiping left on a grid card slides the front product card surface away, revealing a full-footprint **Action Drawer** beneath it containing standard $\ge 44\text{ pt}$ touch target buttons (`+1 Quantity`, `Edit`, `Delete`) and a dismiss header `[✕]`.
2. Gesture physics reuse proven Swipeable settings (or valid RNGH config `activeOffsetX: -20, failOffsetX: 20, failOffsetY: [-15, 15]`) so normal vertical scrolling is never hijacked or stalled.
3. **Single-drawer mutual exclusivity**: Only one grid card action drawer can be open across the entire pantry grid at any time. Opening another card or scrolling the `SectionList` automatically resets any open drawer back to its default front state.
4. Action callbacks (`onAddQuantity`, `onEdit`, `onDelete`) are wired from `RecordList.tsx` down into `PantryGridCard`.
5. Full accessibility support with screen reader announcements and selection mode guards (`selectionMode === true` disables gestures).

## Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RecordList.tsx                                                              │
│  ├── activeDrawerId: string | null                                          │
│  ├── onScrollBeginDrag -> setActiveDrawerId(null) (resets any open drawer)  │
│  ├── handleAddQuantity -> patchLocalRecord(id, quantity + 1)                │
│  ├── handleEdit -> setEditingRecord(record)                                 │
│  └── handleDelete -> deleteLocalRecord alert prompt                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ passes action props & isDrawerOpen
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PantryGridCard.tsx                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 1 (Underneath): Action Drawer (PantryGridActionDrawer)           │ │
│  │  ├── Dismiss Header: Product Title Truncated + [✕] Button              │ │
│  │  ├── ( ➕ ) +1 Quantity (Fresh Sage #4BAE8A, 48x48pt floating circle)  │ │
│  │  ├── ( ✏️ ) Edit Item (Honey #F5A623, 48x48pt floating circle)        │ │
│  │  └── ( 🗑️ ) Delete Item (Alert Red #E0442A, 48x48pt floating circle)   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Layer 2 (Top): Animated Front Card Surface                             │ │
│  │  ├── Top Row: [🔘 Checkbox/Spacer] ... [••• Button] [Qty/Status Pill]  │ │
│  │  ├── Dual Trigger: Swipe Left OR Tap [•••] (hidden in selection mode)  │ │
│  │  ├── failOffsetY: [-10, 10] (yields to vertical SectionList scroll)    │ │
│  │  └── translateX: 0 (default) -> -cardWidth (reveals action drawer)     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Create responsive `PantryGridActionDrawer` component with $\ge 44\text{ pt}$ action buttons and dismiss header | P1 |
| 2 | Integrate horizontal swipe-left gesture with threshold snap and spring animation into `PantryGridCard.tsx` | P1 |
| 3 | Wire `onAddQuantity`, `onEdit`, and `onDelete` callbacks from `RecordList.tsx` into both grid row slots | P1 |
| 4 | Coordinate mutual exclusivity and SectionList scroll reset (`activeDrawerId` state in `RecordList.tsx`) | P1 |
| 5 | Guard gestures when `selectionMode === true` and provide accessible VoiceOver/TalkBack actions | P1 |
| 6 | Automated unit & integration tests plus on-device physical verification on Xiaomi Mi 9 | P1 |

## Non-Goals

- Do not introduce horizontal swipe actions in the History audit tab (`PantryHistoryView.tsx`).
- Do not shrink or squeeze card content horizontally into a tiny 48pt right strip.
- Do not allow multiple card drawers to stay open simultaneously.
- Do not trigger delete without confirmation alert dialog.

## Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| 1 | [Action Drawer Layout & Styling](./phase-01-action-drawer-layout-and-styling.md) | Completed | Design `PantryGridActionDrawer` with Expyrico tokens, $\ge 44\text{ pt}$ touch targets, and dismiss header |
| 2 | [Swipe Gesture & State Machine](./phase-02-swipe-gesture-and-state-machine.md) | Completed | Implement horizontal swipe gesture, threshold snap, and Animated slide transition in `PantryGridCard.tsx` |
| 3 | [RecordList Callback Wiring](./phase-03-record-list-callback-wiring.md) | Completed | Pass `onAddQuantity`, `onEdit`, and `onDelete` handlers from `RecordList.tsx` to both chunked grid slots |
| 4 | [Scroll Coordination & Selection Guard](./phase-04-scroll-coordination-and-selection-guard.md) | Completed | Single active drawer coordination, SectionList scroll reset, and selection mode gesture disablement |
| 5 | [Integration Tests & On-Device Verification](./phase-05-integration-tests-and-on-device-verification.md) | Completed | Unit tests, gesture simulation tests, full Jest suite pass, local Gradle build, and ADB verification |

## Success Criteria

- [x] Swiping left or tapping the 3-dots (•••) button (positioned to the left of the qty pill) on any pantry grid card slides the front card away to reveal the action drawer.
- [x] Action drawer provides three floating circular icon buttons (+1, Edit, Delete) with micro-labels.
- [x] Tapping `+1` increments record quantity and snaps the card shut.
- [x] Tapping `Edit` opens `QuickEditModal` and snaps the card shut.
- [x] Tapping `Delete` prompts the confirmation alert dialog before deleting.
- [x] Tapping `[✕]` or tapping anywhere outside reverts the card back to the front state.
- [x] Opening another card drawer or scrolling the `SectionList` automatically closes any currently open drawer.
- [x] When `selectionMode === true`, swipe gestures are disabled.
- [x] Vertical scrolling in the SectionList is smooth without gesture lag or accidental horizontal triggers.
- [x] 100% test pass rate across Jest unit/integration suites and clean TypeScript typecheck.

## Validation Log

### Session 1 — 2026-09-07
**Trigger:** Post-plan validation interview (`/ak:plan validate`)
**Questions asked:** 3

#### Verification Results
- Claims checked: 15
- Verified: 15 | Failed: 0 | Unverified: 0
- Tier: Full (5 phases)
- Verified touchpoints: `PantryGridCard.tsx`, `RecordList.tsx`, `RecordCard.tsx`, `handleAddQuantity`, `handleEdit`, `handleDelete`, `react-native-gesture-handler`, `Animated`, `QuickEditModal`, `patchLocalRecord`, `deleteLocalRecord`, Expyrico color tokens.

#### Questions & Answers

1. **[Gesture & Trigger]** How should users trigger the In-Place Action Drawer on a grid card?
   - Options: Horizontal Swipe Left | Swipe Left + 3-Dots (•••) Button (Selected) | Corner Button Tap Only
   - **Answer:** Swipe Left + 3-Dots (•••) Button
   - **Rationale:** Dual affordance. Swiping left provides fast gesture flow for experienced users, while a clean 3-dots button in the card header guarantees zero discoverability hurdles for new users.

2. **[Dismiss Behavior]** When an action drawer is open, how should it be dismissed back to the front product card?
   - Options: Tap [✕], Tap Background, or Scroll (Selected) | Swipe Right or [✕] Only | 5-Second Inactivity Auto-Close
   - **Answer:** Tap [✕], Tap Background, or Scroll
   - **Rationale:** Multi-modal frictionless dismissal. Any natural intent (tapping [✕], tapping drawer background, executing an action, or scrolling the list) safely returns the card to front state.

3. **[Drawer Visual Layout]** How should the three actions (+1, Edit, Delete) be styled and arranged inside the action drawer?
   - Options: 3 Stacked Full-Width Buttons | Compact 2-Row Grid | 3 Floating Icon Circles (Selected)
   - **Answer:** 3 Floating Icon Circles
   - **Rationale:** Three large, tactile $48 \times 48\text{ pt}$ circular buttons centered vertically: `+1` (Fresh Sage `#4BAE8A`), `Edit` (Honey `#F5A623`), and `Delete` (Alert Red `#E0442A`) with micro-labels below each circle. Spacious, modern, and completely avoids text squishing on narrow card widths.

### Whole-Plan Consistency Sweep

## Red Team Review

### Session 1 — 2026-09-07
**Findings:** 10 (8 accepted, 2 deduplicated)
**Severity breakdown:** 3 Critical, 4 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `activeOffsetX: [-20, -1]` Invalid RNGH Config & Scroll Hijack | Critical | Accept | Phase 2 / plan.md |
| 2 | Front-Card Pressable Hit-Testing & 3-Dots Event Bubbling | Critical | Accept | Phase 2 |
| 3 | Household Delete Creator Permission Gate & Permanent 404 Destroy | Critical | Accept | Phase 3 |
| 4 | Under-Drawer PointerEvents & Accessibility Isolation | High | Accept | Phase 2 |
| 5 | Action Debounce & Stale Absolute Quantity Double-Tap Lock | High | Accept | Phase 3 |
| 6 | Selection Mode Drawer Reset & Action Freeze | High | Accept | Phase 4 |
| 7 | Top-Row De-Crowding & Idle 22pt Spacer Removal | High | Accept | Phase 2 |
| 8 | Deletion Confirmation Dialog Product Display Name | Medium | Accept | Phase 3 |

#### Finding Details & Rationale

1. **`activeOffsetX: [-20, -1]` Invalid RNGH Config & Scroll Hijack [CRITICAL]**
   - **Reviewer:** Failure Mode Analyst & Assumption Destroyer
   - **Location:** `phase-02-swipe-gesture-and-state-machine.md`
   - **Flaw:** RNGH array syntax requires `[negative, positive]`. Second element `-1` crashes in `__DEV__` and in release activates on any micro-jitter (`dx > -1`), stealing vertical list scroll and PTR.
   - **Fix Applied:** Reuse `Swipeable` from `react-native-gesture-handler` (proven in `RecordCard.tsx`), or use valid pan props `activeOffsetX={-20}`, `failOffsetX={20}`, `failOffsetY={[-15, 15]}`.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Valid RNGH gesture config & Swipeable reuse -->`

2. **Front-Card Pressable Hit-Testing & 3-Dots Event Bubbling [CRITICAL]**
   - **Reviewer:** Failure Mode Analyst & Assumption Destroyer
   - **Location:** `phase-02-swipe-gesture-and-state-machine.md`
   - **Flaw:** Front `Pressable` covers the layout box even when translated left by `-cardWidth`. Tapping open drawer buttons would fire front `onPress` and navigate to `Record`. Also tapping `•••` bubbled to parent `onPress`.
   - **Fix Applied:** Apply `pointerEvents={isDrawerOpen ? 'none' : 'auto'}` to front card, and isolate `•••` outside card `Pressable` with `e.stopPropagation()`.
   - **Marker:** `<!-- Updated: Red Team Session 1 - PointerEvents isolation & 3-dots touch separation -->`

3. **Household Delete Creator Permission Gate & Permanent 404 Destroy [CRITICAL]**
   - **Reviewer:** Security Adversary
   - **Location:** `phase-03-record-list-callback-wiring.md`
   - **Flaw:** Server `DELETE /records/:id` is creator-only (`findFirst({ id, userId })`). Non-owner delete returns 404, which client sync permanently destroys locally, leaving a phantom missing item.
   - **Fix Applied:** Only render/enable `Delete` if `record.userId === currentUser.id` (or personal item). Non-creators in a household see disabled or hidden Delete.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Household delete creator permission gate -->`

4. **Under-Drawer PointerEvents & Accessibility Isolation [HIGH]**
   - **Reviewer:** Security Adversary
   - **Location:** `phase-02-swipe-gesture-and-state-machine.md`
   - **Flaw:** Closed action drawer mounted underneath can receive accidental TalkBack focus or phantom touches.
   - **Fix Applied:** Apply `pointerEvents={isDrawerOpen ? 'auto' : 'none'}` and `accessibilityElementsHidden={!isDrawerOpen}` to the drawer container.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Under-drawer a11y & touch isolation -->`

5. **Action Debounce & Stale Absolute Quantity Double-Tap Lock [HIGH]**
   - **Reviewer:** Security Adversary & Failure Mode Analyst
   - **Location:** `phase-03-record-list-callback-wiring.md`
   - **Flaw:** Rapid double-taps on `+1` while spring closes read stale quantity closure and write `N+1` twice.
   - **Fix Applied:** Add `isProcessing` lock on action circles that disables buttons immediately upon first tap until animation settles.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Action debounce & in-flight mutation lock -->`

6. **Selection Mode Drawer Reset & Action Freeze [HIGH]**
   - **Reviewer:** Security Adversary & Failure Mode Analyst
   - **Location:** `phase-04-scroll-coordination-and-selection-guard.md`
   - **Flaw:** Entering selection mode did not close already-open drawers, allowing unselected items to be mutated or deleted.
   - **Fix Applied:** Calling `handleLongPress` or `selectionMode === true` immediately calls `setActiveDrawerId(null)` and sets `pointerEvents="none"`.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Selection mode drawer reset and action freeze -->`

7. **Top-Row De-Crowding & Idle 22pt Spacer Removal [HIGH]**
   - **Reviewer:** Assumption Destroyer
   - **Location:** `phase-02-swipe-gesture-and-state-machine.md`
   - **Flaw:** Permanent 22pt checkbox spacer + 3-dots button + unshrinkable status pill caused top-row collision on 320–360pt screens.
   - **Fix Applied:** Remove 22pt spacer when not in selection mode (`selectionMode ? <Checkbox /> : null`), and add `flexShrink: 1, numberOfLines={1}` on status pill.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Top-row de-crowding and idle spacer removal -->`

8. **Deletion Confirmation Dialog Product Display Name [MEDIUM]**
   - **Reviewer:** Security Adversary
   - **Location:** `phase-03-record-list-callback-wiring.md`
   - **Flaw:** Delete confirmation dialog fell back to `"this item"` if `customName` was null, creating ambiguity in 2-column grid.
   - **Fix Applied:** Use `displayName` (`record.customName || product?.name || 'this item'`) in the confirmation alert.
   - **Marker:** `<!-- Updated: Red Team Session 1 - Deletion confirmation display name -->`

### Whole-Plan Consistency Sweep
- Contradictions detected: 0
- Stale references found: 0
- Decision delta reconciled: Valid RNGH gesture config / Swipeable reuse, pointerEvents isolation, creator-only delete gate, double-tap lock, top-row de-crowding, and selection resets are fully aligned across all phase files.
- Contradictions detected: 0
- Stale references found: 0
- Decision delta reconciled: Dual trigger (swipe + 3-dots), frictionless dismissal (tap background/close/scroll), and 3 Floating Icon Circles layout are aligned across all phases.

<!-- slug: mobile-pantry-grid-swipe-action-drawer -->
