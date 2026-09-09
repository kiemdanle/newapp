---
phase: 3
title: "Fast Add To Pantry Flow and Form"
status: pending
priority: P1
effort: "2h"
dependencies: ["2"]
---

# Phase 3: Fast Add To Pantry Flow and Form

## Overview
Enable fast, single-tap pantry addition from the creator products list. Tapping an active or pending product row or pressing an inline "+ Add to pantry" button opens the Add to Pantry bottom sheet/modal with pre-filled product details, quick expiration date presets, and automatic scope enforcement.

## Requirements
- Functional:
  <!-- Updated: Validation Session 1 - ActionSheet on row tap and +3d, +1w, +1m, +3m date preset chips -->
  - Each `active` and `pending` row features a prominent inline **"+ Add"** button for immediate 1-tap pantry addition.
  <!-- Applied: Red Team Finding 1 - Debounce / multi-tap guard on + Add button -->
  - Debounce the "+ Add" press handler (300ms) and disable button during active mutation/modal presentation to prevent duplicate pantry record creation on rapid multi-taps.
  - Tapping an `active` or `pending` row surfaces an ActionSheet (iOS ActionSheetIOS / Android Alert action sheet):
    - **Add to Pantry**: Opens `AddRecordForm` pre-filled with the product details.
    - **View Product Details**: Navigates to `ProductNew` / detail view to inspect catalog metadata.
    - **Cancel**: Dismisses the action sheet.
  - When Add to Pantry is triggered for `active` products:
    - `productId`, `productName`, `initialCategory` pre-filled.
    - Scope allows user's personal or household scope.
  - When Add to Pantry is triggered for `pending` products:
    - `lockedPersonalScope: true` enforced (unreviewed products stay private).
  - Tapping a `draft` or `changes_required` row directly navigates to `ProductNew` editor to finish/adjust details.
  <!-- Applied: Red Team Finding 5 - Dual-layer lockedPersonalScope protection -->
  - When Add to Pantry is triggered for `pending` products, `lockedPersonalScope={selectedPantryProduct.status === 'pending'}` is explicitly passed to `AddRecordForm` to hide/disable household picker; backed by backend `assertProductUse(actorId, productId, { purpose: 'personal_record' })` which rejects household scope with 403.
  - Expiration date selector initializes with product shelf life (or +1 week fallback) and presents quick preset chips:
    - **+3d**, **+1w**, **+1m**, **+3m**, or wheel/calendar date picker.
  - On successful pantry addition:
    - Displays confirmation: "Added [Name] to your pantry."
    - Invalidates active pantry records query (`queryClient.invalidateQueries({ queryKey: ['records'] })`).
    - Closes sheet/modal and returns to the product list.
- Non-functional:
  - Fast response: dialog must open immediately (<100ms) with no blank screens.
  - Accessible: accessible button labels, hit targets >= 44dp.

## Architecture
1. **Pantry Add Sheet / Modal**:
   - `AddRecordModal` or integrated bottom sheet on `ProductDraftsScreen`.
   - Reuses existing `AddRecordForm` component (`apps/mobile/src/features/records/AddRecordForm.tsx`).
   - Accepts `targetProduct: ProductDraftRow | null`.
  <!-- Applied: Red Team Finding 2 - Form state reset on product change -->
  - Render `AddRecordForm` keyed by product ID (`key={selectedPantryProduct.id}`) so all inner form state (custom name, location, date, quantity) resets cleanly when switching between different products.
2. **Action Routing**:
   ```typescript
   function handleRowAction(item: ProductDraftRow) {
     if (item.status === 'active' || item.status === 'pending') {
       setSelectedPantryProduct(item);
     } else {
       openDraftEditor(item);
     }
   }
   ```
3. **Scope Security**:
   - Backend `assertProductUse` requires `purpose: 'personal_record'` when `status === 'pending'`.
   - Passing `lockedPersonalScope={item.status === 'pending'}` ensures client form disables household selection for pending items, matching backend invariants.

## Related Code Files
- Modify: `apps/mobile/app/(app)/product/drafts.tsx`
- Create or Modify: `apps/mobile/src/features/products/DraftPantryAddModal.tsx`
- Modify: `apps/mobile/src/features/records/AddRecordForm.tsx`
- Modify: `apps/mobile/__tests__/routes/product-drafts.test.tsx`

## Implementation Steps
1. In `apps/mobile/app/(app)/product/drafts.tsx`:
   - Add a `selectedPantryProduct` state for tracking the product being added to the pantry.
   - Add an inline `+ Add` button to `DraftRow` for active and pending rows.
   - Render `AddRecordModal` (or modal wrapper around `AddRecordForm`) when `selectedPantryProduct` is set.
2. Configure `AddRecordForm`:
   - Pass `productId={selectedPantryProduct.id}`.
   - Pass `productName={selectedPantryProduct.name}`.
   - Pass `lockedPersonalScope={selectedPantryProduct.status === 'pending'}`.
   - On save, invalidate pantry queries and show success feedback.
3. In `apps/mobile/__tests__/routes/product-drafts.test.tsx`:
   - Add test verifying tapping "+ Add" on an active row opens the add-to-pantry form.
   - Add test verifying pending product enforces locked personal scope.
   - Add test verifying draft rows still open the draft editor.

## Success Criteria
- [ ] Active and pending rows display an inline "+ Add" button.
- [ ] Tapping opens the Add to Pantry form pre-populated with the product's name.
- [ ] Pending products lock the scope to Personal Pantry.
- [ ] Saving adds the item to the database and invalidates the pantry records query.
- [ ] Draft and Changes Requested rows still navigate to `ProductNew` editor.

## Risk Assessment
- **Risk**: Adding a pending item with a household scope might fail at the backend API with a 403.
  - **Mitigation**: `lockedPersonalScope: true` is passed whenever `status === 'pending'`, completely disabling household selection in the UI.
