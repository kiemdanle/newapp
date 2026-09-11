---
title: "Plan: Configurable Photo Upload Limits & Auto-Compression"
date: 2026-09-11
summary: Technical implementation plan for admin-configurable photo upload limits on products and pantry items, plus forward SQL migration widening PostgreSQL position checks to 19, auto-compression under 1MB (bounded 82/72/70 ladder with ProcessedVariant info dimensions contract), WebP input support, slot spinner UX, strict reorder set security, elimination of hidden 5-photo truncations, and 8 resolved Red Team adversarial findings
---

# Plan: Configurable Photo Upload Limits & Auto-Compression

Technical implementation plan for admin-configurable photo upload limits on products and pantry items, forward SQL database migration widening position checks to 19, end-to-end auto-compression under 1 MB at max 1920x1920 resolution (bounded 82/72/70 ladder), WebP source format support, preservation of Sharp `ProcessedVariant` contract (`info.width`/`info.height`), slot spinner UX during background compression, strict reorder set security, elimination of hidden 5-photo truncations across shared schemas and local storage, and full remediation of 8 adversarial Red Team review findings.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Objectives

Previously, photo upload limits across new products and pantry items were hardcoded to `5` across `@expyrico/shared`, API upload services, Admin Product Photo Manager, and React Native mobile screens. Furthermore:
1. PostgreSQL migration `20260726160100_expand_product_drafts_photos_and_moderation` enforced `CHECK ("position" >= 0 AND "position" <= 4)` on both `product_photos` and `product_edit_photos`, causing PostgreSQL to reject any 6th photo insertion with error 23514.
2. Hidden 5-photo truncations existed in shared schemas (`productPhotoSchema.position` max 4, `productEditPhotoSchema.position` max 4, reorder schemas max 5, `desiredPhotoOrder` max 5), local mobile storage (`record-photo-storage.ts` sliced arrays to 5), and record detail handlers (`record/[id].tsx`).
3. Raw photos from modern multi-megapixel smartphone cameras and admin desktop browsers could reach 10 MB+, consuming server disk capacity and mobile data.
4. Client-side WebP compression was unsupported on the server (`product-image-processor.ts` accepted only jpeg/png/heif, rejecting webp with 415).
5. Compression lacked a strict bounded quality schedule, fail-closed terminal error, and exact encoded output dimension tracking.

Platform administrators require:
1. Dynamic control over maximum photo upload limits for products and pantry items from the Admin Dashboard.
2. Full database, schema, and storage support for up to 20 photos per item without database check constraint violations or silent truncation across products, revisions, and recovery workflows.
3. Automated image resizing and compression ensuring all uploaded images are scaled to max 1920x1920, encoded via a bounded quality schedule `[82, 72, 70]`, preserving exact `ProcessedVariant` encoded dimensions, and kept strictly under 1 MB, failing closed if byte budgets cannot be met.
4. Non-truncating reorder and deletion operations if an admin subsequently reduces limits, with strict set verification against cross-product ID tampering.
5. Non-blocking UX with slot spinners during client-side compression and immediate offline launch defaults for fresh mobile installs.

## Key Architectural Decisions & Red Team Remediations

1. **Database Forward Migration (`apps/api`)**:
   - Migration `20260911140000_widen_photo_position_checks/migration.sql`: Drops and recreates `product_photos_position_check` and `product_edit_photos_position_check` with `CHECK ("position" >= 0 AND "position" <= 19)`. Deployed via `pnpm --filter @expyrico/api db:migrate:deploy`.
2. **Shared Contract & Schema Expansions (`@expyrico/shared`)**:
   - `photoLimitsSettingsSchema` validates `maxProductPhotos` and `maxPantryItemPhotos` in range `[1, 20]` (default 5).
   - Expanded `productPhotoSchema.position`, `productEditPhotoSchema.position`, and `adminProductEditPhotoSchema.position` max from 4 to 19.
   - Expanded `productDraftReorderRequestSchema`, `productEditPhotoReorderRequestSchema`, and `desiredPhotoOrder` max from 5 to 20.
   - `PHOTO_COMPRESSION_CONFIG` defines standard max dimension (1920px), bounded quality steps `[0.82, 0.72, 0.70]`, quality floor `0.70`, and byte ceiling `1,048,576` bytes (1 MB).
3. **Backend Storage, Dynamic Enforcement & Sharp Optimization (`apps/api`)**:
   - Stored in `settings` table with key `photo_limits`, protected by 60s in-memory cache.
   - Admin routes (`GET`/`PATCH /v1/admin/settings/photo-limits`) with transactional audit logging (`settings.photo_limits.update`) and instant cache invalidation.
   - Public client route (`GET /v1/settings/photo-limits`) for mobile apps.
   - Dynamic limit enforcement in `product-photos.ts`: `assertPhotoMutablePreCheck`, `assertEditPhotoMutablePreCheck` (early count pre-check on revisions), `addProductPhoto` (direct and draft), and `addProductEditPhoto` (revisions, line 651).
   - Non-truncation guarantee: Reordering up to 20 photos is permitted even if ceiling was lowered below current count.
   - Strict exact set verification on reorder: Cross-product ID tampering or missing IDs fail atomically with `400 invalid_photo_order`.
   - WebP source format acceptance in `product-image-processor.ts` (`SOURCE_FORMATS: ['jpeg', 'png', 'heif', 'webp']`, `FORMAT_TO_MIME: { webp: 'image/webp' }`).
   - Sharp processor enforcing max 1920x1920, WebP format, bounded ladder `[82, 72, 70]`, strict preservation of `ProcessedVariant` contract (`variant`, `buffer`, `width: info.width`, `height: info.height`, `bytes`) with `.toBuffer({ resolveWithObject: true })`, and terminal 413 error if output > 1 MB after quality 70.
4. **Admin Dashboard UI & In-Browser Canvas Compression (`apps/admin`)**:
   - New Settings page at `/settings/photo-limits` with steppers, presets (Lean: 3/3, Default: 5/5, High: 10/10), and Expyrico palette styling.
   - In-browser canvas compression in `ProductPhotoManager` resizing raw photos to max 1920x1920, WebP with JPEG fallback, bounded schedule `[0.82, 0.72, 0.70]`, failing closed with clear error if > 1 MB or on decode failure.
   - Relaxed raw prefilter (up to 25 MB raw input) and updated `ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']` with dynamic `maxPhotos`.
   - Slot spinners indicating non-blocking background compression on thumbnail cards.
5. **Offline-Resilient Mobile Hook, Truncation Fixes & Auto-Compression (`apps/mobile`)**:
   - `usePhotoLimits` hook backed by React Query and AsyncStorage (`pantry.photoLimits.v1`), returning defaults immediately on fresh offline install.
   - Elimination of silent truncation in `record-photo-storage.ts` (`saveRecordLocalPhotos` no longer slices to 5; persists up to 20).
   - Pantry-to-draft upload clamping in `AddRecordForm.tsx`: Uploads only `Math.min(photos.length, maxProductPhotos)` to avoid 409 conflict errors when pantry limit > product limit.
   - Selection non-truncation: Computes incremental slots so downward limit hydration does not discard previously attached photos.
   - Route VisionCamera captures through native compression (`1920x1920`, quality 0.82).
   - Updated `record/[id].tsx` handlers (lines 220 & 263) to use `maxPantryItemPhotos` and never truncate on reorder/delete.
   - Native image picker compression in `photo-picker-adapter.ts` with max 1920x1920, multi-pass quality ladder `[0.82, 0.72, 0.70]`, and terminal `PhotoTooLargeError` if > 1 MB.

## Plan Artifacts

- Plan Directory: `/Users/lekiemdan/newapp/plans/260911-1346-configurable-photo-upload-limits/`
- Phases:
  - `phase-01-start.md`: Shared Schema, Photo Limits & Capacity Contracts
  - `phase-02-backend-settings-and-enforcement.md`: Backend Settings, Upload Enforcement & Auto-Compression
  - `phase-03-admin-dashboard-settings-ui.md`: Admin Dashboard Settings UI & In-Browser Auto-Compression
  - `phase-04-mobile-app-photo-limits.md`: Mobile App Photo Limits & Client Auto-Compression
  - `phase-05-testing-and-verification.md`: Testing, Verification & Validation
