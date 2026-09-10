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
1. **Edit** (Honey `#F5A623`): Contextually navigates to draft editor (`ProductNew`), revision editor (`ProductEdit` for active catalog items), or detail view (for pending reviews).
2. **Add to Pantry** (Fresh Sage `#4BAE8A`): Available for `active` and `pending` products; opens `DraftPantryAddModal` with expiry, quantity, and storage location options.
3. **Delete** (Alert Red `#E0442A`): Optimistically removes the draft with a multi-draft in-flight set (`pendingDiscardIds`) and a 5-second Undo toast banner. Protected by atomic commit transitions and failure rollback. Available strictly on `draft` and `changes_required` items.

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
  - Mutual exclusivity: opening any swipe item auto-closes previous active swipeable.
- **Visual Design**: Strict adherence to the Expyrico color palette:
  - **Edit**: Honey `#F5A623` background with white `create-outline` icon and bold label.
  - **Add to Pantry**: Fresh Sage `#4BAE8A` background with white `basket-outline` icon and bold label.
  - **Delete**: Alert Red `#E0442A` background with white `trash-outline` icon and bold label.
- **Safety & Status Guard**:
  - Delete button is rendered only on items with status `draft` or `changes_required`.
  - Add to Pantry is rendered only on items with status `active` or `pending`.
  - Discard uses an instant optimistic removal backed by `pendingDiscardIds: Set<string>` and a 5-second Undo Toast banner. Tapping "Undo" restores the card; expiration executes backend `DELETE /v1/products/drafts/:id`.

## Phases

| # | Phase | Status | Summary |
|---|-------|--------|---------|
| 1 | [Phase 1: Swipeable Draft Components](./phase-01-start.md) | Pending | Extract and implement `DraftSwipeableRow.tsx` and `DraftGridActionDrawer.tsx` with Expyrico styling and status-guarded action buttons. |
| 2 | [Phase 2: Screen Integration & Undo Toast Handlers](./phase-02-screen-integration.md) | Pending | Wire Edit routing, Add to Pantry status guard, multi-draft discard queue, and atomic commit transition with failure rollback in `ProductDraftsScreen`. |
| 3 | [Phase 3: Testing & Verification](./phase-03-testing-and-verification.md) | Pending | Add unit tests for swipe actions, multi-draft discard queue, error rollback, and on-device validation. |

## Success Criteria
- [ ] Swiping left on any product draft in List View smoothly reveals Edit, Add to Pantry, and Delete actions.
- [ ] Swiping left on any product draft in Grid View smoothly reveals `DraftGridActionDrawer` with action buttons.
- [ ] Tapping **Edit** contextually navigates: active $\rightarrow$ `/product/:id/edit`, pending $\rightarrow$ view details, draft/changes $\rightarrow$ `ProductNew`.
- [ ] Tapping **Add to Pantry** (active/pending only) opens `DraftPantryAddModal` for that draft with pre-filled product details.
- [ ] Tapping **Delete** (draft/changes only) immediately hides the item via `pendingDiscardIds`, displays 5-second Undo toast, and commits backend deletion upon expiration.
- [ ] Tapping **Undo** cancels the deletion and restores the draft immediately.
- [ ] Multiple rapid deletions keep all deleting items hidden in `pendingDiscardIds` without resurrecting previous items.
- [ ] Server errors or status conflicts trigger rollback: item is restored to list and error alert is shown.
- [ ] Actions automatically close the swipeable row upon activation.

## Validation Log
<!-- Updated: Validation Session 1 - User Decisions -->
### User Interview Decisions
1. **Deletion Safety**: Selected **Instant Delete with Undo Toast**. Deletes immediately with an optimistic removal and a 5-second floating Undo toast banner allowing instant cancellation before committing to the server.
2. **Grid View Scope**: Selected **Both List View and Grid View**. Both views support sliding left to reveal actions. List View uses horizontal trailing buttons (`DraftSwipeableRow`), and Grid View uses an overlay action drawer (`DraftGridActionDrawer`) patterned after `PantryGridActionDrawer`.
3. **Status Action Guard**: Selected **Guard Delete by Status**. Delete is only exposed on `draft` and `changes_required` items where user deletion is permitted by catalog policy.
4. **Swipe Exclusivity**: Selected **Auto-Close Others (Recommended)**. Opening any swipe row or drawer automatically tracks the active Swipeable ref and closes any previously opened row, preventing multiple rows from being open simultaneously.

## Red Team Review
### Session — 2026-09-09
**Findings:** 5 (5 accepted, 0 rejected)
**Severity breakdown:** 0 Critical, 5 High, 0 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Add to Pantry guard by product status (active/pending only) | High | Accept | Phase 1, Phase 2 |
| 2 | Contextual Edit action routing (active vs pending vs draft) | High | Accept | Phase 2 |
| 3 | Multi-draft discard queue (`pendingDiscardIds: Set<string>`) | High | Accept | Phase 2 |
| 4 | Discard failure catch boundary and rollback reconciliation | High | Accept | Phase 2, Phase 3 |
| 5 | Atomic commit transition (`isCommitting`) to prevent late Undo | High | Accept | Phase 2 |

### Whole-Plan Consistency Sweep
- **Decision Delta**: Findings 1–5 applied across all phases.
- **Deadline Independence & Item-Addressed Undo Reconciled**: Discard queue preserves each item's independent 5-second deadline with item-addressed `undo(id)` controls in `DraftUndoToast` (verified by Phase 3 test: undoing A@t=4 restores A while B@t=1 remains pending and dispatches DELETE at t=6).
- **Contradictions Checked**: Status guards (Add to pantry vs Delete), routing paths, queue states, and failure rollbacks reconciled across all documents.
- **Unresolved Contradictions**: 0.