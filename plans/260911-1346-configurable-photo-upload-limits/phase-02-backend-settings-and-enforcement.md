---
phase: 2
title: "Backend Settings, Upload Enforcement & Auto-Compression"
status: pending
priority: P1
effort: "4.5h"
dependencies: [1]
---

<!-- Updated: Validation Session 1 - Soft ceiling & WebP 0.70 step-down -->
<!-- Updated: Advisory Fix - Strict bounded [82, 72, 70] attempts, WebP source format, and terminal 413 overflow error -->
<!-- Updated: Advisory Fix 2 - Include revision upload enforcement in product-photos.ts:650-655 and reorder non-truncation -->
<!-- Updated: Advisory Fix 3 - Forward SQL migration widening product_photos and product_edit_photos position checks from <= 4 to <= 19 -->
<!-- Updated: Advisory Fix 4 - Preserve ProcessedVariant return contract (variant, buffer, info.width, info.height, bytes) in encodeVariant retry ladder -->
<!-- Updated: Validation Session 2 - Migration test:db:migrate & strict reorder set verification -->
<!-- Updated: Red Team Review - assertEditPhotoMutablePreCheck count check, db:migrate:deploy command, and settings in-memory caching -->

# Phase 2: Backend Settings, Upload Enforcement & Auto-Compression

## Overview

Implement backend settings persistence, administrative REST endpoints with audit logging, a public client endpoint for mobile consumption (protected by in-memory TTL caching), dynamic quota enforcement inside the photo upload pipeline (soft ceiling for new uploads across active products, private drafts, and revisions in `product-photos.ts`), and server-side Sharp image processing optimization in `apps/api`.

Crucially:
1. Add a forward SQL database migration widening PostgreSQL check constraints (`product_photos_position_check` and `product_edit_photos_position_check`) from `position <= 4` to `position <= 19`, deployed automatically via `pnpm --filter @expyrico/api db:migrate:deploy`.
2. Add WebP to accepted source formats (`SOURCE_FORMATS`) and MIME mappings in `product-image-processor.ts`.
3. Preserve the exact `ProcessedVariant` contract in `encodeVariant` with `.toBuffer({ resolveWithObject: true })`, deriving dimensions from Sharp's encoded `info.width`/`info.height` across bounded `[82, 72, 70]` retry attempts and failing closed with 413 if over 1 MB.
4. Enforce strict exact set verification during photo reordering, preventing ID tampering across products.
5. Add upload count pre-check to `assertEditPhotoMutablePreCheck` in `product-photos.ts:597-601` to reject uploads on full revisions before streaming multipart bytes.
6. Protect database connection pool with a 60-second in-memory cache on `getPhotoLimits()`, invalidated immediately on admin update.

## Requirements

### Functional Requirements
- Database Forward Migration (`api/prisma/migrations/20260911140000_widen_photo_position_checks/migration.sql`):
  - Drop legacy `product_photos_position_check` (which restricted `position <= 4`).
  - Add widened `product_photos_position_check` (`CHECK ("position" >= 0 AND "position" <= 19)`).
  - Drop legacy `product_edit_photos_position_check` (which restricted `position <= 4`).
  - Add widened `product_edit_photos_position_check` (`CHECK ("position" >= 0 AND "position" <= 19)`).
  - Deploy via `pnpm --filter @expyrico/api db:migrate:deploy` (runs `prisma migrate deploy` against dev/test databases).
- Store photo upload limits in PostgreSQL `settings` table using key `SETTING_KEYS.PHOTO_LIMITS = 'photo_limits'`.
- In-Memory Settings Cache: Cache `getPhotoLimits()` in memory with a 60-second TTL to prevent connection pool exhaustion from unauthenticated requests. Invalidate the cache immediately upon `PATCH /v1/admin/settings/photo-limits`.
- Provide safe fallback in `getSetting`: if no database row exists, return `{ maxProductPhotos: 5, maxPantryItemPhotos: 5 }`.
- Provide helper `getPhotoLimits()` returning typed `Promise<PhotoLimitsSettings>`.
- Expose Admin REST endpoints under `/v1/admin/settings/photo-limits`:
  - `GET /v1/admin/settings/photo-limits`: Returns current limits (requires admin authentication).
  - `PATCH /v1/admin/settings/photo-limits`: Validates and updates limits, invalidates in-memory settings cache, and records an audit log entry `settings.photo_limits.update` with `before` and `after` snapshots.
- Expose Client REST endpoint under `/v1/settings/photo-limits`:
  - `GET /v1/settings/photo-limits`: Returns current limits for mobile app consumption without requiring admin privileges, served directly from in-memory cache.
- Dynamic Upload Limit Enforcement (Pre-check & Transactional soft ceilings):
  - In `api/src/services/products/product-photos.ts`:
    - `assertPhotoMutablePreCheck` (line 114): Rejects direct product requests before reading multipart payload if `photos.length >= limits.maxProductPhotos`.
    - `assertEditPhotoMutablePreCheck` (line 597): Query `_count: { select: { photos: true } }` on the revision; reject requests before reading multipart payload if `edit._count.photos >= limits.maxProductPhotos`.
    - `addProductPhoto` (admin active branch, line 216): Enforces `currentCount >= limits.maxProductPhotos` inside locked transaction.
    - `addProductPhoto` (private draft branch, line 286): Enforces `currentCount >= limits.maxProductPhotos` inside locked transaction.
    - `addProductEditPhoto` (revision branch, line 651): Enforces `currentCount >= limits.maxProductPhotos` inside locked transaction.
  - Soft Ceiling Policy: Only blocks adding *new* photos. Existing items possessing more photos than a newly lowered ceiling remain intact, viewable, and editable.
- Reordering Security & Non-Truncation Contract:
  - `reorderProductPhotos` and `reorderProductEditPhotos` accept arrays up to 20 photo IDs (aligned with Phase 1 schema update).
  - **Strict Exact Set Verification**: The transaction atomically verifies that submitted `photoIds` match the exact set of photo IDs currently attached to that product/revision row. Any missing, extra, duplicate, or cross-product ID fails with a `400` error (`code: invalid_photo_order`).
  - If a product already has 6 photos and the admin lowers `maxProductPhotos` to 3, reordering all 6 existing photos succeeds without truncation or 409 rejection.
- WebP Source Input Support (`product-image-processor.ts`):
  - Expand `SOURCE_FORMATS`: Add `'webp'` to `['jpeg', 'png', 'heif', 'webp'] as const`.
  - Expand `FORMAT_TO_MIME`: Add `webp: 'image/webp'`.
  - Prevent 415 `unsupported_media_type` rejections on WebP uploads generated by browser canvas compression.
- Server-Side Auto-Resize & Bounded Compression Optimization (`encodeVariant`):
  - Update `api/src/config.ts` media defaults:
    - `MEDIA_DISPLAY_MAX_DIMENSION_PX`: `1920` (max 1920x1920 display variant).
    - `MEDIA_MAX_DISPLAY_BYTES`: `1 * 1024 * 1024` (1 MB maximum display variant size).
    - `MEDIA_WEBP_QUALITY`: `82`.
  - In `api/src/services/products/product-image-processor.ts`:
    - Preserve `ProcessedVariant` contract (`variant`, `buffer`, `width`, `height`, `bytes`).
    - Use `.toBuffer({ resolveWithObject: true })` on each retry attempt.
    - Derive output dimensions from encoded `info.width` and `info.height` (never source metadata).
    - Attempt encode using bounded quality ladder `[82, 72, 70]`.
    - If output exceeds 1 MB after quality 70, fail closed: throw `processingFailed(413, 'image_too_large', 'Compressed image variant exceeds the 1 MB ceiling after quality step-down')`.
- Update `api/prisma/seed-admin.ts` to include `photo_limits` in seed operations.

### Non-functional Requirements
- Database Integrity: PostgreSQL check constraints widened in lockstep with TypeScript schemas, guaranteeing zero schema-database drift.
- Resource Protection: Early count pre-checks on both direct products and revisions prevent reading large 10 MB payloads into quarantine when the item is already full.
- Reorder Atomicity & Isolation: Exact set verification prevents cross-product photo ID injection or partial reorders.
- Format Compatibility: Universal ingestion of JPEG, PNG, HEIF, and WebP, outputting uniform, optimized WebP display/thumb variants.
- Dimension Accuracy: Output dimensions in the database exactly match Sharp's downscaled variant bounds (`info.width`, `info.height`).
- Storage Integrity: Never store variants exceeding 1 MB under any condition.
- Auditability: Every admin modification is persisted in `AdminAuditLog` with actor ID, IP, and state diff.

## Architecture

```
[Client / Mobile App]               [Admin Dashboard]
        │                                   │
        ▼ (GET /v1/settings/photo-limits)   ▼ (PATCH /v1/admin/settings/photo-limits)
┌────────────────────────────────────────────────────────────────────────┐
│ Fastify API                                                            │
│                                                                        │
│  ├── /v1/settings/photo-limits (Served from 60s in-memory cache)       │
│  └── /v1/admin/settings/photo-limits (Admin Route)                     │
│        └── putSetting() -> DB upsert, Cache Invalidated, AdminAuditLog │
│                                                                        │
│  ├── Photo Upload Routes (Direct, Draft, Revision)                     │
│  │     ├── assertPhotoMutablePreCheck: check count vs dynamic limit    │
│  │     ├── assertEditPhotoMutablePreCheck: check count vs dynamic limit│
│  │     ├── addProductPhoto: locked check vs dynamic limit              │
│  │     └── addProductEditPhoto (line 651): locked check vs dynamic limit│
│  │                                                                     │
│  ├── PostgreSQL Database (Migration: 20260911140000)                   │
│  │     ├── product_photos_position_check: position <= 19               │
│  │     └── product_edit_photos_position_check: position <= 19          │
│  │                                                                     │
│  ├── Photo Reorder Routes (Strict Set Verification)                    │
│  │     ├── Verifies exact set match against product row                │
│  │     └── Accepts up to 20 IDs; never truncates existing photos       │
│  │                                                                     │
│  └── Sharp Image Processor (product-image-processor.ts)                │
│        ├── SOURCE_FORMATS includes WebP                                │
│        ├── encodeVariant with resolveWithObject: true                  │
│        ├── Real dimensions from info.width / info.height               │
│        ├── Bounded quality ladder: [82, 72, 70]                        │
│        └── Terminal 413 error if > 1 MB after Q:70                     │
└────────────────────────────────────────────────────────────────────────┘
```

## Related Code Files

- Create: `api/prisma/migrations/20260911140000_widen_photo_position_checks/migration.sql`
- Modify: `api/src/config.ts`
- Modify: `api/src/services/admin/settings.ts`
- Create: `api/src/routes/admin/settings/photo-limits.ts`
- Modify: `api/src/routes/admin/index.ts`
- Create: `api/src/routes/settings/photo-limits.ts`
- Modify: `api/src/server.ts`
- Modify: `api/src/services/products/product-image-processor.ts`
- Modify: `api/src/services/products/product-photos.ts`
- Modify: `api/prisma/seed-admin.ts`
- Create: `api/tests/integration/admin-photo-limits-settings.test.ts`
- Modify: `api/src/services/products/product-image-processor.test.ts`

## Implementation Steps

1. **Create Forward Migration (`api/prisma/migrations/20260911140000_widen_photo_position_checks/migration.sql`)**:
   ```sql
   -- Widen position checks on product_photos and product_edit_photos from <= 4 to <= 19
   -- to support platform-configurable photo upload limits up to 20 photos per item.

   ALTER TABLE "product_photos" DROP CONSTRAINT "product_photos_position_check";
   ALTER TABLE "product_photos"
     ADD CONSTRAINT "product_photos_position_check"
     CHECK ("position" >= 0 AND "position" <= 19);

   ALTER TABLE "product_edit_photos" DROP CONSTRAINT "product_edit_photos_position_check";
   ALTER TABLE "product_edit_photos"
     ADD CONSTRAINT "product_edit_photos_position_check"
     CHECK ("position" >= 0 AND "position" <= 19);
   ```

2. **Deploy Migration via Command Script**:
   - Execute deployment: `pnpm --filter @expyrico/api db:migrate:deploy`.

3. **Update Media Configuration (`api/src/config.ts`)**:
   - Update env schema defaults:
     ```ts
     MEDIA_MAX_DISPLAY_BYTES: z.coerce.number().int().positive().default(1 * 1024 * 1024), // 1 MB
     MEDIA_DISPLAY_MAX_DIMENSION_PX: z.coerce.number().int().positive().default(1920),     // 1920px
     MEDIA_WEBP_QUALITY: z.coerce.number().int().min(1).max(100).default(82),              // 82%
     ```

4. **Extend Settings Service with In-Memory Caching (`api/src/services/admin/settings.ts`)**:
   - Add `SETTING_KEYS.PHOTO_LIMITS = 'photo_limits'`.
   - Implement in-memory cache:
     ```ts
     let cachedPhotoLimits: { data: PhotoLimitsSettings; expiresAt: number } | null = null;

     export function invalidatePhotoLimitsCache(): void {
       cachedPhotoLimits = null;
     }

     export async function getPhotoLimits(): Promise<PhotoLimitsSettings> {
       const now = Date.now();
       if (cachedPhotoLimits && cachedPhotoLimits.expiresAt > now) {
         return cachedPhotoLimits.data;
       }
       const fresh = await getSetting(SETTING_KEYS.PHOTO_LIMITS, photoLimitsSettingsSchema);
       cachedPhotoLimits = { data: fresh, expiresAt: now + 60_000 }; // 60s TTL
       return fresh;
     }
     ```

5. **Support WebP Input in Image Processor (`api/src/services/products/product-image-processor.ts`)**:
   - Update `SOURCE_FORMATS` and `FORMAT_TO_MIME`:
     ```ts
     const SOURCE_FORMATS = ['jpeg', 'png', 'heif', 'webp'] as const;
     type SourceFormat = (typeof SOURCE_FORMATS)[number];

     const FORMAT_TO_MIME: Record<SourceFormat, string> = {
       jpeg: 'image/jpeg',
       png: 'image/png',
       heif: 'image/heic',
       webp: 'image/webp',
     };
     ```

6. **Bounded Quality Ladder & Preserved ProcessedVariant Contract (`api/src/services/products/product-image-processor.ts`)**:
   - Update `encodeVariant`:
     ```ts
     async function encodeVariant(
       pipeline: SharpInstance,
       variant: MediaVariant,
       maxDimensionPx: number,
       maxBytes: number,
       quality: number,
     ): Promise<ProcessedVariant> {
       const QUALITY_STEPS = [quality, 72, 70] as const;
       let lastResult: { data: Buffer; info: { width: number; height: number; size: number } } | null = null;

       for (const q of QUALITY_STEPS) {
         const { data, info } = await pipeline
           .clone()
           .resize(maxDimensionPx, maxDimensionPx, { fit: 'inside', withoutEnlargement: true })
           .webp({ quality: q })
           .toBuffer({ resolveWithObject: true });

         lastResult = { data, info };

         if (data.length <= maxBytes) {
           return {
             variant,
             buffer: data,
             width: info.width,
             height: info.height,
             bytes: data.length,
           };
         }
       }

       processingFailed(
         413,
         'image_too_large',
         `Generated ${variant} variant (${Math.round((lastResult?.data.length ?? 0) / 1024)} KB) exceeds the ${Math.round(maxBytes / 1024)} KB limit even at quality 70 floor`,
       );
     }
     ```

7. **Dynamic Upload & Revision Enforcement in `product-photos.ts`**:
   - In `assertPhotoMutablePreCheck` (line 114): Fetch `limits = await getPhotoLimits()`. If `photos.length >= limits.maxProductPhotos`, throw 409 `photo_limit_reached`.
   - In `assertEditPhotoMutablePreCheck` (line 597):
     ```ts
     export async function assertEditPhotoMutablePreCheck(actor: ProductActor, editId: string): Promise<void> {
       const edit = await getPrisma().productEdit.findUnique({
         where: { id: editId },
         select: { id: true, status: true, submittedBy: true, _count: { select: { photos: true } } },
       });
       if (!edit) notFound();
       checkEditPhotoMutablePolicy(actor, edit);
       const limits = await getPhotoLimits();
       if (edit._count.photos >= limits.maxProductPhotos) {
         throw new AppError({
           status: 409,
           code: 'photo_limit_reached',
           title: `A revision may have at most ${limits.maxProductPhotos} photos`,
         });
       }
     }
     ```
   - In `addProductPhoto` (both active and draft branches): Verify `currentCount < limits.maxProductPhotos`.
   - In `addProductEditPhoto` (line 651): Verify `currentCount < limits.maxProductPhotos` for revisions.
   - In `reorderProductPhotos` and `reorderProductEditPhotos`:
     - Perform strict exact set verification: Check that `new Set(input.photoIds).size === input.photoIds.length` AND that the set of IDs matches `existingPhotos.map(p => p.id)` exactly. Mismatch throws `400` code `invalid_photo_order`.
     - Allow reordering sets up to 20 without count-based rejection.

8. **Create Admin & Client Settings Routes**:
   - Admin route `GET`/`PATCH /v1/admin/settings/photo-limits`: Invalidate in-memory cache on patch, record audit log.
   - Client route `GET /v1/settings/photo-limits`: Serves cached settings.

9. **Integration & Processor Tests**:
   - Run `pnpm --filter @expyrico/api db:migrate:deploy` against test database.
   - Test 6-photo upload into PostgreSQL without constraint errors.
   - Test pre-check count rejection on both direct product and revision routes before streaming multipart data.
   - Test strict reorder rejection when submitting photo IDs from another product (ID tampering).
   - Test WebP upload acceptance without 415 error.
   - Test in-memory cache behavior on `GET /v1/settings/photo-limits` and cache invalidation on `PATCH`.
   - Test limit reduction (6 -> 3) with non-truncating reorder & delete.
   - Test Sharp image processor with real noisy image: verify bounded `[82, 72, 70]` ladder, exact `info.width`/`info.height` on `ProcessedVariant`, and fail-closed 413 error on uncompressible budget.

## Success Criteria

- [x] PostgreSQL migration `20260911140000_widen_photo_position_checks` applies cleanly via `db:migrate:deploy` and widens check constraints to `<= 19`.
- [x] Inserting a 6th photo (position 5) succeeds in PostgreSQL without database check constraint errors.
- [x] `assertEditPhotoMutablePreCheck` rejects uploads when revision is at capacity before streaming multipart data.
- [x] `GET /v1/settings/photo-limits` is served from in-memory cache and invalidates on update.
- [x] `GET /v1/admin/settings/photo-limits` returns current limits.
- [x] `PATCH /v1/admin/settings/photo-limits` updates limits and writes an audit log.
- [x] Photo upload rejects when `photos.length >= maxProductPhotos` on drafts, active products, and revisions.
- [x] Reordering validates exact ID sets and rejects cross-product ID tampering with 400.
- [x] Reordering existing photos (> limit) succeeds without truncation when limit is reduced.
- [x] WebP source files are accepted by `processProductUpload` without 415 errors.
- [x] `encodeVariant` strictly preserves `ProcessedVariant` contract (`variant`, `buffer`, `width: info.width`, `height: info.height`, `bytes: data.length`) with `.toBuffer({ resolveWithObject: true })`.
- [x] Quality ladder strictly follows `[82, 72, 70]` without breaching the 70 floor, failing closed with 413 if over budget.
- [x] Automated tests in `admin-photo-limits-settings.test.ts` and `product-image-processor.test.ts` pass.

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Migration locks table during check constraint update | Low | Low | `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` on check constraints takes a brief table lock that executes in milliseconds |
| Unauthenticated flood on settings endpoint | High | Low | In-memory 60s TTL cache serves repeated calls without touching PostgreSQL connection pool |
| Full revision flooded with large uploads | Medium | Low | `assertEditPhotoMutablePreCheck` count check rejects request before reading request stream |
| Cross-product ID tampering on reorder | High | Low | Strict exact set comparison against product row in locked transaction prevents unauthorized photo assignment |
| Lowering limit breaks reordering on existing items | High | Low | Reorder endpoints validate unique IDs matching existing rows, never checking count against `maxProductPhotos` |
