---
phase: 2
title: "Backend API and moderation engine"
status: completed
priority: P1
dependencies: [1]
---

# Phase 2: Backend API and moderation engine

<!-- Updated: Validation Session 1 - Added submitter notes and defaultShelfLifeDays support, outbox notifications on decision -->
<!-- Updated: Red Team Review - Fix pending 409 resumption, robust proposed fallback, rebase/supersede coverage for shelf life & notes, audit log diff completeness -->

## Overview
Update the backend `product-edits` service and HTTP route handlers in Fastify to handle all product metadata fields during creation, metadata updates, submission, and admin approval. Ensure `approveEdit` atomically applies `defaultShelfLifeDays`, `notes`, name, description, brand, category, and photos to the live `Product` row in a single transactional unit with comprehensive audit logging and moderation outbox event recording.

## Requirements

### Functional
- `createOrResumeProductEdit`:
  - Return `{ edit: toProductEditRow(existing), resumed: true }` when an existing suggestion is `pending`, enabling mobile clients to load the read-only summary view without triggering a 409 conflict error (while mutation routes remain strictly locked to `draft` and `changes_required`).
  - Seed `defaultShelfLifeDays` from the live product and initialize `notes` as `null` on new drafts.
- `patchProductEditMetadata`: Accept `defaultShelfLifeDays` and `notes` in the request body, store them in `ProductEdit.proposed` JSON and update `ProductEdit.notes` column.
- `toProductEditRow`: Map `defaultShelfLifeDays` (from `proposed.defaultShelfLifeDays` falling back to `product.defaultShelfLifeDays`) and `notes` (from `ProductEdit.notes` or `proposed.notes`).
- `submitProductEdit`: Ensure submissions properly record moderation notification events and transition edit status to `pending`.
- `approveEdit`:
  - Verify underlying product is active and optimistic version matches `baseProductVersion`.
  - Transactionally update `Product` row with `defaultShelfLifeDays: proposed.defaultShelfLifeDays !== undefined ? (proposed.defaultShelfLifeDays ?? null) : product.defaultShelfLifeDays`.
  - Publish all newly staged photos and update photo positions.
  - Delete removed live photos safely without breaking open edit constraints.
  - Write `AdminAuditLog` recording the full metadata diff (including before/after for `defaultShelfLifeDays` and `notes`).
  - Record resolution outbox notification event so user is notified of approval.
  - Mark `ProductEdit` as `approved`, set `resolvedBy` and `resolvedAt`, and increment version.
- `rebaseProductEdit` & `supersedeProductEdit`: Ensure rebase and supersede logic accurately rebase `defaultShelfLifeDays` and `notes` against the current live product metadata.
- `requestChangesOnEdit`: Transactionally set status to `changes_required`, record admin notes, record outbox notification event, and write audit log.
- Admin pending endpoints (`GET /api/admin/products/pending`, `GET /api/admin/products/pending/:editId`, `PATCH /api/admin/products/pending/:editId`): Expose complete metadata and submitter notes.

### Non-functional
- Row locking with PostgreSQL `FOR UPDATE` on product and edit rows to eliminate race conditions.
- Strict validation with Fastify route schemas.
- Clean error responses with typed `AppError` and HTTP status codes (404 Not Found, 409 Conflict, 403 Forbidden).

## Architecture
```
Fastify Request
  │
  ├── POST /v1/products/:id/edits                ──▶ createOrResumeProductEdit (handles draft/pending/changes_required)
  ├── PATCH /v1/product-edits/:editId            ──▶ patchProductEditMetadata
  ├── POST /v1/product-edits/:editId/submit      ──▶ submitProductEdit
  ├── GET /api/admin/products/pending            ──▶ listPendingEdits
  ├── GET /api/admin/products/pending/:editId    ──▶ getPendingEdit
  └── PATCH /api/admin/products/pending/:editId  ──▶ resolveProductEdit (approve / request_changes)
                                                           │
                                                           ▼
                                                Prisma Transaction ($tx)
                                                ┌─────────────────────────────┐
                                                │ 1. Product row update       │
                                                │ 2. Photo set sync & publish │
                                                │ 3. ProductEdit row update   │
                                                │ 4. AdminAuditLog insert     │
                                                │ 5. Notification outbox sync │
                                                └─────────────────────────────┘
```

## Related Code Files
- Modify: `api/src/services/products/product-edits.ts`
- Modify: `api/src/routes/products/edit-create.ts`
- Modify: `api/src/routes/products/edit-patch.ts`
- Modify: `api/src/routes/products/edit-submit.ts`
- Modify: `api/src/routes/admin/products/pending-get.ts`
- Modify: `api/src/routes/admin/products/pending-resolve.ts`
- Create/Modify: `api/tests/integration/product-edits.test.ts`

## Implementation Steps
1. In `api/src/services/products/product-edits.ts`:
   - In `createOrResumeProductEdit`: Return `{ edit: toProductEditRow(existing), resumed: true }` even when `existing.status === 'pending'`, allowing clients to query their submitted suggestion without 409 error.
   - Update `ProposedMetadata` type definition to include `defaultShelfLifeDays?: number | null` and `notes?: string | null`.
   - Update `toProductEditRow` mapping to include `defaultShelfLifeDays` and `notes`.
   - Update `createOrResumeProductEdit` to seed `defaultShelfLifeDays: product.defaultShelfLifeDays` into initial `proposed` JSON.
   - Update `patchProductEditMetadata` to handle `defaultShelfLifeDays` and `notes` fields in `tx.productEdit.update`.
   - In `approveEdit`: Include `defaultShelfLifeDays` in `tx.product.updateMany` data payload with safe fallback, and include it in `AdminAuditLog` diff calculation.
   - In `rebaseProductEdit` & `supersedeProductEdit`: Include `defaultShelfLifeDays` and `notes` in the rebase diff.
   - In `approveEdit` and `requestChangesOnEdit`: Record resolution notification events.
2. In `api/src/routes/products/edit-patch.ts`: Ensure route schema validates `defaultShelfLifeDays` and `notes` via `productEditMetadataPatchRequestSchema`.
3. In `api/src/routes/admin/products/pending-get.ts` and `pending-resolve.ts`: Ensure serialization maps `adminProductEditDetailSchema` with all new fields.
4. Update `api/tests/integration/product-edits.test.ts`:
   - Test draft creation with shelf life and notes.
   - Test reading open pending suggestion via `createOrResumeProductEdit` without 409 error.
   - Test patching metadata with shelf life changes and notes.
   - Test submission to `pending`.
   - Test approval updating `Product.defaultShelfLifeDays` along with name, brand, category, description, and photos.
   - Test rebase and supersede on stale revisions.
   - Test audit log diff contents.

## Success Criteria
- [x] Integration tests in `api/tests/integration/product-edits.test.ts` pass with 100% success.
- [x] Admin approval verified to update `Product` metadata and photos in a single atomic transaction.
- [x] Audit log accurately captures before and after values for all changed fields.

## Risk Assessment
- *Risk*: `proposed` JSON in legacy rows missing `defaultShelfLifeDays`.
- *Mitigation*: Safely check `proposed.defaultShelfLifeDays !== undefined ? proposed.defaultShelfLifeDays : product.defaultShelfLifeDays`.
