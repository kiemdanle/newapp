---
phase: 3
title: "Mobile Scanner, Product Add & Drafts UX"
status: pending
priority: P1
effort: "1.5h"
dependencies: [2]
---

# Phase 3: Mobile Scanner, Product Add & Drafts UX

## Overview

Update all barcode scanner viewfinder text, escape hatches, product creation success prompts, draft row actions, and quick-add modals from "Pantry" to "Stash".

## Requirements

### Functional Requirements
- **Barcode Scanner Viewfinder (`scan.tsx`)**:
  - Eyebrow header updated from `'PANTRY SCAN'` to `'STASH SCAN'`.
  - Not found escape hatch button label: `'Add as Private Item for My Stash'` (was `'Add as Private Item for My Pantry'`).
  - Network unavailable escape hatch button label: `'Add to Stash Manually'` (was `'Add to Pantry Manually'`).
- **Product Creation & Submission (`product/new.tsx`)**:
  - Top bar title on submission step: `'Add to Stash'` (was `'Add to Pantry'`).
  - Catalogue published subtitle: `"Published to catalogue — you can add it to your stash now."`
  - Review notice: `"Your product is under review. You can add it to your personal stash now, or skip and add it anytime from My Product Drafts."`
  - Unlisted barcode notice: `"This barcode isn't in our catalogue yet... save it as a private item in your stash."`
- **Product Drafts & Quick-Add Modals (`features/products/`)**:
  - `ProductActionModal.tsx`:
    - Action title: `'Add to Stash'` with `FAST ADD` pill.
    - Accessibility label: `'Add to stash'`.
  - `DraftPantryAddModal.tsx`:
    - Sheet title: `'Add to Stash'`.
  - `DraftGridCard.tsx` & `DraftSwipeableRow.tsx`:
    - Action button text: `'Add to Stash'`.
    - Accessibility label: `'Add {item.name} to stash'`.
  - `DraftGridActionDrawer.tsx`:
    - Action label: `'Add to Stash'`.
- **Strict Exclusions**:
  - Food Category quick-select chips (`STANDARD_CATEGORIES`) in manual add forms MUST retain `'Pantry'` (`Produce`, `Dairy`, `Bakery`, `Meat & Seafood`, `Pantry`, `Frozen`, `Beverages`, `Snacks`, `Other`).

### Non-Functional Requirements
- Maintain UK English conventions (`catalogue`).
- Keep test identifiers intact or update them along with test specs (`testID="scan-add-custom-item"`, `testID="action-modal-add-btn"`).

## Architecture

```
Barcode Scanned
  │
  ├── Found ──> Product Details ──> "Add to Stash" (Fast Add)
  │
  ├── Not in Catalogue ──> "Add as Private Item for My Stash"
  │
  ├── Offline / Error ──> "Add to Stash Manually"
  │
  └── Product Submitted ──> "Published to catalogue — you can add it to your stash now."
```

## Related Code Files
<!-- Updated: Red Team Review Session - F5 unit test assertions -->

### Modify
- `apps/mobile/app/(app)/scan.tsx`
- `apps/mobile/app/(app)/product/new.tsx`
- `apps/mobile/src/features/products/ProductActionModal.tsx`
- `apps/mobile/src/features/products/DraftPantryAddModal.tsx`
- `apps/mobile/src/features/products/DraftGridCard.tsx`
- `apps/mobile/src/features/products/DraftSwipeableRow.tsx`
- `apps/mobile/src/features/products/DraftGridActionDrawer.tsx`
- `apps/mobile/__tests__/routes/scan.test.tsx`
- `apps/mobile/__tests__/routes/product-drafts.test.tsx`

## Implementation Steps

1. Edit `apps/mobile/app/(app)/scan.tsx`:
   - Replace `'PANTRY SCAN'` with `'STASH SCAN'`.
   - Update buttons `'Add as Private Item for My Pantry'` -> `'Add as Private Item for My Stash'`.
   - Update button `'Add to Pantry Manually'` -> `'Add to Stash Manually'`.
2. Edit `apps/mobile/app/(app)/product/new.tsx`:
   - Update top bar title to `'Add to Stash'`.
   - Update confirmation strings to replace `pantry` with `stash`.
3. Edit `apps/mobile/src/features/products/ProductActionModal.tsx`:
   - Update action title to `'Add to Stash'`.
   - Update accessibility label to `'Add to stash'`.
4. Edit `apps/mobile/src/features/products/DraftPantryAddModal.tsx`:
   - Update title to `'Add to Stash'`.
5. Edit `apps/mobile/src/features/products/DraftGridCard.tsx`, `DraftSwipeableRow.tsx`, and `DraftGridActionDrawer.tsx`:
   - Update button labels and accessibility labels to reference `stash`.
6. Update unit tests in `apps/mobile/__tests__/routes/scan.test.tsx` and `product-drafts.test.tsx`:
   - Update `scan.test.tsx:403,457` to assert `'Add to Stash Manually'`.
   - Update `product-drafts.test.tsx:228,595` to assert `'Add to Stash'`.

## Success Criteria

- [x] Viewfinder displays "STASH SCAN" eyebrow.
- [x] Scan escape hatches display "Add as Private Item for My Stash" and "Add to Stash Manually".
- [x] Product creation submission screen displays "Add to Stash".
- [x] Draft actions and modals display "Add to Stash".
- [x] Food category chip `'Pantry'` remains untouched.
- [x] All scanner and product draft unit tests pass.

## Risk Assessment

- **Risk**: Accidentally renaming the food category chip `Pantry` in category arrays.
- **Mitigation**: Double-check `STANDARD_CATEGORIES` and category chip mappings to ensure `'Pantry'` is untouched.
