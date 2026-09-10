---
title: "Slide Left Action Menu for Product Drafts"
description: "Implement slide-left swipe gesture on draft product items to reveal quick action menu: Edit, Delete, and Add to Pantry, matching the pantry view UX pattern across both List and Grid views."
status: pending
priority: P1
effort: "4h"
tags: [mobile, ui, gestures, drafts, pantry]
created: 2026-09-09
---

# Slide Left Action Menu for Product Drafts

## Overview
Replicate the pantry view's intuitive slide-left swipe interaction (`react-native-gesture-handler/Swipeable`) on the My Product Drafts page across both List View and 2-column Grid View. Swiping an item to the left smoothly reveals three distinct quick-action buttons:
1. **Edit** (Honey `#F5A623`): Navigates immediately to the draft editor.
2. **Add to Pantry** (Fresh Sage `#4BAE8A`): Opens the pantry add modal (`DraftPantryAddModal`) with expiry, quantity, and storage location options.
3. **Delete** (Alert Red `#E0442A`): Optimistically removes the draft with a 5-second Undo toast banner before executing backend permanent discard (`DELETE /v1/products/drafts/:id`). Available on `draft` and `changes_required` items.

## Architecture & Interaction Design

```
[ List View: SwipeableDraftRow ]
+-----------------------------------------------------------------------------------------+
| [Cover]  Product Name                     [Status Pill]  | [ Edit ] [ Add ] [ Delete ]  |
|          Updated 9 Sep 2026                              |  #F5A623 #4BAE8A  #E0442A    |
+-----------------------------------------------------------------------------------------+
                                <--- Slide Left Gesture ---

[ Grid View: SwipeableDraftGridCard + DraftGridActionDrawer ]
+---------------------+ <--- Slide Left Gesture ---
| [Cover]             | Reveals full-width Action Drawer overlay with
| Product Name        | circular floating action buttons:
| [Status]            | (Edit) (Add) (Delete) + Close button
+---------------------+ matching PantryGridActionDrawer pattern
```

- **Library**: `react-native-gesture-handler/Swipeable` (identical to `RecordCard.tsx` and `PantryGridCard.tsx`).
- **Gesture Behavior**:
  - `overshootRight={false}`: Prevents excessive bounce when swiping past the action width.
  - `friction={2}`: Natural physical drag feel matching the pantry screen.
  - Action buttons auto-close on press (`swipeableRef.current?.close()`).
- **Visual Design**: Strict adherence to the Expyrico color palette:
  - **Edit**: Honey `#F5A623` background with white `create-outline` icon and bold label.
  - **Add to Pantry**: Fresh Sage `#4BAE8A` background with white `basket-outline` icon and bold label.
  - **Delete**: Alert Red `#E0442A` background with white `trash-outline` icon and bold label.
- **Safety & Status Guard**:
  - Delete button is rendered only on items with status `draft` or `changes_required`.
  - Discard uses an instant optimistic removal with a 5-second Undo Toast banner. Tapping "Undo" restores the card; expiration executes the backend `DELETE /v1/products/drafts/:id` call.

## Phases

| # | Phase | Status | Summary |
|---|-------|--------|---------|
| 1 | [Phase 1: Swipeable Draft Components](./phase-01-start.md) | Pending | Extract and implement `DraftSwipeableRow.tsx` and `DraftGridActionDrawer.tsx` using `react-native-gesture-handler/Swipeable` with Expyrico styling and status-guarded action buttons. |
| 2 | [Phase 2: Screen Integration & Undo Toast Handlers](./phase-02-screen-integration.md) | Pending | Wire Edit, Add to Pantry, and instant Delete with 5-second Undo toast in `ProductDraftsScreen` for both list and grid view modes. |
| 3 | [Phase 3: Testing & Verification](./phase-03-testing-and-verification.md) | Pending | Add unit tests for swipe action triggers, undo toast flow, guarded delete buttons, and verify live gestures on Android device. |

## Success Criteria
- [ ] Swiping left on any product draft in List View smoothly reveals Edit, Add to Pantry, and Delete actions.
- [ ] Swiping left on any product draft in Grid View smoothly reveals `DraftGridActionDrawer` with action buttons.
- [ ] Tapping **Edit** navigates to `ProductNew` draft editor with correct barcode/qr/product ID params.
- [ ] Tapping **Add to Pantry** opens `DraftPantryAddModal` for that draft with pre-filled product details.
- [ ] Tapping **Delete** immediately hides the item, displays a 5-second Undo toast, and commits backend deletion upon toast expiration.
- [ ] Tapping **Undo** cancels the deletion and restores the draft immediately.
- [ ] Delete action is disabled/hidden for active catalog items to prevent 409 conflicts.
- [ ] Actions automatically close the swipeable row upon activation.

## Validation Log
<!-- Updated: Validation Session 1 - User Decisions -->
### User Interview Decisions
1. **Deletion Safety**: Selected **Instant Delete with Undo Toast**. Deletes immediately with an optimistic removal and a 5-second floating Undo toast banner allowing instant cancellation before committing to the server.
2. **Grid View Scope**: Selected **Both List View and Grid View**. Both views support sliding left to reveal actions. List View uses horizontal trailing buttons (`DraftSwipeableRow`), and Grid View uses an overlay action drawer (`DraftGridActionDrawer`) patterned after `PantryGridActionDrawer`.
3. **Status Action Guard**: Selected **Guard Delete by Status**. Delete is only exposed on `draft` and `changes_required` items where user deletion is permitted by catalog policy.
4. **Swipe Exclusivity**: Selected **Auto-Close Others (Recommended)**. Opening any swipe row or drawer automatically tracks the active Swipeable ref and closes any previously opened row, preventing multiple rows from being open simultaneously.
