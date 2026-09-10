---
phase: 6
title: "Fast-Add Product Templates & Swipe Actions"
status: pending
priority: P1
effort: "1.5h"
dependencies: [3]
---

# Phase 6: Fast-Add Product Templates & Swipe Actions

<!-- Updated: Validation Session 1 - Fast-Add Product Templates & Swipe Actions -->
<!-- Updated: Red Team Review Session 1 - Universal Add Named Record Contract & Cache Invalidation -->

## Overview

Update the "Product Drafts" screen to serve its true purpose as **"Product Templates"**—a personal quick-add restocking list for frequently purchased goods. Ensure **every single template** in this list supports slide-left **Edit**, **Add to Pantry**, and **Delete**, where deleting safely dismisses the item from the user's template list without harming public community catalog assets.

## Requirements

### Functional
1. **Screen Retitle & Focus**:
   - Title: **"Product Templates"** (subtitle: *"Quick-add templates for frequently purchased products"*).
   - In Profile: Labeled **"Product Templates"** under Community & Contributions.
2. **Universal 3-Action Slide-Left Menu**:
   - Swiping left on **any item** reveals:
     - **Edit** (Honey `#F5A623`, icon `create-outline`): Contextual edit navigation.
     - **Add to Pantry** (Fresh Sage `#4BAE8A`, icon `basket-outline`): Opens `DraftPantryAddModal` for 1-tap restocking with expiry and location options.
       - *Universal Add Contract*: For `active` or `pending` products, attaches `productId = item.id`. For private `draft` or `changes_required` items, saves as an independent named custom record (`customName = item.name`, `productId = null`), completely avoiding backend 403 `assertProductUse` rejections during offline synchronization.
     - **Delete** (Alert Red `#E0442A`, icon `trash-outline`): Removes the template from the user's list.
   - Set `canDelete = true` for all template rows!
   - Set `canAddToPantry = true` for all templates!
3. **Safe Deletion / Dismissal Handling**:
   - Tapping **Delete**:
     - Immediately hides the card from the list using `pendingDiscards`.
     - Shows the floating 5-second **Undo** toast banner.
     - If undone within 5 seconds: restores template to list.
     - Upon 5-second deadline expiration:
       - Dispatches `discardDraftMutation.mutateAsync(item.id)`.
       - On the backend, active catalog products are marked `isDismissedFromTemplates = true` (removed from template query, but preserved in community catalog).
       - Private unsubmitted drafts are hard-deleted.
       - Successful deletion invalidates `['me', 'contributions']` in addition to `['products', 'drafts']`, keeping profile level progress perfectly in sync.
   - Card face retains the inline `+ Add` button for 1-tap instant pantry addition.

## Related Code Files
- Modify: `apps/mobile/app/(app)/product/drafts.tsx`
- Modify: `apps/mobile/src/features/products/DraftSwipeableRow.tsx`
- Modify: `apps/mobile/src/features/products/DraftGridActionDrawer.tsx`
- Modify: `apps/mobile/src/features/products/DraftGridCard.tsx`
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Modify: `apps/mobile/__tests__/routes/product-drafts.test.tsx`

## Implementation Steps
1. Update `DraftSwipeableRow.tsx` and `DraftGridActionDrawer.tsx`:
   - Set `canDelete = true` by default so Delete button renders on all template rows.
   - Set `canAddToPantry = true` so Add button renders on all templates.
2. Update `drafts.tsx`:
   - Retitle screen header to "Product Templates" and subtitle to "Quick-add templates for frequently purchased products".
   - Connect deletion handler to backend discard/dismissal endpoint.
3. Update tests in `product-drafts.test.tsx`:
   - Verify Delete button appears and triggers removal on active, pending, and draft items.
   - Verify Add button appears and opens pantry add modal on all items.

## Success Criteria
- [ ] Swiping left on any template (including `Khẩu trang kenko 5D`, `Test 2`, `test draft`) reveals Edit, Add, and Delete buttons.
- [ ] Tapping Delete immediately hides the item with the 5-second Undo banner.
- [ ] Deleting an active template removes it from the template list without deleting the community catalog product.
- [ ] All unit and integration tests pass.
