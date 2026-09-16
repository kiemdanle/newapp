---
phase: 3
title: "Verification, Edge Cases & Test Suite"
status: pending
priority: P1
effort: "1h"
dependencies: ["1", "2"]
---

# Phase 3: Verification, Edge Cases & Test Suite

<!-- Updated: Red Team Review Session 1 - Post-save composition reopen invariant, cold-cache offline check, and negative gating tests -->

## Overview

Validate that the new product photo inheritance UX operates correctly across unit tests, component integration tests, post-save multi-photo persistence, monorepo typecheck, and on the physical Android device.

## Requirements

### Test Matrix

| Scenario | Expected Behavior | Verification Method |
|---|---|---|
| Newly created product with photos (`isNewlyCreatedProduct: true`) | `add-record-inherited-product-photo` rendered via `ProductThumbnail`; empty `add-record-take-photo` and `add-record-choose-photo` buttons omitted | Unit test (`AddRecordForm.test.tsx`) |
| Resumed pending draft (`isNewlyCreatedProduct: false`) | Negative gating: inherited card omitted, standard capture buttons rendered | Unit test (`AddRecordForm.test.tsx`) |
| Appending custom photo to inherited product photo | Product photo pinned at slot 0 (`Product` tag); custom photo appended at slot 1 with remove button | Unit test (`AddRecordForm.test.tsx`) |
| Removing custom photo from multi-photo strip | Custom photo removed; view smoothly restores State A single product photo preview card without prompting to re-capture | Unit test (`AddRecordForm.test.tsx`) |
| Post-save multi-photo composition and reopen | Saving item with appended custom photo and reopening in `RecordDetail` preserves both custom photo at slot 0 (deletable) and product photo at slot 1 (non-deletable) | Unit test (`record-detail-product-photo.test.tsx`) |
| Cold-cache lifecycle & offline fallback | On cold cache (`uri: null`, `isLoading: true`), `ProductThumbnail` renders `product-thumbnail-skeleton` while loading and `product-thumbnail-fallback` on offline error without throwing or prompting redundant photo capture | Unit test (`ProductThumbnail.test.tsx`) |
| Manual item created without product | Standard `Item photos (optional)` with take/choose buttons rendered | Unit test (`AddRecordForm.test.tsx`) |
| Monorepo Typecheck | Zero TypeScript diagnostics across `@expyrico/mobile`, `@expyrico/shared`, `@expyrico/theme`, `api`, `admin` | `pnpm -r typecheck` |
| Live Android Device Verification | Physical MI 9 reflects inherited photo upon product submission with zero redundant photo prompt | Debug APK install & `adb` validation |

## Related Code Files

- Modify: `apps/mobile/src/components/ProductThumbnail.test.tsx`
- Modify: `apps/mobile/src/tests/AddRecordForm.test.tsx`
- Modify: `apps/mobile/tests/unit/record-detail-product-photo.test.tsx`
## Implementation Steps

1. **Add Unit Tests in `src/tests/AddRecordForm.test.tsx`**:
   - Test: `renders inherited product photo preview card via ProductThumbnail and omits redundant capture buttons when isNewlyCreatedProduct is true and photo exists`
   - Test: `negative gating: omits inherited photo preview and renders standard capture buttons when isNewlyCreatedProduct is false even if product has photos (e.g. resumed pending draft)`
   - Test: `appends custom photo into multi-photo strip alongside pinned product photo when add-different-photo is used`
   - Test: `retains take-photo and choose-photo buttons when no product photo exists`
   - Test: `removes custom photo from multi-photo strip and restores State A single preview card without re-prompting`
2. **Add Post-Save Composition Test in `tests/unit/record-detail-product-photo.test.tsx`**:
   - Test: `post-save composition: when record has both localPhotos and productId, gallery preserves custom photos first and appends catalog photo as non-deletable reference`
3. **Add Real Component Tests in `src/components/ProductThumbnail.test.tsx`**:
   - Test: `private draft product with photoId-only photo (using real ProductThumbnail wrapper) renders product-thumbnail-skeleton while loading, product-thumbnail-image on resolve, and product-thumbnail-fallback on error`
   - Test: `cold-cache lifecycle: renders product-thumbnail-skeleton when cache is cold (uri: null, isLoading: true) and product-thumbnail-fallback on network error without unhandled rejection`
   - Run `npx jest src/tests/AddRecordForm.test.tsx tests/unit/record-detail-product-photo.test.tsx tests/unit/photo-action-modals.test.tsx tests/unit/record-list-floating-controls.test.tsx tests/unit/item-image-gallery.test.tsx tests/unit/record-photo-upload.test.tsx tests/unit/record-detail-skeleton.test.tsx src/components/ProductThumbnail.test.tsx --silent`
5. **Execute Monorepo Typecheck**:
   - Run `pnpm -r typecheck` to verify all 5 workspace projects pass with 0 errors.
6. **Physical Device Build & Validation**:
   - Compile debug APK with local Gradle:
     `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
   - Install via `adb install -r`.
   - Exercise barcode scan -> create product with photo -> observe `AddRecordForm` pre-populated with the photo and no redundant photo buttons.

## Success Criteria

- [x] All automated unit tests in `AddRecordForm.test.tsx` pass.
- [x] Post-save multi-photo composition test in `record-detail-product-photo.test.tsx` passes.
- [x] `pnpm -r typecheck` passes with 0 errors.
- [x] Live device test confirms zero redundant photo prompts after creating a new product.
