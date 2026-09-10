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
<!-- Updated: Red Team Review Session 1 - Findings 1, 2, 3, 4, 5 Applied -->

## Overview
Integrate `DraftSwipeableRow` and `DraftGridCard` swipe actions into `ProductDraftsScreen` (`apps/mobile/app/(app)/product/drafts.tsx`). Implement optimistic deletion backed by a robust multi-draft queue (`pendingDiscardIds: Set<string>`), atomic commit transitions (`isCommitting`), rejection rollback, and contextual edit routing.

## Requirements
- Functional:
  - List View: Replace inline `DraftRow` in `FlatList` with `DraftSwipeableRow`.
  - Grid View: Connect `onEdit`, `onAddToPantry`, and `onDelete` to `DraftGridCard`.
  - **Swipe Exclusivity**: Maintain an `activeSwipeableRef` in `ProductDraftsScreen`. When any row or drawer calls `onSwipeableWillOpen(ref)`, immediately close the previous active ref, ensuring at most one item is swiped open at a time.
  - **Contextual Edit Action Routing (Red Team Finding 2)**:
    - If `item.status === 'active'`: navigate to `/product/${item.id}/edit` (community catalog revision flow).
    - If `item.status === 'pending'`: open `ProductActionModal(item)` (view details & inspection).
    - If `item.status === 'draft' || item.status === 'changes_required'`: open `ProductNew` draft editor (`openDraft(item)`).
  - **Add to Pantry Action (Red Team Finding 1)**:
    - Enabled strictly for `active` and `pending` products (`canAddDirectly`).
    - Sets `selectedPantryProduct(item)` to open `DraftPantryAddModal`.
  - **Multi-Draft Discard Queue & Atomic Commit (Red Team Findings 3, 4, 5)**:
    - State: `pendingDiscardIds: Set<string>` (for optimistic list filtering) + `activeUndoToast: { item: ProductDraftRow; timer: NodeJS.Timeout; isCommitting: boolean } | null`.
    - When an item is deleted:
      - Add `item.id` to `pendingDiscardIds`.
      - If another item was currently in the Undo window, immediately mark it as `isCommitting = true`, clear its timer, and dispatch its deletion promise in the background.
      - Start a new 5-second timer for the current item and show `DraftUndoToast`.
    - When **Undo** is pressed:
      - If `isCommitting === true`, ignore (atomic commit boundary passed).
      - Otherwise, clear timer, remove `item.id` from `pendingDiscardIds`, and dismiss toast (restoring item to list).
    - When timer expires (Commit boundary):
      - Set `isCommitting = true`.
      - Dismiss toast.
      - In `try...catch`, await `discardDraftMutation.mutateAsync(item.id)`.
      - On Success: remove `item.id` from `pendingDiscardIds`, invalidate query caches.
      - On Error (Failure Rollback): remove `item.id` from `pendingDiscardIds` (restores card), refetch query (`q.refetch()`), and display `Alert.alert('Discard Failed', error.message)`.

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
1. Create `DraftUndoToast.tsx` component with 5-second countdown and Undo trigger.
2. In `drafts.tsx`:
   - Implement `handleEditDraft(item: ProductDraftRow)` with status routing.
   - Implement `pendingDiscardIds` set filtering in `items` memo.
   - Implement `handleDeleteDraft(item: ProductDraftRow)` with multi-draft queue handling and error rollback.
   - Implement `activeSwipeableRef` mutual exclusivity tracking.
3. Pass handlers to `renderItem` for both `DraftSwipeableRow` and `DraftGridCard`.

## Success Criteria
- [ ] Swiping left and tapping Edit contextually routes by status.
- [ ] Swiping left and tapping Add opens `DraftPantryAddModal` for active/pending items.
- [ ] Swiping left and tapping Delete immediately hides the item in `pendingDiscardIds`.
- [ ] Rapid multiple deletions keep all deleting items hidden without resurrecting earlier ones.
- [ ] Tapping Undo cancels deletion and restores the draft.
- [ ] Deletion network failures cleanly roll back and restore the item with an error Alert.
