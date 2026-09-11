---
phase: 5
title: "Testing, Verification & Validation"
status: pending
priority: P1
effort: "4.5h"
dependencies: [1, 2, 3, 4]
---

<!-- Updated: Validation Session 1 - Verification & Whole-Plan Consistency Sweep -->
<!-- Updated: Advisory Fix - Real noisy image tests, 6-photo reorder, limit reduction without truncation, encoder failure -->
<!-- Updated: Advisory Fix 3 - Migration replay and PostgreSQL position check constraint verification (0..19) -->
<!-- Updated: Advisory Fix 4 - ProcessedVariant contract verification (variant, buffer, info.width/height, bytes) -->
<!-- Updated: Validation Session 2 - Verification for test:db:migrate and reorder ID tampering -->
<!-- Updated: Red Team Review - Verification test matrix for revision schemas, pantry-to-draft clamping, and prefilter relaxation -->

# Phase 5: Testing, Verification & Validation

## Overview

Execute multi-layer verification across all impacted packages: `@expyrico/shared`, `apps/api`, `apps/admin`, and `apps/mobile`. Verify that forward migration `20260911140000_widen_photo_position_checks` successfully updates PostgreSQL check constraints to `<= 19` via `db:migrate:deploy`, test that a 6-photo insertion into PostgreSQL passes without constraint errors on a migration-replayed database, verify that revision schemas (`productEditPhotoSchema`, `adminProductEditPhotoSchema`, `desiredPhotoOrder`) serialize 6+ photos without 500 errors, verify pantry-to-draft upload clamping in `AddRecordForm`, confirm that image auto-compression operates reliably with bounded quality ladder `[82, 72, 70]` and fails closed on overflow, test strict reorder ID set verification against cross-product tampering, and verify that `ProcessedVariant` strictly preserves its contract and records exact encoded `info.width`/`info.height` dimensions.

## Requirements

### Functional Requirements
- **Database Migration Verification (`apps/api`)**:
  - Replay migration `20260911140000_widen_photo_position_checks` via `pnpm --filter @expyrico/api db:migrate:deploy` against test database.
  - Verify PostgreSQL catalog constraint definitions:
    - `product_photos_position_check` definition matches `CHECK (position >= 0 AND position <= 19)`.
    - `product_edit_photos_position_check` definition matches `CHECK (position >= 0 AND position <= 19)`.
  - Verify that inserting a 6th photo (position 5) and 20th photo (position 19) succeeds without `23514 check_violation`.
  - Verify that inserting a 21st photo (position 20) or negative position is rejected by PostgreSQL check constraints.
- **Shared Layer Tests (`packages/shared`)**:
  - Verify `photoLimitsSettingsSchema` parses valid integers within `[1, 20]`.
  - Verify `productPhotoSchema.position`, `productEditPhotoSchema.position`, and `adminProductEditPhotoSchema.position` accept values up to 19 without schema validation errors.
  - Verify `productDraftReorderRequestSchema`, `productEditPhotoReorderRequestSchema`, and `desiredPhotoOrder` accept 6-photo and 20-photo arrays.
  - Verify exported `PHOTO_COMPRESSION_CONFIG` constants (`maxDimensionPx: 1920`, `qualitySteps: [0.82, 0.72, 0.70]`, `maxFileBytes: 1048576`).
- **Backend API Integration Tests (`apps/api`)**:
  - Test `GET /v1/admin/settings/photo-limits`: Requires admin authentication, returns current limits.
  - Test `PATCH /v1/admin/settings/photo-limits`: Updates limits, creates an `AdminAuditLog` record with `before` and `after` snapshots, and invalidates in-memory cache.
  - Test `GET /v1/settings/photo-limits`: Accessible to regular client requests and served from 60s in-memory cache.
  - Test photo upload pre-check enforcement:
    - On direct products: `assertPhotoMutablePreCheck` rejects requests before reading multipart payload if product is at capacity.
    - On revisions: `assertEditPhotoMutablePreCheck` rejects requests before reading multipart payload if revision is at capacity.
  - Test 6-Photo Save, Reload & Reorder: Create item with 6 photos under limit = 6; verify all 6 persist, serialize via `toProductEditRow`, and reorder correctly.
  - Test Strict Reorder Security: Submit reorder request with an extra, missing, duplicate, or cross-product photo ID; assert atomic rejection with `400 invalid_photo_order`.
  - Test Limit Reduction Without Truncation: Lower limit from 6 to 3. Verify:
    - Attempting to add a 7th photo is rejected with 409 (soft ceiling).
    - Reordering the existing 6 photos succeeds without truncation.
    - Deleting 1 photo leaves exactly 5 photos (no truncation to 3).
  - Test Real Noisy Images & Sharp Processor:
    - Generate a high-entropy noisy image via Sharp; verify `processProductUpload` executes bounded quality step-down `[82, 72, 70]`.
    - Verify that an impossible byte constraint (or uncompressible input) fails closed with 413 `image_too_large` at the 70 floor rather than returning an oversized file.
    - Test WebP input upload: Send a real WebP image buffer to `POST /v1/products/:id/photos`, verify it succeeds with 200/201 (no 415 error).
    - Verify `ProcessedVariant` contract: Output contains `variant: 'display' | 'thumb'`, `buffer`, `bytes`, and dimensions `width` and `height` derived from encoded `info.width` and `info.height`.
- **Admin Dashboard Unit Tests (`apps/admin`)**:
  - Test `savePhotoLimitsAction` calls `serverAdminApi.settings.photoLimits.patch` and triggers Next.js path revalidation.
  - Test `PhotoLimitsForm` rendering, interactive steppers, quick presets, and validation feedback.
  - Test `ProductPhotoManager`:
    - Admits files up to 25 MB raw without prefilter rejection.
    - Mounts slot spinners during background compression.
    - Runs `compressImageForUpload` and downscales large images to max 1920x1920 under 1 MB.
    - Fails closed on canvas decode error.
- **Mobile Application Unit Tests (`apps/mobile`)**:
  - Test `usePhotoLimits` hook: Retrieves settings, caches in AsyncStorage, and returns fresh offline defaults immediately.
  - Test `record-photo-storage.ts`: Save and retrieve 6, 8, and 12 photos; verify no truncation down to 5 occurs.
  - Test `photo-picker-adapter.ts`: Verify 1920 dimension, multi-pass retry `[0.82, 0.72, 0.70]`, and terminal `PhotoTooLargeError`.
  - Test `MultiPhotoCameraModal.tsx`: Verify captured photos pass through native compression.
  - Test `AddRecordForm`:
    - Configure `maxPantryItemPhotos = 8` and `maxProductPhotos = 5`. Attach 8 photos to a custom pantry item; verify all 8 persist locally while exactly 5 are uploaded to the product draft without 409 errors.
    - Selection non-truncation: Verify that downward limit hydration does not discard previously attached photos.
  - Test `ProductPhotoEditor`: Enforces `maxProductPhotos` limit on local queue, camera capture, and photo gallery picker.
  - Test Record Details (`record/[id].tsx`):
    - Verify lines 220 & 263 use `maxPantryItemPhotos`.
    - Verify reducing limit from 6 to 3 followed by reorder/delete preserves all remaining photos without truncation.
- **On-Device / Build Verification**:
  - Typecheck all packages: `pnpm check:types` or `tsc --noEmit`.
  - Verify Android debug build compiles cleanly:
    `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`

### Non-functional Requirements
- Deterministic test runs with no flaky timing dependencies or leftover database rows.
- Full compliance with Expyrico design tokens and accessibility contrast standards.

## Architecture

```
[ Automated Test Matrix ]
  ├── PostgreSQL Database
  │     └── Migration Replay (db:migrate:deploy): 20260911140000_widen_photo_position_checks
  │           └── 6-photo and 20-photo row insert (position 5 & 19) passes
  │
  ├── packages/shared
  │     └── Vitest: schemas/admin/settings.test.ts, product.test.ts, product-edits.test.ts
  │           ├── photoLimitsSettingsSchema & PHOTO_COMPRESSION_CONFIG
  │           ├── productPhotoSchema & reorder schemas (accepts up to 20 photos)
  │           └── productEditPhotoSchema & adminProductEditPhotoSchema (accepts up to 20 photos)
  │
  ├── apps/api
  │     └── Vitest Integration:
  │           ├── admin-photo-limits-settings.test.ts
  │           │     ├── Admin GET/PATCH + AuditLog
  │           │     ├── Pre-check count rejection on direct & revision routes
  │           │     ├── WebP upload input acceptance (no 415)
  │           │     ├── 6-photo save, reload & reorder on replayed database
  │           │     ├── Strict reorder set validation (cross-product ID tampering -> 400)
  │           │     ├── Limit reduction (6 -> 3) with non-truncating reorder & delete
  │           │     └── In-memory cache & invalidation on GET /v1/settings/photo-limits
  │           └── product-image-processor.test.ts
  │                 ├── Real noisy image step-down [82, 72, 70]
  │                 ├── Fail-closed 413 error on uncompressible inputs
  │                 └── ProcessedVariant contract: info.width and info.height
  │
  ├── apps/admin
  │     └── Vitest:
  │           ├── photo-limits-actions.test.ts
  │           ├── image-compression.test.ts (Canvas downscaling, [0.82, 0.72, 0.70], fail closed)
  │           └── product-photo-manager.test.ts (25MB raw prefilter, slot spinner)
  │
  └── apps/mobile
        └── Jest:
              ├── photo-limits-hook.test.ts (Fresh install offline defaults & caching)
              ├── record-photo-storage-multi.test.ts (6+ photos saved/loaded without truncation)
              ├── photo-picker-adapter.test.ts (Multi-pass [0.82, 0.72, 0.70] + PhotoTooLargeError)
              ├── AddRecordForm.test.tsx (Pantry-to-draft upload clamping & non-truncation)
              └── record-detail-reorder.test.tsx (Limit reduction reorder/delete non-truncation)
```

## Related Code Files

- Create: `api/prisma/migrations/20260911140000_widen_photo_position_checks/migration.sql`
- Modify: `packages/shared/src/schemas/admin/settings.test.ts`
- Modify: `packages/shared/src/schemas/product.test.ts`
- Modify: `packages/shared/src/schemas/product-edits.test.ts`
- Create: `api/tests/integration/admin-photo-limits-settings.test.ts`
- Modify: `api/src/services/products/product-image-processor.test.ts`
- Create: `apps/admin/tests/unit/photo-limits-actions.test.ts`
- Create: `apps/admin/tests/unit/image-compression.test.ts`
- Modify: `apps/admin/tests/unit/product-photo-manager.test.ts`
- Create: `apps/mobile/tests/unit/photo-limits-hook.test.ts`
- Create: `apps/mobile/tests/unit/record-photo-storage-multi.test.ts`
- Modify: `apps/mobile/src/features/products/photo-picker-adapter.test.ts`
- Modify: `apps/mobile/src/tests/AddRecordForm.test.tsx`
- Modify: `apps/mobile/src/features/products/ProductPhotoEditor.test.tsx`

## Implementation Steps

1. **Database Migration Replay & Verification**:
   - Apply `20260911140000_widen_photo_position_checks/migration.sql` against the test database via `pnpm --filter @expyrico/api db:migrate:deploy`.
   - Assert in integration tests that direct SQL / Prisma inserts of photos with `position = 5` (6th photo) and `position = 19` (20th photo) execute without check constraint errors on both `product_photos` and `product_edit_photos`.

2. **Shared Schema Vitest Suite**:
   - In `settings.test.ts`: Test `photoLimitsSettingsSchema` boundary values and `PHOTO_COMPRESSION_CONFIG`.
   - In `product.test.ts`: Verify `productDraftReorderRequestSchema` accepts 6 to 20 photo IDs and `productPhotoSchema.position` accepts up to 19.
   - In `product-edits.test.ts`: Verify `productEditPhotoSchema.position` accepts up to 19, and `productEditPhotoReorderRequestSchema` and `desiredPhotoOrder` accept up to 20 photo IDs.

3. **API Integration Suite (`admin-photo-limits-settings.test.ts`)**:
   - Test admin authentication guards.
   - Test updating limits via `PATCH /v1/admin/settings/photo-limits`.
   - Verify `AdminAuditLog` row insertion with correct diff.
   - Test public endpoint `GET /v1/settings/photo-limits`.
   - Test upload count pre-checks: Assert `assertPhotoMutablePreCheck` and `assertEditPhotoMutablePreCheck` reject uploads before reading multipart data if item is full.
   - Test WebP input upload: Send real WebP buffer, verify 200/201 without 415 error.
   - Test 6-photo save, reload, and reorder on replayed database: Verify all 6 photos persist, serialize via `toProductEditRow`, and reorder cleanly without database check constraint failure.
   - Test strict reorder set verification: Submit invalid / cross-product ID and assert 400 rejection.
   - Test limit reduction: Set limit to 6, save 6 photos, lower limit to 3:
     - Verify attempting to upload a 7th photo fails with 409.
     - Verify reordering the 6 photos succeeds and preserves all 6.
     - Verify deleting 1 photo leaves 5 photos without truncating down to 3.

4. **API Image Processor Tests (`product-image-processor.test.ts`)**:
   - Test real noisy image downscaling to 1920x1920.
   - Test that a noisy image steps down through `[82, 72, 70]` ladder.
   - Test that an uncompressible ceiling fails closed with 413 `image_too_large` at the 70 floor rather than returning an oversized file.
   - Test `ProcessedVariant` contract: Assert `encodeVariant` returns `{ variant, buffer, width, height, bytes }` where `width` and `height` match Sharp's downscaled dimensions (`info.width`, `info.height`).

5. **Admin Dashboard Test Suite**:
   - `apps/admin/tests/unit/photo-limits-actions.test.ts`: Test server action and revalidation.
   - `apps/admin/tests/unit/image-compression.test.ts`:
     - Test bounded quality ladder `[0.82, 0.72, 0.70]`.
     - Test terminal rejection when oversized at 0.70 floor.
     - Test fail-closed rejection on canvas context or decode failure.
   - `apps/admin/tests/unit/product-photo-manager.test.ts`: Test that 15 MB raw file is accepted by prefilter for canvas compression.

6. **Mobile Jest Test Suite**:
   - `apps/mobile/tests/unit/photo-limits-hook.test.ts`: Verify fresh install offline defaults, caching, and network fallback.
   - `apps/mobile/tests/unit/record-photo-storage-multi.test.ts`: Verify saving and loading 6+ photos without truncation.
   - `apps/mobile/src/features/products/photo-picker-adapter.test.ts`: Verify 1920 dimension, multi-pass retry, and 1 MB max size enforcement.
   - `apps/mobile/src/tests/AddRecordForm.test.tsx`:
     - Test that attaching 8 photos with `maxPantryItemPhotos=8` and `maxProductPhotos=5` uploads only 5 to the product draft while saving all 8 locally.
     - Test selection non-truncation: Verify that mid-form limit hydration downward does not truncate previously attached photos.
   - `apps/mobile/src/features/products/ProductPhotoEditor.test.tsx`: Test with explicit `maxPhotos={3}`.
   - Record detail tests: Test that lowering limit from 6 to 3 followed by reorder/delete preserves all remaining photos without truncation.

7. **Full Workspace Build & Verification**:
   - Run `pnpm test` across all workspaces.
   - Verify mobile Android build:
     ```bash
     cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
     ```

## Success Criteria

- [x] Forward migration `20260911140000_widen_photo_position_checks` replayed and verified against PostgreSQL via `db:migrate:deploy`.
- [x] Direct insert of 6th photo (position 5) and 20th photo (position 19) verified on database for both products and revisions.
- [x] Vitest tests in `@expyrico/shared` pass for 20-photo schemas across direct and revision contracts.
- [x] `assertEditPhotoMutablePreCheck` pre-checks photo count and rejects uploads on full revisions before reading multipart data.
- [x] `AddRecordForm` clamps custom pantry product draft uploads to `maxProductPhotos` without 409 errors when `maxPantryItemPhotos > maxProductPhotos`.
- [x] Selection array does not truncate prior photos when limits hydrate downward mid-form.
- [x] Integration tests in `apps/api` pass with 100% assertion success.
- [x] 6-photo save, reload, and reorder verified in API and mobile storage.
- [x] Cross-product reorder ID tampering rejected with 400 `invalid_photo_order`.
- [x] Lowering limit from 6 to 3 followed by reorder and delete verified to preserve all remaining photos without truncation.
- [x] WebP input is accepted by `processProductUpload` without 415 errors.
- [x] `ProcessedVariant` contract strictly preserves `variant`, `buffer`, `width: info.width`, `height: info.height`, and `bytes: data.length`.
- [x] Sharp processor and Canvas compressor strictly enforce bounded `[82, 72, 70]` ladder and fail closed with descriptive errors on overflow.
- [x] Unit tests in `apps/admin` and Jest tests in `apps/mobile` pass cleanly.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Test suite concurrency issues on shared setting row | Medium | Low | API integration tests isolate test settings or restore initial values in `afterEach` hook |
| Reorder test fails due to leftover DB constraint assumptions | Medium | Low | Migration explicitly widens constraints to `<= 19` and is tested directly against replayed test database |
| Pantry custom item uploads fail when pantry limit > product limit | High | Low | Explicit `photos.slice(0, maxProductPhotos)` guarantees draft creation never triggers a 409 conflict |
