---
title: Fix Account Product Drafts Empty Listing and Cache Synchronization
date: 2026-09-08
summary: "Resolved bug where 'My product drafts' page remained permanently empty after adding or resuming product drafts due to missing React Query cache invalidation, lack of focus-based refetching, missing pull-to-refresh, and query key naming mismatches."
---

# Fix Account Product Drafts Empty Listing and Cache Synchronization

Resolved bug where 'My product drafts' page remained permanently empty after adding or resuming product drafts due to missing React Query cache invalidation, lack of focus-based refetching, missing pull-to-refresh, and query key naming mismatches.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Problem
When users added a product draft (via manual barcode/QR entry or camera scanner) or edited a draft and navigated to "My product drafts" on their account page (`apps/mobile/app/(app)/product/drafts.tsx`), the screen remained permanently blank showing "No drafts yet", and the Profile tab badge displayed 0 drafts.

## Root Cause
1. **Missing React Query Cache Invalidation**:
   - `useCreateOrResumeDraft`, `usePatchDraft`, and `useSubmitDraft` in `apps/mobile/src/api/products.ts` omitted `onSuccess` invalidation of `['products', 'drafts']`.
   - `createProductDraftCoordinatorAdapter` in `products.ts` and `DraftEditor.tsx` never invalidated the draft list queries when saving metadata or photos.
   - `createDraft`, `discardDraft`, and `handleSubmitted` in `NewProductScreen` (`new.tsx`) never invalidated draft queries.
2. **Missing Focus Refetching**:
   - React Navigation stack keeps previous screens mounted (`ProductDraftsScreen`, `ProfileScreen`). Because `refetchOnWindowFocus` is disabled on React Native and no `useFocusEffect` was hooked up, returning to the drafts screen or profile screen never triggered a refetch of cached data.
3. **Missing Pull-to-Refresh**:
   - `FlatList` in `ProductDraftsScreen` omitted `refreshing` and `onRefresh` props despite displaying an error message instructing users to "Pull down... to retry".
4. **Query Key Typo**:
   - `App.tsx` and `product/[id]/edit.tsx` invalidated `['product-drafts']` instead of the canonical `['products', 'drafts']`.
5. **False Read-Only Lock on Resumed Drafts**:
   - `handleManualCodeSubmit` passed `resume: resumed ? 'pending' : 'edit'`. An existing unsubmitted draft (`status === 'draft'`) with `resumed === true` was incorrectly locked to `'pending'` read-only mode instead of checking `product.status === 'pending'`.

## Changes Applied
1. **`apps/mobile/src/api/products.ts`**:
   - Added `onSuccess` hooks to `useCreateOrResumeDraft`, `usePatchDraft`, and `useSubmitDraft` to invalidate `['products', 'drafts']`, `['products', id]`, and `['products']`.
   - Updated `createProductDraftCoordinatorAdapter` to accept an optional `queryClient` and invalidate draft and product queries upon metadata patch, photo upload, photo delete, and photo reorder.
2. **`apps/mobile/src/features/products/DraftEditor.tsx`**:
   - Passed `queryClient` from `useQueryClient()` into `createProductDraftCoordinatorAdapter`.
3. **`apps/mobile/app/(app)/product/drafts.tsx`**:
   - Added `useFocusEffect` to automatically refetch drafts upon screen focus.
   - Added pull-to-refresh (`refreshing` and `onRefresh`) to `FlatList`.
   - Fixed `handleManualCodeSubmit` navigation parameter to `resume: product.status === 'pending' ? 'pending' : 'edit'`.
4. **`apps/mobile/app/(app)/(tabs)/profile.tsx`**:
   - Added `useFocusEffect` to refetch `draftsQuery` upon Profile tab focus, ensuring draft count badge updates immediately.
5. **`apps/mobile/app/(app)/product/new.tsx`**:
   - Added `queryClient.invalidateQueries({ queryKey: ['products', 'drafts'] })` upon draft creation, submission, and discard.
6. **`apps/mobile/src/App.tsx` & `apps/mobile/app/(app)/product/[id]/edit.tsx`**:
   - Fixed query key typo from `['product-drafts']` to `['products', 'drafts']`.
7. **`apps/mobile/src/api/__tests__/products-drafts-invalidation.test.tsx` & `apps/mobile/__tests__/routes/product-drafts.test.tsx`**:
   - Added comprehensive regression tests for mutation invalidations, pull-to-refresh, and draft/pending status navigation.

## Verification
- `apps/mobile`: 144 test suites passed, 911 tests passed with 0 failures (`pnpm test -- --forceExit`).
- `apps/mobile`: TypeScript compilation passed with 0 errors (`pnpm typecheck`).
- `api`: All product draft and approval policy integration tests passed (`pnpm test products-draft`, `pnpm test product-approval-policy`).
