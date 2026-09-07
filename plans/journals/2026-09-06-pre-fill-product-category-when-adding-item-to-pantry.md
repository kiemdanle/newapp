---
title: Pre-fill product category when adding item to pantry
date: 2026-09-06
summary: Pre-fill category input in AddRecordForm when product has an existing category
---

# Pre-fill product category when adding item to pantry

Pre-fill category input in AddRecordForm when product has an existing category

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Requirement
When adding an item to the pantry (via product detail page or after submitting a product draft), if the product already has an assigned category, pre-fill that category into the product detail form (`AddRecordForm`).

## Implementation Details
1. **`AddRecordForm` (`apps/mobile/src/features/records/AddRecordForm.tsx`)**:
   - Added `initialCategory?: string | null` to `Props`.
   - Wired `useProduct(productId ?? undefined)` defensively.
   - Initialized `category` state with `initialCategory || product?.category || ''`.
   - Added a `useEffect` that synchronizes `category` when `initialCategory` or `product?.category` becomes available, guarded by `hasUserEditedCategoryRef` so that manual user input is never overwritten.
   - Reset `hasUserEditedCategoryRef` if `productId` changes.
2. **Callers Updated**:
   - `apps/mobile/app/(app)/product/[id].tsx`: Passed `initialCategory={data.category}` to `AddRecordForm`.
   - `apps/mobile/app/(app)/product/new.tsx`: Passed `initialCategory={submittedProduct.category}` and `initialCategory={product.category}`.
3. **Tests Added**:
   - `apps/mobile/src/tests/AddRecordForm.test.tsx`:
     - Test pre-filling category via `initialCategory` prop.
     - Test pre-filling category from `useProduct` hook.
     - Test persisting the pre-filled category on save.
     - Test user overriding pre-filled category and saving the modified value.

## Verification
- Unit test suite: `npm --prefix apps/mobile test -- apps/mobile/src/tests/AddRecordForm.test.tsx` (8/8 passed).
- Unit tests: `npm --prefix apps/mobile test -- apps/mobile/tests/unit/` (32 suites, 194 passed).
- TypeScript: `npm --prefix apps/mobile run typecheck` (0 errors).
