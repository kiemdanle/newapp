---
phase: 2
title: "Screen Integration & Undo Toast Handlers"
status: completed
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
  - **Multi-Draft Discard Queue & Independent 5-Second Undo Deadlines**:
    - State: `pendingDiscards: Map<string, { item: ProductDraftRow; timer: NodeJS.Timeout; deadline: number; isCommitting: boolean }>`
    - Optimistic visibility filter: `items` memo filters out any `pendingDiscards.has(item.id)`.
    - When an item is deleted (e.g. A at t=0, B at t=1):
      - Each item receives its own independent 5000ms timer and deadline (`Date.now() + 5000`).
      - Deleting B does NOT cancel, shorten, or prematurely dispatch A's deletion. A's 5-second Undo window remains intact until t=5.
      - `DraftUndoToast` renders item-addressed rows for each pending discard currently within its 5-second window, displaying each item's name alongside an explicit, dedicated **Undo** button bound to `handleUndo(id)`.
    - **Item-Addressed Undo Operation (`handleUndo(id: string)`)**:
      - Retrieves `entry = pendingDiscards.get(id)`.
      - If `!entry` or `entry.isCommitting === true` (deadline passed), ignore.
      - Otherwise, clears that specific entry's timer, removes `id` from `pendingDiscards`, and immediately restores that item to the displayed list.
      - Any other pending discards (e.g. item B) remain in `pendingDiscards` with their independent timers running unperturbed.
    - When an item's timer expires (at its own t=5):
      - Atomically mark `entry.isCommitting = true`.
      - If no other active undoable entries remain, dismiss the toast.
      - In `try...catch`, dispatch `await discardDraftMutation.mutateAsync(entry.item.id)`.
      - On Success: remove from `pendingDiscards`, invalidate query caches.
      - On Error (Failure Rollback): remove from `pendingDiscards` (restores card to list), refetch query (`q.refetch()`), and display `Alert.alert('Discard Failed', error.message)`.
## UI/UX & Feedback
- Floating `DraftUndoToast` at bottom of `ProductDraftsScreen`:
  - Dark elevated container `#2C2C28` with soft rounded card/pill design (`borderRadius: 20`, padding: 12).
  - Item-addressed rows for each pending discard:
    - Left: White text with truncated draft name (`numberOfLines={1}`).
    - Right: Dedicated Accent Honey `#F5A623` "Undo" touchable button (`testID="draft-undo-btn-${item.id}"`) with bold weight.
  - Smooth slide-up entrance and individual row exit animations.
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
- [x] Swiping left and tapping Edit contextually routes by status.
- [x] Swiping left and tapping Add opens `DraftPantryAddModal` for active/pending items.
- [x] Swiping left and tapping Delete immediately hides the item in `pendingDiscardIds`.
- [x] Rapid multiple deletions keep all deleting items hidden without resurrecting earlier ones.
- [x] Tapping Undo cancels deletion and restores the draft.
- [x] Deletion network failures cleanly roll back and restore the item with an error Alert.
