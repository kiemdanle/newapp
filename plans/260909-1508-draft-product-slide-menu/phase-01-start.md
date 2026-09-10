---
phase: 1
title: "Swipeable Draft Components"
status: pending
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Swipeable Draft Components

<!-- Updated: Validation Session 1 - Grid View & Status Guard Support -->
<!-- Updated: Red Team Review Session 1 - Status-Guarded Add to Pantry & Exclusivity -->

## Overview
Implement the gesture-driven swipeable components for both List and Grid views:
1. `DraftSwipeableRow.tsx` for List View (horizontal sliding buttons).
2. `DraftGridActionDrawer.tsx` + Swipeable integration in `DraftGridCard.tsx` for Grid View (overlay drawer with circular action buttons matching `PantryGridActionDrawer`).

## Requirements
- Functional:
  - Sliding an item left reveals **Edit**, **Add to Pantry**, and **Delete** actions.
  - **Delete Guard**: The **Delete** action is only rendered when `item.status === 'draft' || item.status === 'changes_required'`. For `active` or `pending` products, Delete is hidden.
  - **Add to Pantry Guard (Red Team Finding 1)**: The **Add to Pantry** action is only rendered when `item.status === 'active' || item.status === 'pending'`. For unsubmitted `draft` or `changes_required` items, Add to Pantry is hidden (must be submitted/approved before adding to pantry, matching `api/src/services/products/product-visibility.ts:159`).
  - **Swipe Exclusivity**: Supports `onSwipeableWillOpen` callback so the screen can auto-close any other opened swipe row/drawer.
  - Tapping **Edit** calls `onEdit(item)` and auto-closes the swipe row/drawer.
  - Tapping **Add to Pantry** calls `onAddToPantry(item)` and auto-closes the swipe row/drawer.
  - Tapping **Delete** calls `onDelete(item)` and auto-closes the swipe row/drawer.
  - Tapping anywhere outside the action buttons triggers standard card `onPress(item)`.
- UI/UX Styling (Expyrico Palette):
  - **Edit**: Honey `#F5A623` (`theme.colors.accent`), white `create-outline` icon.
  - **Add to Pantry**: Fresh Sage `#4BAE8A` (`theme.colors.primary`), white `basket-outline` icon.
  - **Delete**: Alert Red `#E0442A` (`theme.colors.danger`), white `trash-outline` icon.
  - Accessible touch targets: min 48px, bold text, descriptive accessibility labels and testIDs.

## Architecture
```typescript
export interface DraftSwipeableRowProps {
  item: ProductDraftRow;
  onPress: (item: ProductDraftRow) => void;
  onEdit: (item: ProductDraftRow) => void;
  onAddToPantry?: (item: ProductDraftRow) => void;
  onDelete?: (item: ProductDraftRow) => void;
  onSwipeableWillOpen?: () => void;
  isSubmitting?: boolean;
}

export interface DraftGridActionDrawerProps {
  item: ProductDraftRow;
  onEdit: (item: ProductDraftRow) => void;
  onAddToPantry?: (item: ProductDraftRow) => void;
  onDelete?: (item: ProductDraftRow) => void;
  onClose: () => void;
  canDelete?: boolean;
  canAddToPantry?: boolean;
}
```

## Related Code Files
- Create: `apps/mobile/src/features/products/DraftSwipeableRow.tsx`
- Create: `apps/mobile/src/features/products/DraftGridActionDrawer.tsx`
- Modify: `apps/mobile/src/features/products/DraftGridCard.tsx`

## Implementation Steps
1. Create `DraftSwipeableRow.tsx` wrapping the row in `Swipeable`:
   - Compute `canDelete = item.status === 'draft' || item.status === 'changes_required'`.
   - Compute `canAddToPantry = item.status === 'active' || item.status === 'pending'`.
   - Render `renderRightActions` with Edit, conditional Add to Pantry, and conditional Delete button.
   - Hook `onSwipeableWillOpen` to notify parent screen.
2. Create `DraftGridActionDrawer.tsx` patterned after `PantryGridActionDrawer.tsx`:
   - Header with draft name and close button (`Ionicons name="close"`).
   - Circular floating action buttons: Edit, Add to Pantry (conditional), Delete (conditional).
3. Update `DraftGridCard.tsx`:
   - Wrap grid card in `Swipeable` with `onLayout` tracking card width.
   - Reveal `DraftGridActionDrawer` upon swiping left.
   - Forward `onSwipeableWillOpen` callback.

## Success Criteria
- [ ] Both list rows and grid cards support slide-left swipe gesture.
- [ ] Actions Edit, Add to Pantry, and Delete render with correct Expyrico styling.
- [ ] Active and pending catalog items hide the Delete button.
- [ ] Unsubmitted draft items hide the Add to Pantry button.
- [ ] All action taps auto-close the drawer/row.
