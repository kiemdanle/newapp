---
phase: 4
title: "Integration Testing & Verification"
status: complete
priority: P1
effort: "1h"
dependencies: [1, 2, 3]
---

# Phase 4: Integration Testing & Verification

## Overview
Adds automated integration and unit test coverage in both `api` and `apps/admin` to guarantee that product deletion functions safely, blocked deletion responds with clear conflict errors, media and database cleanup work properly, and the admin UI handles all states correctly without regressions.

<!-- Updated: Validation Session 1 - Integration and unit test coverage aligned with confirmed decisions -->
<!-- Updated: Red Team Review - Added RBAC negative tests, version conflict tests, inbound alias guard tests, open revision guard tests, backup freeze lease tests, and report_hidden merge tests -->
## Requirements
- Functional:
  - Backend integration tests in `api/tests/integration/admin-product-delete.test.ts`:
    1. **Direct deletion of unused product:** Create an active product with 0 records. Call `DELETE /v1/admin/products/:id?version=:version` with admin credentials. Verify HTTP 204. Verify row is removed from `products`. Verify audit log row is created with `action: 'product.delete'`. Verify barcode is now available for new product creation.
    2. **Deletion blocked for product in use:** Create an active product with 1+ pantry items (`Record`). Call `DELETE /v1/admin/products/:id?version=:version`. Verify HTTP 409 Conflict with error code `product_has_pantry_items`. Verify row remains intact in database.
    3. **Optimistic concurrency protection:** Call delete with a mismatched version. Verify HTTP 409 Conflict with `version_conflict`. Verify product is not deleted.
    4. **Inbound merged alias protection:** Create Product A merged into Product C. Attempt to delete C. Verify HTTP 409 Conflict blocking deletion while inbound aliases exist, preventing orphaned alias pointers.
    5. **Open revision protection:** Create a product with an open `ProductEdit`. Attempt to delete. Verify HTTP 409 Conflict requiring resolving or rejecting the revision before deletion.
    6. **Giveaway detachment:** Create a product with a referencing giveaway (0 pantry records). Verify that on deletion, the giveaway's `productId` is set to null, and the product is deleted cleanly without foreign key violations.
    7. **Media and edits cleanup:** Create a product with associated `ProductPhoto` and `ProductEditPhoto` rows. Call delete. Verify media cleanup queue entries are created for private and public storage keys.
    8. **Polymorphic reports cleanup:** Create a product with open abuse reports. Call delete. Verify reports are updated to `status: 'dismissed'` with audit notes.
    9. **"Hide from Search" & Merge compatibility:** Verify `PATCH /v1/admin/products/:id` with `{ status: 'report_hidden' }` succeeds, and calling `mergeProducts` with the hidden source and an active target succeeds without status conflict.
    10. **RBAC negative tests:** Call `DELETE /v1/admin/products/:id` without authentication (verify 401) and as an ordinary non-admin user (verify 403).
    11. **Concurrency test:** Verify that attempting delete while a pantry record is inserted is rejected safely.
    12. **Deleted product create test:** Verify that `POST /v1/records` with a deleted/non-existent `productId` returns 404 with structured `code: 'product_not_found'`.
  - Mobile offline sync recovery tests in `apps/mobile/tests/unit/sync-deleted-product.test.ts`:
    1. **Deletion-wins personal record test:** An offline-created personal record referencing product P attempts sync after P is deleted on the server. Verify that receiving 404 `PRODUCT_NOT_FOUND` unlinks `productId = null`, preserves all user data (`customName`, `brand`, `quantity`, `expiryDate`, `notes`, `photoUrl`), retains `pendingSync = true`, and does NOT call `destroyPermanently()`. Verify item syncs successfully as a custom item.
    2. **Deletion-wins household record test:** An offline-created household record referencing product P attempts sync after P is deleted. Verify that receiving 404 `PRODUCT_NOT_FOUND` unlinks `productId = null`, preserves `householdId`, retains `pendingSync = true`, and does not falsely mark synced. Verify item syncs to the household as a custom item.
  - Admin frontend unit tests in `apps/admin/tests/unit/products-delete.test.ts`:
    1. Test `deleteProductAction` calls API correctly, revalidates paths, and returns clean `ActionResult`.
    2. Test `DeleteProductModal` in-use state renders merge button pointing to `/products/:id/merge?direction=into` and hides/disables delete CTA.
    3. Test `DeleteProductModal` zero-usage state renders confirmation delete button and calls server action.
    4. Test end-to-end source-mode merge flow (CTA → search → choose target):
       - Verify CTA in `DeleteProductModal` links to `/products/:id/merge?direction=into`.
       - Verify `MergeTool.submitSearch` preserves `direction=into` in URL search parameters when submitting search queries for targets.
       - Verify selecting a candidate target calls `mergeProductsAction` with candidate ID as `targetId` and blocked product ID as `sourceIds: [blockedId]`, confirming the blocked product is retired as source and not winner.
- Non-functional:
  - Tests run deterministically, clean up after themselves, and pass as part of standard test runs.
  - Typecheck passes cleanly across workspaces (`npm run typecheck`).

## Architecture
```
Test Suite Execution:
├── api/tests/integration/admin-product-delete.test.ts
│   ├── Test 1: 0 records -> 204 No Content & Audit Log & Barcode freed
│   ├── Test 2: 1+ records -> 409 Conflict (PRODUCT_HAS_PANTRY_ITEMS)
│   ├── Test 3: Giveaways detached to NULL
│   ├── Test 4: Media cleanup enqueued
│   └── Test 5: report_hidden toggle verified
└── apps/admin/tests/unit/products-delete.test.ts
    ├── Test 1: Action handles 204 & 409
    ├── Test 2: Modal renders In-Use (Merge into another product CTA with ?direction=into)
    ├── Test 3: Modal renders Zero-Usage (Delete Confirm)
    └── Test 4: End-to-end source merge flow: CTA (?direction=into) -> submitSearch query preservation -> choose target -> mergeProductsAction(target, [source])
└── apps/mobile/tests/unit/sync-deleted-product.test.ts
    ├── Test 1: Deletion-wins personal item: unlinks productId, preserves data, no destroyPermanently()
    └── Test 2: Deletion-wins household item: unlinks productId, preserves householdId, retains pendingSync
```

## Related Code Files
- Create: `api/tests/integration/admin-product-delete.test.ts`
- Create: `apps/admin/tests/unit/products-delete.test.ts`
- Create: `apps/mobile/tests/unit/sync-deleted-product.test.ts`
- Run: `api/tests/integration/admin-product-moderation.test.ts`
- Run: `apps/admin/tests/unit/pantry-items.test.ts`

## Implementation Steps
1. Create `api/tests/integration/admin-product-delete.test.ts`:
   - Setup Fastify test server with `buildServer()`.
   - Implement test cases covering 0 records, 1+ records, giveaway detachment, photo cleanup, and audit logging.
2. Create `apps/admin/tests/unit/products-delete.test.ts`:
   - Unit test the server action and modal states using Vitest/React Testing Library.
3. Run test suites:
   - `npm test api/tests/integration/admin-product-delete.test.ts`
   - `npm test apps/admin/tests/unit/products-delete.test.ts`
4. Run workspace typecheck:
   - `npm run check` or `npm run typecheck`

## Success Criteria
- [x] All new integration tests pass in `api/tests/integration/admin-product-delete.test.ts` (covering direct delete, in-use block, version conflict, inbound aliases, open edits, giveaways, media cleanup, report cleanup, and RBAC denial).
- [x] Deletion-wins mobile sync tests pass in `apps/mobile/tests/unit/sync-deleted-product.test.ts` for both personal and household offline records.
- [x] End-to-end source-aware merge test verifies CTA navigation, query-state preservation (`direction=into` retained across searches), and correct target/source argument passing to `mergeProductsAction`.
- [x] All new unit tests pass in `apps/admin/tests/unit/products-delete.test.ts`.
- [x] Pre-existing test suites continue to pass with zero regressions.
- [x] Full workspace typecheck passes without errors.

## Risk Assessment
- Risk: Foreign key constraints on unindexed or forgotten relations preventing deletion.
  - Mitigation: The test suite explicitly constructs products linked to giveaways, photos, edits, and reviews to verify every relationship is handled properly.
