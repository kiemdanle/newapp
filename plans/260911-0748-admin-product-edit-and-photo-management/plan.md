---
title: "Admin Product Management: Direct Edits and Photo Uploads"
description: "Enable administrators to perform comprehensive product catalog edits (name, brand, category, description, barcode, shelf life) and direct photo management (upload, set cover, reorder, delete) in the admin console."
status: pending
priority: P1
effort: "2d"
tags: ["admin", "products", "media", "catalog", "photos", "schema"]
created: 2026-09-11
---

# Admin Product Management: Direct Edits and Photo Uploads

## Overview

In the Expyrico Admin Dashboard (`apps/admin`), administrators require full editing capabilities over products in the catalog directory (`/products/[id]`). This includes editing core catalog attributes (**Name**, **Brand**, **Category**, **Description**, **Barcode**, **Default Shelf Life**) and managing product gallery photos (**uploading new photos via file picker / drag-and-drop**, **setting cover photo**, **reordering gallery positions**, and **deleting photos**). 

The backend Fastify API already has photo endpoints (`POST /v1/products/:id/photos`, `PATCH /v1/products/:id/photos/order`, `DELETE /v1/products/:id/photos/:photoId`) and product patch (`PATCH /v1/admin/products/:id`), but the schemas and admin frontend need key extensions:
1. `@expyrico/shared`: `adminProductPatchSchema` must be expanded to include `description` and `barcode`.
2. `api`: `adminProductsPatchRoute` must be updated to apply `description` and handle `barcode` uniqueness checks and prevent clearing an existing barcode.
3. `api` photo service: when an admin uploads a photo to an `active` catalog product, auto-approve and publish it immediately to public CDN storage.
4. `apps/admin`: `apiServerFetch` must support `FormData` multipart payloads, `serverAdminApi.products.photos` needs an `upload` method, `ProductActions` needs a comprehensive edit form with multi-line description, and `ProductPhotoManager` needs an intuitive upload dropzone, sequential upload queue, and "Set as Cover" action.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Extend `@expyrico/shared` `adminProductPatchSchema` to support `description` and `barcode` with clean validation | P1 |
| 2 | Update `api` `adminProductsPatchRoute` to persist `description` and `barcode` safely with uniqueness conflict checks and prevent clearing existing barcodes | P1 |
| 3 | Auto-approve and publish admin-uploaded photos on `active` products directly to public storage | P1 |
| 4 | Support `FormData` uploads in `apps/admin` server fetcher and expose `uploadProductPhotoAction` | P1 |
| 5 | Expand `ProductActions` in `apps/admin` with a full-featured edit form (Name, Brand, Category, Description, Barcode, Shelf Life) with optimistic concurrency protection | P1 |
| 6 | Expand `ProductPhotoManager` in `apps/admin` with Drag-and-Drop / File Picker photo uploads, sequential upload progress, and a 1-click "Set as Cover" action | P1 |
| 7 | Maintain 100% Expyrico design palette compliance and full test suite verification across shared, api, and admin | P1 |

## Architecture & Data Flow

```
[Admin Browser]
      │
      ├── 1. Edit Core Details (Name, Brand, Category, Description, Barcode, Shelf Life)
      │     └── Server Action: patchProductAction(id, version, fields)
      │           └── serverAdminApi.products.patch(id, version, fields)
      │                 └── PATCH /v1/admin/products/:id (Fastify)
      │                       ├── Check: barcode cannot be cleared if already set
      │                       ├── Check: barcode uniqueness against other products
      │                       └── Optimistic concurrency version check -> DB update -> AdminAuditLog
      │
      ├── 2. Upload Photos (File Picker / Drag & Drop with Sequential Queue)
      │     └── Server Action: uploadProductPhotoAction(productId, formData)
      │           └── serverAdminApi.products.photos.upload(productId, formData)
      │                 └── POST /v1/products/:productId/photos (Multipart Fastify)
      │                       └── Sharp webp -> Media storage -> DB productPhoto
      │                       └── If product is active: auto-approve & publish to public CDN immediately -> AdminAuditLog
      │
      ├── 3. Set as Cover (1-Click Action)
      │     └── Server Action: reorderProductPhotosAction(productId, [selectedId, ...remainingIds])
      │           └── PATCH /v1/products/:productId/photos/order
      │
      └── 4. Reorder / Delete Photos
            └── Server Actions: reorderProductPhotosAction / removeProductPhotoAction
                  └── PATCH /v1/products/:productId/photos/order / DELETE /v1/products/:productId/photos/:photoId
```

## Phases

| # | Phase | Status | Effort | Dependencies |
|---|-------|--------|--------|--------------|
| 1 | [Phase 1: Schema and API Contracts for Product Edits](./phase-01-start.md) | Pending | 3h | [] |
| 2 | [Phase 2: Admin API Client & Upload Foundation](./phase-02-admin-api-client-upload-foundation.md) | Pending | 2h | [Phase 1] |
| 3 | [Phase 3: Product Core Details Edit Form](./phase-03-product-core-details-edit-form.md) | Pending | 3h | [Phase 1, Phase 2] |
| 4 | [Phase 4: Photo Upload & Cover Management](./phase-04-photo-upload-cover-management.md) | Pending | 4h | [Phase 2] |
| 5 | [Phase 5: Integration Verification & Testing](./phase-05-integration-verification-testing.md) | Pending | 2h | [Phase 3, Phase 4] |

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Barcode duplicate conflict when admin enters existing barcode | API crash or 500 error | Pre-check barcode uniqueness or catch Prisma `P2002` and map to typed 409 `conflict` error |
| Accidental removal of existing barcode | Data degradation | Disallow clearing barcode once set; require non-empty barcode on update |
| Large multipart uploads in Next.js Server Actions | Timeout or payload limit | Enforce 5MB client-side validation; Fastify already enforces `MEDIA_MAX_UPLOAD_BYTES` |
| Fastify multipart header conflict with `application/json` default | Upload fails on API | Update `apiServerFetch` to detect `FormData` and omit manual `content-type` header |
| Version conflicts during concurrent edits | Lost updates | Retain existing optimistic concurrency guard (`version: input.version`) with `RefreshCw` retry button |

## Success Criteria

- [ ] Admin can edit `name`, `brand`, `category`, `description`, `barcode`, and `defaultShelfLifeDays` from `/products/[id]` and changes persist in PostgreSQL.
- [ ] Barcodes cannot be cleared to empty/null if already set on the product.
- [ ] Admin can upload photos sequentially via drag-and-drop or file picker with live progress indicator.
- [ ] Admin-uploaded photos on active products are auto-approved and published to public storage immediately.
- [ ] Admin can set any gallery photo as the primary cover photo with a single click ("Set as Cover").
- [ ] Admin can reorder and delete photos with instant visual feedback and atomic audit logging.
- [ ] All forms and controls adhere strictly to the Expyrico color palette (`#4BAE8A`, `#3A8F6F`, `#F5A623`, `#FAFAF8`, `#2C2C28`, `#E0442A`).
- [ ] All monorepo typechecks pass with 0 errors (`pnpm turbo run typecheck`).
- [ ] Unit and integration tests pass across `packages/shared`, `api`, and `apps/admin`.

## Validation Log

### Verification Results
- **Tier:** Full (5 phases)
- **Claims checked:** 12
- **Verified:** 12 | **Failed:** 0 | **Unverified:** 0
- **Verified items:**
  1. `packages/shared/src/schemas/admin/products.ts`: `adminProductPatchSchema` verified at line 82.
  2. `api/src/routes/admin/products/patch.ts`: `adminProductsPatchRoute` verified at line 33.
  3. `api/src/routes/products/photo-upload.ts`: `photoUploadRoute` verified at line 36.
  4. `api/src/routes/products/photo-order.ts`: `photoOrderRoute` verified at line 10.
  5. `api/src/routes/products/photo-delete.ts`: `photoDeleteRoute` verified at line 10.
  6. `apps/admin/src/lib/api.ts`: `apiServerFetch` verified at line 34.
  7. `apps/admin/src/lib/admin-api.ts`: `serverAdminApi.products.photos` verified at line 176.
  8. `apps/admin/src/lib/actions.ts`: `patchProductAction`, `reorderProductPhotosAction`, `removeProductPhotoAction` verified.
  9. `apps/admin/src/app/(admin)/products/[id]/product-actions.tsx`: `ProductActions` verified at line 12.
  10. `apps/admin/src/app/(admin)/products/[id]/product-photo-manager.tsx`: `ProductPhotoManager` verified at line 17.
  11. `api/src/services/products/product-photos.ts`: `assertPhotoMutablePreCheck` and admin photo permissions verified.
  12. `api/prisma/schema.prisma`: `Product` (`description`, `barcode`, `defaultShelfLifeDays`) and `ProductPhoto` models verified.

### Key Decisions Confirmed in Validation Interview
1. **Barcode Policy: Allow editing but prevent clearing**
   - Once a barcode is set on a product, an admin can update it to a different valid barcode, but cannot clear it to `null` or empty string. If the product currently has no barcode, adding one is permitted.
2. **Upload Execution: Sequential uploads with progress indicator**
   - When an admin selects multiple photos, the frontend processes them sequentially in a queue with visual progress feedback (`Uploading photo 1 of 3...`). This guarantees deterministic gallery positions and avoids API rate/capacity contention.
3. **Photo Status: Auto-approve & publish immediately**
   - Admin direct photo uploads on `active` catalog products bypass moderation delays and are immediately promoted to `publicStorageKey` with `moderationStatus: 'approved'`.

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01-start.md`, `phase-02-admin-api-client-upload-foundation.md`, `phase-03-product-core-details-edit-form.md`, `phase-04-photo-upload-cover-management.md`, `phase-05-integration-verification-testing.md`.
- Decision deltas checked: 3
- Reconciled stale references: 0
- Unresolved contradictions: 0
