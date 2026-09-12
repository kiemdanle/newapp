---
title: "Separate Community Product Contributions from Personal Product Templates"
date: 2026-09-12
summary: "Fixed community products automatically appearing in Product Templates by adding an explicit isTemplate intent flag, isolating community contributions to Community Contributions, and wiring template creation in mobile."
---

# Separate Community Product Contributions from Personal Product Templates

## What happened
Addressed user issue where adding a new product for the community (e.g. while in Pantry or Deals) was automatically adding that product to the user's personal Product Templates list. 

## Root Cause
When the contributor levels & product templates features were introduced, `isDismissedFromTemplates` on `Product` defaulted to `false` in the database schema. `createOrResumeDraft` created all new products with that default without checking creation intent. Because `listDrafts` (`GET /v1/products/drafts`) filters `where: { createdByUserId: actorId, isDismissedFromTemplates: false }`, every product a user ever added for the community automatically populated into their personal "Product templates" list.

## Changes Made
1. **`@expyrico/shared`:**
   - Added `isTemplate?: boolean` to `productDraftCreateRequestSchema` in `packages/shared/src/schemas/product.ts`.
   - Rebuilt shared package and synced to `apps/mobile/local-packages/@expyrico/shared/`.
2. **`api`:**
   - In `api/src/services/products/product-drafts.ts`:
     - Initialized `isDismissedFromTemplates: input.isTemplate === true ? false : true` on product creation.
     - When a product created earlier by the user (with `isDismissedFromTemplates: true`) is scanned or entered from the Product Templates page (`isTemplate === true`), automatically updated `isDismissedFromTemplates: false` to restore it to the user's templates list.
   - In `api/tests/integration/products-draft-lifecycle.test.ts`:
     - Added integration test suite `Template vs Community Product Separation` (3 tests verifying community products are excluded from templates, templates are included in templates, and community products can be restored to templates).
3. **`apps/mobile`:**
   - In `apps/mobile/app/(app)/product/drafts.tsx`:
     - Pushed `{ target: 'template' }` on scan and manual entry.
   - In `apps/mobile/app/(app)/scan.tsx`:
     - Forwarded `target: 'template'` to `ProductNewScreen`.
   - In `apps/mobile/app/(app)/product/new.tsx`:
     - Passed `isTemplate: target === 'template'` to `createOrResumeDraft.mutateAsync()`.
     - Returned to templates via `navigation.goBack()` upon template submission.
   - In `apps/mobile/src/features/products/ProductDraftForm.tsx`:
     - Styled Category `TextInput` with `styles.textInput` and dynamic `#FAFAF8` text color to fix dark theme contrast.

## Verification
- Vitest: 176/176 shared tests passed, 55/55 lifecycle tests passed, 8/8 contributions tests passed, 9/9 mobile form tests passed.
- TypeScript: 0 errors across `@expyrico/shared`, `api`, `admin`, and `mobile`.
- Built debug APK with local Gradle toolchain (`BUILD SUCCESSFUL in 28s`).
- Installed updated APK to connected Android device (`96d9c774`) via `adb install -r`.
