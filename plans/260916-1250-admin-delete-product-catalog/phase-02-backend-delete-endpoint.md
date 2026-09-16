---
phase: 2
title: "Backend Delete Route with Concurrency Guard"
status: complete
priority: P1
effort: "1.5h"
dependencies: [1]
---

# Phase 2: Backend Delete Route with Concurrency Guard

## Overview
Implements the administrative route `DELETE /v1/admin/products/:id` with strict concurrency locking and zero-record verification, safely cascading deletion, detaching giveaways, enqueuing media cleanup, and recording audit logs. Also updates `GET /v1/admin/products/:id` and `GET /v1/admin/products` to supply `pantryItemCount`.

## Requirements
- Functional:
  - Add route handler `DELETE /:id` in `api/src/routes/admin/products/delete.ts`.
  - Mount route under `/products` in `api/src/routes/admin/index.ts`.
  - Validate parameters with `paramsSchema` (`id: z.string().uuid()`) and query with `adminProductDeleteQuerySchema` (`version: z.coerce.number().int().min(1)`).
<!-- Updated: Validation Session 1 - All record statuses (active, consumed, discarded, expired) confirmed to block deletion -->
<!-- Updated: Red Team Review - Added optimistic concurrency version check, inbound alias guard, open edit lock, backup freeze lease, report cleanup, and report_hidden merge support -->
  - Execute within `runWithMediaMutationLease` and `prisma.$transaction`:
    1. Lock target product row: `SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`.
    2. Read target product, throw 404 if not found.
    3. **Optimistic Concurrency Guard:** Verify `if (product.version !== version) versionConflict(product.version)`. Protects against deleting a product that another administrator concurrently updated or approved.
    4. **Inbound Alias & Deep Usage Guard:**
       - Count referencing records across direct references and inbound merged aliases:
         `const recordCount = await tx.record.count({ where: { OR: [{ productId: id }, { product: { mergedIntoProductId: id } }] } });`
       - Count inbound merged aliases:
         `const inboundAliases = await tx.product.count({ where: { mergedIntoProductId: id } });`
       - If `recordCount > 0 || inboundAliases > 0`, reject deletion and throw `AppError` 409 Conflict with code `ERROR_CODES.PRODUCT_HAS_PANTRY_ITEMS`, title `"Cannot delete product in use"`, and detail: `"Cannot delete product: used by ${recordCount} pantry items (or has ${inboundAliases} merged aliases). Use merge instead."`.
    5. **Open Revision Guard:**
       - Check for open edits: `const openEdits = await tx.productEdit.count({ where: { productId: id, isLegacy: false, status: { in: ['draft', 'pending', 'changes_required'] } } });`
       - If `openEdits > 0`, throw 409 Conflict: `"An open revision exists on this product; resolve or reject it before deleting."`.
    6. If all guards pass, proceed with safe transactional deletion:
       - Detach any referencing giveaways: `await tx.giveaway.updateMany({ where: { productId: id }, data: { productId: null } })`.
       - Dismiss open polymorphic reports targeting this product or its cascaded reviews/deals to prevent orphaned unresolvable reports:
         `await tx.report.updateMany({ where: { targetType: 'product', targetId: id, status: 'open' }, data: { status: 'dismissed', notes: 'Product deleted by admin' } })`.
       - Query and collect media storage keys:
         - Live product photos: `privateStorageKey`, `publicStorageKey`.
         - Staged product edit photos: lock and fetch `tx.productEditPhoto.findMany({ where: { productEdit: { productId: id } } })`.
         - Enqueue media cleanups: `enqueueMediaCleanup(tx, { operation: 'delete_private', keys })` and `delete_public`.
       - Delete product: `await tx.product.delete({ where: { id } })`.
         (Postgres foreign keys cascade `product_photos`, `product_edits`, `reviews`, `deals`).
       - Record comprehensive audit log: `writeAuditLog({ adminId: req.user!.id, action: 'product.delete', targetType: 'product', targetId: id, diff: { before: product, after: null, detachedGiveaways: giveawaysCount, deletedReviews: reviewsCount, deletedDeals: dealsCount }, requestId: req.id, ip: req.ip }, tx)`.
    7. Return `204 No Content`.
  - **Merge Support for Hidden Sources (`api/src/services/admin/merge.ts`)**:
    - Update `mergeProducts` to permit sources with `status === 'report_hidden'` when merging into an active target:
      `if (s.status !== 'active' && s.status !== 'report_hidden') conflict(\`Source product \${s.id} is not eligible for merge\`);`
    - This directly unblocks the "Hide from search while arranging the merge" workflow so admins can contain bad products and subsequently merge them.
  - Update `api/src/routes/admin/products/get.ts` and `api/src/routes/admin/products/list.ts` to compute and populate `pantryItemCount` via `records: { select: { id: true } }` or `_count: { select: { records: true } }`.
  - Verify that the "Hide from search" feature (`active <-> report_hidden` catalog toggle in `api/src/routes/admin/products/patch.ts`) remains intact and unmodified.
  - **Unavailable-Product API & Mobile Recovery Contract (`api` & `apps/mobile`)**:
    - In `api/src/services/products/product-visibility.ts` (`assertProductUse`): when a referenced product no longer exists (e.g. deleted), throw `ProductUseRejectionError({ status: 404, code: ERROR_CODES.PRODUCT_NOT_FOUND, title: 'Product not found' })`, cleanly distinguishing a missing product from a missing record.
    - In `api/src/routes/records/create.ts`: surface `PRODUCT_NOT_FOUND` so mobile sync can explicitly detect when an offline creation's catalog product was deleted.
    - In `apps/mobile/src/db/sync.ts` (`pushPending` error handling):
      - Differentiate CREATE operations (`!rec.serverId`) from UPDATE operations (`rec.serverId`).
      - For CREATE operations (`!rec.serverId`): if `status === 404` and `(errorCode === ERROR_CODES.PRODUCT_NOT_FOUND || errorCode === 'product_not_found' || rec.productId)`:
        - **Recovery Policy**: Do NOT permanently destroy the record or falsely clear household state.
        - Unlink the deleted product: update local WatermelonDB record `fresh.update(r => { r.productId = null; r.pendingSync = true; })`.
        - All user-entered data (`customName`, `brand`, `quantity`, `unit`, `expiryDate`, `notes`, `photoUrl`, `householdId`) is 100% preserved.
        - The record is converted to a custom pantry item and cleanly retried on the next sync pass.
      - For UPDATE operations (`rec.serverId`): maintain existing behavior (a 404 on `PATCH` means the server-side record itself was deleted, so destroying local record permanently is correct).
- Non-functional:
  - Row locking guarantees no race condition where a pantry item is attached while delete is processing.
  - Media cleanup prevents storage leaks on disk or S3.
  - Zero disruption to existing pantry references when products are kept or hidden.

## Architecture
```
DELETE /v1/admin/products/:id
          │
          ▼
   adminOnlyPlugin + auditPlugin
          │
          ▼
  $transaction (Serializable / Row Lock)
          │
          ├──> SELECT id FROM products WHERE id = :id FOR UPDATE
          │
          ├──> SELECT count(*) FROM records WHERE product_id = :id
          │
          ├──> If count > 0:
          │      ROLLBACK & THROW AppError(409, PRODUCT_HAS_PANTRY_ITEMS)
          │
          └──> If count === 0:
                 ├──> UPDATE giveaways SET product_id = NULL WHERE product_id = :id
                 ├──> Collect photo keys & enqueueMediaCleanup(...)
                 ├──> DELETE FROM products WHERE id = :id (cascades edits, photos, reviews)
                 ├──> writeAuditLog(product.delete, diff)
                 └──> COMMIT & Reply 204 No Content
```

## Related Code Files
- Create: `api/src/routes/admin/products/delete.ts`
- Modify: `api/src/routes/admin/index.ts`
- Modify: `api/src/routes/admin/products/get.ts`
- Modify: `api/src/routes/admin/products/list.ts`
- Modify: `api/src/services/admin/merge.ts`
- Modify: `api/src/services/products/product-visibility.ts`
- Modify: `api/src/routes/records/create.ts`
- Modify: `apps/mobile/src/db/sync.ts`
## Implementation Steps
1. Create `api/src/routes/admin/products/delete.ts`:
   - Define `adminProductsDeleteRoute(app: FastifyInstance)`.
   - Implement `$transaction` with `FOR UPDATE` lock, record count check, giveaway detachment, photo cleanup enqueue, `product.delete`, and `writeAuditLog`.
2. Register route in `api/src/routes/admin/index.ts`:
   - Import `adminProductsDeleteRoute` and register under `{ prefix: '/products' }`.
3. Update `api/src/routes/admin/products/get.ts`:
   - Add `_count: { select: { records: true } }` or record count query.
   - Pass `pantryItemCount: p._count.records` into `adminProductRowSchema.parse(...)`.
4. Update `api/src/routes/admin/products/list.ts`:
   - Include `_count: { select: { records: true } }` in `ADMIN_PRODUCT_INCLUDE`.
   - Map `pantryItemCount: p._count?.records ?? 0` in `toRow(...)`.
5. Verify `report_hidden` patch behavior in `api/src/routes/admin/products/patch.ts` remains active and unaffected.
6. In `api/src/services/products/product-visibility.ts` & `api/src/routes/records/create.ts`:
   - Update `assertProductUse` to throw `ERROR_CODES.PRODUCT_NOT_FOUND` for missing products.
7. In `apps/mobile/src/db/sync.ts`:
   - Update `pushPending` catch block to distinguish `!rec.serverId` (CREATE) from `rec.serverId` (UPDATE).
   - On 404 for CREATE with deleted product, unlink `r.productId = null` and retain `pendingSync = true`, preserving user data as a custom item.

## Success Criteria
- [x] `DELETE /v1/admin/products/:id?version=:version` returns 204 when product has 0 records, 0 aliases, and matching version.
- [x] `DELETE /v1/admin/products/:id` returns 409 Conflict with `version_conflict` when submitted version does not match DB version.
- [x] `DELETE /v1/admin/products/:id` returns 409 Conflict with `PRODUCT_HAS_PANTRY_ITEMS` when product has >= 1 records or inbound merged aliases.
- [x] `DELETE /v1/admin/products/:id` returns 409 Conflict when an open revision exists on the product.
- [x] Open polymorphic reports targeting the deleted product are cleanly dismissed.
- [x] Barcode unique constraint is released when product is deleted.
- [x] Audit log entry with `action: 'product.delete'` and collateral diff is committed.
- [x] `mergeProducts` accepts `report_hidden` sources when target is active, enabling the containment-then-merge workflow.
- [x] `GET /v1/admin/products` and `GET /v1/admin/products/:id` return accurate `pantryItemCount`.
- [x] `POST /v1/records` with deleted `productId` returns 404 with structured `PRODUCT_NOT_FOUND`.
- [x] Mobile sync recovers offline records whose product was deleted by unlinking `productId` and preserving all user data as custom items.

## Risk Assessment
- Risk: Deadlock or race condition between concurrent pantry item creation and product deletion.
  - Mitigation: The backend uses pessimistic row lock `SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE` inside `$transaction`. Any concurrent pantry item creation attaching this product is forced to serialize, ensuring the count check is strictly accurate.
- Risk: Orphaned media files remaining in storage.
  - Mitigation: Explicitly fetch live and staged photo keys and enqueue media cleanup records before executing the row deletion.
