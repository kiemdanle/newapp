---
phase: 2
title: "Screen Integration & Undo Toast Handlers"
status: pending
priority: P1
effort: "1.5h"
dependencies: [1]
---

# Phase 2: Screen Integration & Undo Toast Handlers

<!-- Updated: Validation Session 1 - Undo Toast & Dual View Integration -->

## Overview
Integrate `DraftSwipeableRow` and `DraftGridCard` swipe actions into `ProductDraftsScreen` (`apps/mobile/app/(app)/product/drafts.tsx`). Implement optimistic deletion backed by a 5-second floating Undo toast banner (`DraftUndoToast`), plus seamless Edit and Add to Pantry actions.

## Requirements
- Functional:
  - List View: Replace inline `DraftRow` in `FlatList` with `DraftSwipeableRow`.
  - Grid View: Connect `onEdit`, `onAddToPantry`, and `onDelete` to `DraftGridCard`.
  - **Swipe Exclusivity**: Maintain an `activeSwipeableRef` in `ProductDraftsScreen`. When any row or drawer calls `onSwipeableWillOpen(ref)`, immediately close the previous active ref, ensuring at most one item is swiped open at a time.
  - **Edit Action**:
    - Invokes `openDraft(item)` to navigate to `ProductNew` draft editor.
  - **Add to Pantry Action**:
    - Sets `selectedPantryProduct(item)` to open `DraftPantryAddModal`.
  - **Delete Action with 5s Undo**:
    - Optimistically hides the draft from the displayed list immediately.
    - Displays a floating `DraftUndoToast` banner: *"Draft \"{name}\" discarded"* with an **Undo** button and 5-second auto-dismiss timer.
    - If user taps **Undo**: cancels the timer, restores the item to the list with no backend call.
    - If timer expires (or user dismisses): calls `discardDraftMutation.mutateAsync(item.id)` to permanently remove the draft from the database, then invalidates query caches.
    - If user navigates away: timer completes and triggers the backend deletion in the background.

## UI/UX & Feedback
- Floating `DraftUndoToast` at bottom of `ProductDraftsScreen`:
  - Dark elevated container `#2C2C28` with soft rounded pill design (`borderRadius: 24`).
  - White text with item name.
  - Accent Honey `#F5A623` "Undo" touchable text with bold weight.
  - Smooth slide-up entrance and fade-out animation.

## Related Code Files
- Create: `apps/mobile/src/features/products/DraftUndoToast.tsx`
- Modify: `apps/mobile/app/(app)/product/drafts.tsx`

## Implementation Steps
1. Create `DraftUndoToast.tsx` component managing the 5-second countdown, progress indicator, and Undo action.
2. In `drafts.tsx`:
   - State `pendingDiscardDraft: { item: ProductDraftRow; timer: NodeJS.Timeout } | null`.
   - Filter out `pendingDiscardDraft?.item.id` from displayed items in `items` memo.
   - `handleDelete(item)`:
     - Clear any existing pending discard timer and flush previous delete.
     - Set `pendingDiscardDraft` with a 5000ms timer.
     - On timer expiry: execute `discardDraft.mutateAsync(item.id)`.
   - `handleUndo()`:
     - Clear timeout.
     - Clear `pendingDiscardDraft`, instantly restoring the item in the list.
3. Pass handlers `onEdit`, `onAddToPantry`, `onDelete` to `renderItem` for both `DraftSwipeableRow` and `DraftGridCard`.

## Success Criteria
- [ ] Swiping left and tapping Edit in either view opens the draft editor.
- [ ] Swiping left and tapping Add in either view opens `DraftPantryAddModal`.
- [ ] Swiping left and tapping Delete immediately hides the item and presents the Undo banner.
- [ ] Tapping Undo cancels deletion and restores the card.
- [ ] Letting the timer expire permanently deletes the draft via API.
