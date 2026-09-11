---
title: "Configurable Photo Upload Limits & Auto-Compression for Products and Pantry Items"
description: "Enable administrators to configure maximum photo upload limits for new products and pantry items via the Admin Dashboard, apply a forward SQL database migration widening PostgreSQL position checks to 19, expand data schemas to support up to 20 photos without silent truncation, and implement automatic image resizing and compression (under 1MB, max 1920x1920, WebP with JPEG fallback, bounded 82/72/70 quality ladder with terminal error, strictly preserving ProcessedVariant encoded dimensions) across backend services, admin console, and mobile application."
status: completed
priority: P1
effort: "2.5d"
tags: ["admin", "settings", "media", "photos", "compression", "pantry", "products", "mobile", "migration"]
created: 2026-09-11
---

# Configurable Photo Upload Limits & Auto-Compression for Products and Pantry Items

## Overview

Currently, the maximum number of photos allowed for products and pantry items is hardcoded to `5` throughout the codebase. Furthermore, hidden 5-photo count constraints exist in multiple layers:
- PostgreSQL: Migration `20260726160100_expand_product_drafts_photos_and_moderation` enforces `CHECK ("position" >= 0 AND "position" <= 4)` on both `product_photos` and `product_edit_photos`.
- `@expyrico/shared`: `productPhotoSchema.position`, `productEditPhotoSchema.position`, and `adminProductEditPhotoSchema.position` cap positions at 4; `productDraftReorderRequestSchema`, `productEditPhotoReorderRequestSchema`, and `desiredPhotoOrder` cap reorder arrays at 5 entries.
- Mobile: `record-photo-storage.ts` silently truncates saved pantry photo arrays to 5, and `record/[id].tsx` hardcodes slot and modal checks to 5.
- API: `api/src/services/products/product-photos.ts` hardcodes `MAX_PHOTOS_PER_PRODUCT = 5` across direct photo uploads, draft uploads, and revisions (line 651), while `assertEditPhotoMutablePreCheck` omits count checks.
- In addition, raw user photos taken from modern multi-megapixel smartphone cameras and administrative uploads can reach 5 MB – 15 MB in size, consuming excessive server storage and mobile network bandwidth.

This plan addresses all of these limitations in a unified, production-grade implementation:
1. **Configurable Photo Limits & Expanded Schemas in `@expyrico/shared`**:
   - `photoLimitsSettingsSchema` defining `maxProductPhotos` and `maxPantryItemPhotos` (integers between 1 and 20, default 5).
   - Update `productPhotoSchema.position`, `productEditPhotoSchema.position`, and `adminProductEditPhotoSchema.position` (`min(0).max(19)`), and reorder/recovery schemas (`max(20)`) to natively support up to 20 photos per item.
   - Standard compression configuration: `maxDimensionPx: 1920`, `qualitySteps: [0.82, 0.72, 0.70]`, `maxFileBytes: 1048576` (1 MB).
2. **Database Migration & Backend Services in `apps/api`**:
   - Forward migration `20260911140000_widen_photo_position_checks/migration.sql`: Drops and recreates `product_photos_position_check` and `product_edit_photos_position_check` with `CHECK ("position" >= 0 AND "position" <= 19)`. Deployed via `db:migrate:deploy`.
   - Key `SETTING_KEYS.PHOTO_LIMITS = 'photo_limits'` backed by the existing `Setting` Prisma model, served from a 60-second in-memory cache.
   - Admin endpoints (`GET /v1/admin/settings/photo-limits`, `PATCH /v1/admin/settings/photo-limits`) with transactional audit logging (`settings.photo_limits.update`) and cache invalidation.
   - Public client endpoint (`GET /v1/settings/photo-limits`) for unprivileged mobile retrieval.
   - Dynamic upload enforcement in `product-photos.ts` (`assertPhotoMutablePreCheck`, `assertEditPhotoMutablePreCheck`, `addProductPhoto`, and `addProductEditPhoto` for revisions) operating as a soft ceiling on *new* uploads.
   - Non-truncating reorders: `reorderProductPhotos` and `reorderProductEditPhotos` accept up to 20 photos, enforce strict exact ID set verification (rejecting cross-product ID tampering with 400), and never truncate or fail existing items if a ceiling has been lowered.
   - WebP source input support in `product-image-processor.ts` (`SOURCE_FORMATS: ['jpeg', 'png', 'heif', 'webp']`, `FORMAT_TO_MIME: { webp: 'image/webp' }`) preventing 415 rejections.
   - Sharp auto-compression: Max 1920x1920, WebP, bounded quality ladder `[82, 72, 70]`, preserving exact `ProcessedVariant` contract (`variant`, `buffer`, `width: info.width`, `height: info.height`, `bytes`) with `.toBuffer({ resolveWithObject: true })`, and terminal 413 error if output exceeds 1 MB after quality 70.
3. **Admin Dashboard Settings & In-Browser Compression in `apps/admin`**:
   - Settings page `/settings/photo-limits` linked in sidebar navigation under "Settings".
   - Settings form with steppers, presets (Lean: 3/3, Default: 5/5, Expanded: 10/10), validation, and live feedback.
   - In-browser canvas auto-compression in `ProductPhotoManager` targeting WebP with JPEG fallback, bounded quality schedule `[0.82, 0.72, 0.70]`, failing closed with clear error if > 1 MB or on decode error.
   - Relaxed raw prefilter (up to 25 MB raw input) and updated `ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']` with dynamic `maxPhotos`.
   - Slot spinners indicating non-blocking background compression.
4. **Mobile App Dynamic Limits, Truncation Fixes & Auto-Compression in `apps/mobile`**:
   - `usePhotoLimits()` hook with React Query and AsyncStorage caching (`pantry.photoLimits.v1`), returning defaults immediately on fresh offline install.
   - Fix `record-photo-storage.ts`: Remove hardcoded `paths.slice(0, 5)` to support up to 20 photos without silent data loss.
   - Fix `AddRecordForm.tsx`: Clamp custom item product draft uploads to `Math.min(photos.length, maxProductPhotos)` to avoid 409 limit conflicts, and compute incremental slots to prevent selection array truncation.
   - Fix `record/[id].tsx`: Replace hardcoded 5 in `savePhotosToRecord` (line 220) and `handleAddPhoto` (line 263) with `maxPantryItemPhotos`. Ensure `handleSetCover` and `handleDeletePhoto` never slice or truncate remaining photos.
   - Route VisionCamera captures through native compression (`1920x1920`, quality 0.82).
   - Native picker compression in `photo-picker-adapter.ts` configured for max 1920x1920, multi-pass retry `[0.82, 0.72, 0.70]`, and terminal `PhotoTooLargeError` if > 1 MB.
   - Slot spinners in `AddRecordForm` and `ProductPhotoEditor` during background compression.
5. **Comprehensive Testing & Verification**:
   - Database migration verification on PostgreSQL via `db:migrate:deploy`: Verify insertion of 6th photo (position 5) and 20th photo (position 19) succeeds without check constraint violations.
   - Unit tests in `@expyrico/shared` for 20-photo schemas and compression constants.
   - API integration tests: Admin settings, audit logging, WebP upload acceptance, strict reorder set verification (400 on tampering), 6-photo save/reload/reorder, and limit reduction (6 -> 3) with non-truncating reorder & delete.
   - Real noisy image Sharp processor tests verifying bounded `[82, 72, 70]` step-down, exact `info.width`/`info.height` dimensions on `ProcessedVariant`, and terminal 413 error.
   - Admin unit tests: Server actions, form, canvas compressor step-down, and fail-closed error handling.
   - Mobile Jest tests: `usePhotoLimits` caching & fresh offline defaults, `record-photo-storage` 6+ photo persistence, pantry-to-draft upload clamping, `photo-picker-adapter` retry/rejection, `AddRecordForm`, `ProductPhotoEditor`, and record detail reorder non-truncation.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Define shared Zod schema and TypeScript types for `PhotoLimitsSettings` in `@expyrico/shared` | P1 |
| 2 | Expand shared schemas (`productPhotoSchema.position`, revision schemas max 19, reorder schemas max 20) | P1 |
| 3 | Create forward PostgreSQL migration `20260911140000_widen_photo_position_checks` widening checks to `<= 19` | P1 |
| 4 | Implement backend settings service with in-memory 60s cache, admin endpoints, and public client endpoint in `apps/api` | P1 |
| 5 | Replace hardcoded photo limits in `apps/api` upload services (direct, draft, revision) with dynamic soft ceiling | P1 |
| 6 | Support WebP input and bounded quality ladder `[82, 72, 70]` preserving `ProcessedVariant` contract in `product-image-processor.ts` | P1 |
| 7 | Build Admin Dashboard settings page (`/settings/photo-limits`), form, server actions, and sidebar navigation | P1 |
| 8 | Implement client-side canvas auto-compression (<1 MB, 1920x1920, WebP/JPEG, [0.82, 0.72, 0.70]) and 25MB raw prefilter in `ProductPhotoManager` | P1 |
| 9 | Implement `usePhotoLimits` hook with React Query, AsyncStorage caching, and fresh offline defaults in `apps/mobile` | P1 |
| 10 | Fix silent 5-photo truncation in mobile `record-photo-storage.ts` and update `record/[id].tsx` handlers | P1 |
| 11 | Clamp custom pantry item product draft uploads to `maxProductPhotos` and prevent selection array truncation in `AddRecordForm` | P1 |
| 12 | Route VisionCamera captures through native compression and configure mobile picker multi-pass retry in `photo-picker-adapter.ts` | P1 |
| 13 | Integrate dynamic photo limits into mobile `AddRecordForm` and `ProductPhotoEditor` with slot spinners | P1 |
| 14 | Validate PostgreSQL migration replay, 6-photo reorders, limit reduction without truncation, and full test suites | P1 |

## Architecture & Data Flow

```
[ Admin Dashboard: /settings/photo-limits ]
               │
               ▼ (savePhotoLimitsAction)
[ PATCH /v1/admin/settings/photo-limits ]
               │
               ├── Validates payload with photoLimitsSettingsSchema (1 - 20)
               ├── Upserts Setting(key="photo_limits", value={maxProductPhotos, maxPantryItemPhotos})
               └── Writes AdminAuditLog('settings.photo_limits.update')
               │
               ▼
[ Database: settings table ]
               ▲
               │
       ┌───────┴───────────────────────────────┐
       │                                       │
[ Fastify Upload Pipeline ]          [ GET /v1/settings/photo-limits ]
(api/src/services/products/                    │
       product-photos.ts)                      ▼
       │                             [ Mobile App: usePhotoLimits() ]
       ├── Pre-check photo count               │
       │   (assertPhotoMutablePreCheck         ├── AsyncStorage Cache (pantry.photoLimits.v1)
       │    & assertEditPhotoMutablePreCheck)  │   (Fresh install offline defaults: 5/5)
       ├── PostgreSQL DB (Migration)           │
       │   └── position_check <= 19            ├── record-photo-storage.ts
       ├── Sharp Image Processor               │   └── No 5-photo slice -> persists up to 20
       │   ├── SOURCE_FORMATS: +webp           │
       │   ├── Max 1920x1920 px                ├── Native Picker & VisionCamera Auto-Compression
       │   ├── Bounded ladder: [82, 72, 70]    │   (1920x1920, [0.82, 0.72, 0.70], <1MB)
       │   ├── ProcessedVariant contract       │
       │   │   (width/height from info)        ├── AddRecordForm (New Pantry Item)
       │   └── Terminal 413 if > 1 MB          │   ├── Slot spinner during background compression
       └── Transactional limit check           │   ├── Clamps draft upload: min(count, maxProductPhotos)
           (soft ceiling for new uploads)      │   └── Incremental slot selection (no truncation)
           (direct, draft, revision)           │
                                               ├── record/[id].tsx (Pantry Item Details)
                                               │   ├── Handlers use maxPantryItemPhotos
                                               │   └── Reorder & delete never truncate
                                               │
                                               └── ProductPhotoEditor (New Product Draft)
                                                   ├── Slot spinner during background compression
                                                   └── Clamps photos to maxProductPhotos

[ Admin Console: ProductPhotoManager ]
       │
       ├── ALLOWED_MIME_TYPES: jpeg, png, webp
       ├── Raw file prefilter: up to 25 MB
       ├── Slot spinner while compressImageForUpload executes in background
       ├── Canvas Auto-Compression (<1 MB, 1920x1920, WebP/JPEG, [0.82, 0.72, 0.70])
       └── Enforces maxPhotos on new uploads without truncating existing photo sets
```

## Phases

| # | Phase | File | Status | Description |
|---|-------|------|--------|-------------|
| 1 | Shared Schema & Capacity Contracts | [phase-01-start.md](./phase-01-start.md) | Pending | Define Zod schemas, defaults, compression constants, and expand position/reorder schemas across products, revisions, and recovery to 20 photos |
| 2 | Backend Settings, Migration & Enforcement | [phase-02-backend-settings-and-enforcement.md](./phase-02-backend-settings-and-enforcement.md) | Pending | PostgreSQL migration widening position checks to 19, settings service with 60s cache, upload enforcement (direct/draft/revision pre-checks), WebP input, and Sharp [82, 72, 70] ladder with ProcessedVariant contract |
| 3 | Admin Dashboard Settings UI | [phase-03-admin-dashboard-settings-ui.md](./phase-03-admin-dashboard-settings-ui.md) | Pending | Settings page, interactive form, actions, sidebar, WebP mime type, 25MB raw prefilter, slot spinners, and fail-closed canvas compression |
| 4 | Mobile App Photo Limits | [phase-04-mobile-app-photo-limits.md](./phase-04-mobile-app-photo-limits.md) | Pending | React Query hook, fresh offline defaults, record-photo-storage fix, record/[id] handlers, pantry-to-draft upload clamp, selection non-truncation, VisionCamera compression |
| 5 | Testing & Verification | [phase-05-testing-and-verification.md](./phase-05-testing-and-verification.md) | Pending | Migration replay via db:migrate:deploy, unit tests, API integration tests, 6-photo reorder, revision schemas verification, real noisy image tests, APK build |

## Success Criteria

- [ ] PostgreSQL migration `20260911140000_widen_photo_position_checks` replayed and verified against PostgreSQL via `db:migrate:deploy`.
- [ ] Direct insert of 6th photo (position 5) and 20th photo (position 19) verified on database for both products and revisions.
- [ ] Admin can navigate to `/settings/photo-limits` in the Admin Dashboard and view current limits.
- [ ] Admin can modify `maxProductPhotos` and `maxPantryItemPhotos` within range [1, 20] and receive instant validation feedback.
- [ ] Saving updates the settings in database and records an audit log entry with `before` and `after` diffs.
- [ ] `productPhotoSchema.position`, `productEditPhotoSchema.position`, and `adminProductEditPhotoSchema.position` accept values up to 19; reorder and recovery schemas accept up to 20 photo IDs.
- [ ] All uploaded images are automatically resized and compressed under 1 MB with max dimensions of 1920x1920 via bounded quality ladder `[82, 72, 70]` (failing closed with clear error if over budget).
- [ ] `encodeVariant` strictly preserves `ProcessedVariant` contract (`variant`, `buffer`, `width: info.width`, `height: info.height`, `bytes: data.length`) using `.toBuffer({ resolveWithObject: true })`.
- [ ] WebP source files are accepted by `processProductUpload` without 415 `unsupported_media_type` errors.
- [ ] In-browser canvas compression in Admin `ProductPhotoManager` compresses raw files up to 25 MB in background with slot spinners and fails closed on error.
- [ ] Mobile `record-photo-storage.ts` preserves more than 5 photos (up to 20) without silent truncation.
- [ ] Mobile `AddRecordForm` clamps custom pantry product draft uploads to `maxProductPhotos` without 409 errors, and selection array does not truncate prior photos when limits hydrate downward.
- [ ] Mobile `record/[id].tsx` handlers use `maxPantryItemPhotos` and never truncate remaining photos on reorder or delete when a limit is lowered.
- [ ] Mobile `photo-picker-adapter.ts` and `MultiPhotoCameraModal.tsx` resize photos to max 1920x1920 with multi-pass retry `[0.82, 0.72, 0.70]` and verify size under 1 MB.
- [ ] Backend photo upload route rejects product photo additions exceeding `maxProductPhotos` with status `409` code `photo_limit_reached` (pre-checks on direct and revision routes).
- [ ] Reordering validates exact ID sets, rejects cross-product tampering with 400, and succeeds without truncation when limits are reduced.
- [ ] Mobile app fetches photo limits from `GET /v1/settings/photo-limits`, uses defaults immediately on fresh offline launch, and falls back to local cache if offline.
- [ ] All automated test suites in `packages/shared`, `api`, `apps/admin`, and `apps/mobile` pass cleanly.

## Validation Log

### Session 1 — 2026-09-11
- **Compression Format**: Selected WebP with JPEG fallback. Admin canvas checks browser WebP support; fallback to JPEG. Server Sharp pipeline accepts WebP source inputs and outputs standard WebP display/thumb variants.
- **Limit Reduction Policy**: Soft ceiling for new uploads only. If an admin reduces limit from 6 to 3, existing items with 6 photos remain intact, viewable, and editable. Reordering or deleting existing photos never truncates the remaining photo set.
- **Size Bound Fallback**: Strict bounded 3-step quality schedule `[0.82, 0.72, 0.70]`. If a dense/noisy photo exceeds 1 MB at quality 0.82, compression steps down to 0.72 and 0.70 floor before failing closed with an explicit error (413 on API, user alert on admin/mobile).
- **ProcessedVariant Contract Preservation**: Preserved `ProcessedVariant` interface (`variant`, `buffer`, `width`, `height`, `bytes`), deriving dimensions from encoded `info.width` and `info.height` via `.toBuffer({ resolveWithObject: true })`.
- **Hidden Truncation Elimination**: Expanded `productPhotoSchema.position` max from 4 to 19, reorder schemas max from 5 to 20, removed `paths.slice(0, 5)` in mobile `record-photo-storage.ts`, and updated `record/[id].tsx` handlers.
- **Database Position Check Constraint Widening**: Added forward PostgreSQL migration `20260911140000_widen_photo_position_checks/migration.sql` widening `product_photos_position_check` and `product_edit_photos_position_check` from `<= 4` to `<= 19`.
- **Revision Route Enforcement**: Added dynamic limit check to `addProductEditPhoto` in `product-photos.ts:650-655`.

### Session 2 — 2026-09-11
- **Compression UX**: Background compression with slot spinners. On both mobile (`AddRecordForm`, `ProductPhotoEditor`) and admin (`ProductPhotoManager`), mounting immediate slot spinners while canvas/native compression runs asynchronously keeps the UI fluid at 60 FPS without freezing.
- **Migration Execution Strategy**: Automated deployment via `pnpm --filter @expyrico/api db:migrate:deploy` (`prisma migrate deploy`). Safe, idempotent, and non-interactive for both dev and CI environments.
- **Reorder Security**: Strict exact set verification. `reorderProductPhotos` and `reorderProductEditPhotos` verify that submitted `photoIds` match the product's attached photo IDs exactly. Cross-product ID tampering or missing IDs fail atomically with `400 invalid_photo_order`.
- **Offline Fresh Launch**: Instant startup with standard 5-photo defaults (`DEFAULT_PHOTO_LIMITS`). Fresh offline installs render item creation screens immediately without network error banners or blocking dialogs, seamlessly hydrating from the server once online.

## Red Team Review

### Finding 1: Schema Poison Pill & Moderation Queue DoS on Product Revisions (Critical)
- **Reviewer**: Security Adversary
- **Evidence**: `packages/shared/src/schemas/product-edits.ts:14`, `packages/shared/src/schemas/admin/products.ts:136,219`, `api/src/services/products/product-edits.ts:144`
- **Flaw**: While `productPhotoSchema` was widened, `productEditPhotoSchema.position` and `adminProductEditPhotoSchema.position` remained capped at `min(0).max(4)`, and `desiredPhotoOrder` remained capped at `.max(5)`. Submitting or approving a 6-photo revision caused `toProductEditRow` to crash with a 500 Zod error, breaking both the mobile revision screen and the admin moderation queue.
- **Status**: **Accepted**
- **Action**: Widened `productEditPhotoSchema.position` and `adminProductEditPhotoSchema.position` to `.min(0).max(19)`, and `desiredPhotoOrder` to `.max(20)` in Phase 1.

### Finding 2: Pantry Custom Item Upload Clashing with Product Photo Ceilings (High)
- **Reviewer**: Failure Mode Analyst
- **Evidence**: `apps/mobile/src/features/records/AddRecordForm.tsx:155-163`
- **Flaw**: When adding a custom pantry item with photos, `AddRecordForm` creates a product draft and loops over *all* attached pantry photos to upload them. If `maxPantryItemPhotos` (e.g. 8) > `maxProductPhotos` (e.g. 5), photo 6 failed with a 409 limit rejection.
- **Status**: **Accepted**
- **Action**: In `AddRecordForm`, upload only up to `Math.min(photos.length, maxProductPhotos)` to the product draft so catalog limits are respected, while the pantry record retains all attached photos locally up to `maxPantryItemPhotos`.

### Finding 3: Missing Upload Count Pre-Check on Revision Photo Route (High)
- **Reviewer**: Security Adversary
- **Evidence**: `api/src/services/products/product-photos.ts:597-601`, `api/src/routes/products/edit-photo-upload.ts:20-63`
- **Flaw**: `assertEditPhotoMutablePreCheck` did not query the revision's existing photo count. An attacker or client hitting a full revision streamed up to 10 MB to quarantine and consumed a Sharp decode worker before failing inside the database transaction.
- **Status**: **Accepted**
- **Action**: In `assertEditPhotoMutablePreCheck`, query `_count: { select: { photos: true } }` and throw 409 `photo_limit_reached` before accepting multipart body.

### Finding 4: Direct VisionCamera Captures Bypassing Picker Compression (High)
- **Reviewer**: Assumption Destroyer
- **Evidence**: `apps/mobile/src/components/MultiPhotoCameraModal.tsx:127-143`
- **Flaw**: `MultiPhotoCameraModal` captured photos directly via react-native-vision-camera, setting a fabricated `size: 500_000` without running them through image compression or scaling.
- **Status**: **Accepted**
- **Action**: Route captured camera photos through native image compression (`1920x1920`, quality 0.82) before storing or returning.

### Finding 5: Admin Raw File 5 MB Prefilter Blocks Large Photo Auto-Compression (Medium)
- **Reviewer**: Assumption Destroyer
- **Evidence**: `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx:31,110-113`
- **Flaw**: `ProductPhotoManager` rejected raw files over 5 MB (`const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024`). Admins dropping modern camera photos (e.g. 8 MB) were blocked before the client-side canvas compressor could compress them under 1 MB.
- **Status**: **Accepted**
- **Action**: Relaxed the raw input prefilter to 25 MB so `compressImageForUpload` can process high-resolution photos and compress them to < 1 MB before transmission.

### Finding 6: Slicing Combined Selection Array Truncates Prior User Photos on Downward Limit Hydration (Medium)
- **Reviewer**: Failure Mode Analyst
- **Evidence**: `apps/mobile/src/features/records/AddRecordForm.tsx:221,235`
- **Flaw**: Calling `[...prev, ...pickedList].slice(0, maxPantryItemPhotos)` truncated previously attached photos if limits hydrated downward while user was on the screen.
- **Status**: **Accepted**
- **Action**: Calculate incremental slots `availableSlots = Math.max(0, maxPantryItemPhotos - prev.length)` and append only up to `availableSlots`.

### Finding 7: Nonexistent Migration Command Name in Plan (Medium)
- **Reviewer**: Failure Mode Analyst
- **Evidence**: `api/package.json:21` (`"db:migrate:deploy": "prisma migrate deploy"`)
- **Flaw**: Plan referenced `test:db:migrate`, but `api/package.json` defines `db:migrate:deploy`.
- **Status**: **Accepted**
- **Action**: Updated plan across all phases to use `pnpm --filter @expyrico/api db:migrate:deploy`.

### Finding 8: Uncached Public Settings Endpoint Connection Starvation (Medium)
- **Reviewer**: Security Adversary
- **Evidence**: `api/src/services/admin/settings.ts:13-14`
- **Flaw**: `GET /v1/settings/photo-limits` executed an uncached `prisma.setting.findUnique` on every request.
- **Status**: **Accepted**
- **Action**: Added an in-memory 60-second cache in `settings.ts` for `getPhotoLimits()`, invalidated immediately on admin update.

### Whole-Plan Consistency Sweep
- Unresolved contradictions: 0
- Cross-phase alignment: Confirmed all 8 findings propagated across `phase-01` through `phase-05`, verified PostgreSQL check migration (0..19) via `db:migrate:deploy`, bounded ladder `[82, 72, 70]`, ProcessedVariant contract with encoded info dimensions, terminal fail-closed error, WebP source acceptance, non-truncation on reorder/delete, strict reorder set security, fresh install offline defaults, slot spinner UX, 25MB raw prefilter, and 20-photo schema support across all phase files.

<!-- slug: configurable-photo-upload-limits -->
