---
title: "Admin Product Catalog Deletion & Merge Guard Architecture"
description: "Safe admin product catalog deletion with zero-usage validation, merge prompt when pantry items exist, and preserved search-hiding capability"
status: complete
priority: P1
effort: "4h"
tags: [admin, products, catalog, deletion, merge, pantry-items, safety-guard]
created: 2026-09-16
---

# Admin Product Catalog Deletion & Merge Guard Architecture

## Overview
Allows administrators to delete catalog products safely with strict data-integrity enforcement.
- **Zero-usage check:** If no pantry items (`Record` rows) reference the product, the admin can delete it straight away, permanently purging the catalog entry, freeing unique barcode/QR payload identifiers, cleaning up associated media, and recording an audit log.
- **In-use guard & Source-Aware Merge prompt:** If any pantry items are currently using the product, direct deletion is strictly blocked. Instead, the admin is prompted to merge the product away using the **Merge tool** (`/products/:id/merge?direction=into`). The Merge tool supports source-aware mode (`direction=into`), treating the blocked product as the **source** (`sourceIds = [id]`) and prompting the admin to search for and select the canonical **target** product, safely moving all pantry items and retiring the bad product as `merged_into`.
- **Preserved "Hide from Search":** The existing `active <-> report_hidden` catalog visibility toggle is preserved, allowing admins to instantly stop new pantry items from being created against a bad product while deciding whether to merge or what canonical product to target.

## User Requirements Checklist
- [x] Admin can click delete on a product catalog entry.
- [x] If no pantry items are using that product (nothing will break), allow admin to delete it straight away.
- [x] If some pantry items are using it, do not delete; prompt admin to use merge instead.
- [x] Keep the "Hide from Search" feature intact to stop new pantry items from being created against a bad product while deciding next steps.

## Architecture & Data Flow

```
                                  Admin clicks "Delete product"
                                                │
                                                ▼
                                    [DeleteProductModal]
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          │                                           │
                pantryItemCount > 0                         pantryItemCount === 0
                          │                                           │
                          ▼                                           ▼
             [Prompt Admin: In Use]                       [Confirm Direct Deletion]
             - Explain X items using it                   - Explain zero items affected
             - Primary CTA: "Merge into another product"  - Warn barcode/data will be purged
               (/products/:id/merge?direction=into)       - Danger CTA: "Delete Product"
             - Quick CTA: "Hide from search"
             - Direct deletion blocked                                │
                                                                      ▼
                                                          Server Action: deleteProductAction
                                                                      │
                                                                      ▼
                                                      DELETE /v1/admin/products/:id
                                                                      │
                                                       $transaction + row lock (FOR UPDATE)
                                                                      │
                                                ┌─────────────────────┴─────────────────────┐
                                                │                                           │
                                       records.count > 0                           records.count === 0
                                                │                                           │
                                                ▼                                           ▼
                                        409 Conflict:                               Detach giveaways
                                 PRODUCT_HAS_PANTRY_ITEMS                          Enqueue media cleanup
                                                                                   Cascade delete product
                                                                                   Write audit log
                                                                                   204 No Content
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Extend shared schema with `pantryItemCount` and deletion conflict error contract | P1 |
| 2 | Implement `DELETE /v1/admin/products/:id` with advisory/pessimistic lock and zero-record verification | P1 |
| 3 | Provide intuitive admin UI modal with conditional direct deletion or merge prompt | P1 |
| 4 | Ensure "Hide from Search" (`report_hidden`) remains readily available and fully operational | P1 |
| 5 | Deliver comprehensive integration test suite covering zero-use deletion, blocked in-use deletion, and concurrency | P1 |

## Phases

| # | Phase | Status | Description |
|---|-------|--------|-------------|
| 1 | [Phase 1: Shared Schema & Error Contracts](./phase-01-shared-schema-contracts.md) | Complete | Add `pantryItemCount` to `adminProductRowSchema` and define error codes in `@expyrico/shared` |
| 2 | [Phase 2: Backend Delete Route with Concurrency Guard](./phase-02-backend-delete-endpoint.md) | Complete | Build `DELETE /v1/admin/products/:id` with row lock, pantry check, media cleanup, and audit logging |
| 3 | [Phase 3: Admin UI Delete Modal & Merge Prompt UX](./phase-03-admin-ui-delete-modal.md) | Complete | Implement `DeleteProductModal`, server actions, header shortcuts, and table indicators |
| 4 | [Phase 4: Integration Testing & Verification](./phase-04-verification-tests.md) | Complete | Add integration test suites in `api` and unit tests in `apps/admin`, verifying clean cutover |

## Success Criteria
- [x] Attempting to delete a product with 0 pantry items succeeds, returns 204, deletes product row, detaches giveaways, enqueues media cleanup, writes audit log, and frees barcode.
- [x] Attempting to delete a product with >= 1 pantry items fails with 409 Conflict code `PRODUCT_HAS_PANTRY_ITEMS` and does not delete product.
- [x] Delete modal clearly displays merge prompt and direct navigation to `/products/:id/merge?direction=into` when pantry items exist.
- [x] Delete modal allows direct permanent deletion when pantry item count is 0.
- [x] "Hide from search" (`report_hidden`) remains functional and accessible as an immediate containment action.
- [x] Full test suites pass with zero regressions across `api`, `shared`, and `apps/admin`.

## Validation Log

### Verification Results
- Claims checked: 11
- Verified: 11 | Failed: 0 | Unverified: 0
- Tier: Standard (Fact Checker + Contract Verifier)
- Codebase Findings:
  - `ERROR_CODES` located in `packages/shared/src/schemas/error.ts`.
  - `adminProductRowSchema` located in `packages/shared/src/schemas/admin/products.ts`.
  - `ALLOWED_DIRECT_STATUS_TRANSITIONS` in `api/src/routes/admin/products/patch.ts` verifies `active <-> report_hidden` is preserved.
  - `adminOnlyPlugin` and `auditPlugin` verified in `api/src/routes/admin/index.ts`.
  - `writeAuditLog` in `api/src/services/audit/log.ts` and `enqueueMediaCleanup` in `api/src/services/products/product-media-cleanup.ts` verified.

### User Validation Decisions
1. **Pantry Record Scope**: Confirmed **Any pantry record (Active, Consumed, Discarded, Expired)** blocks deletion.
   - *Decision*: Deletion requires `tx.record.count({ where: { productId: id } }) === 0`. If any user has this product in historical records, deletion is blocked to prevent data corruption or orphaned records, prompting merge instead.
2. **UI Trigger Placement**: Confirmed **Both Product Detail page and Products List table**.
   - *Decision*: Admins can trigger delete from the detail page (header action bar + actions card) and directly from the main `/products` table via row actions, complemented by a "Pantry Items" count column.
3. **In-Use Modal UX**: Confirmed **Merge Tool link + inline 'Hide from search' button**.
   - *Decision*: When deletion is blocked due to existing pantry items, the modal explains the block, provides a primary CTA to open `/products/:id/merge?direction=into`, and offers an inline button to toggle `report_hidden` to contain new item creation immediately.

### Whole-Plan Consistency Sweep
- Checked all phases for stale terms or contradictions.
- All references to `ERROR_CODES` aligned to `packages/shared/src/schemas/error.ts`.
- All phase deliverables match confirmed user interview decisions.

### Advisory Resolution: Merge Directionality & Query-State Preservation
- **Blocker & Concern Addressed**:
  1. Previously `/products/:id/merge` treated `:id` as the winner/target (`merge duplicate products into :id`). Linking a blocked bad product to that route would have merged other products *into* the bad product, opposite to the required move-away cleanup.
  2. `MergeTool.submitSearch` previously rebuilt the navigation URL with only `?q=`, which would drop `direction=into` on target searches and accidentally reset the UI back to winner mode.
  3. Reconciled all plan and phase files to consistently use `/products/:id/merge?direction=into` (removing any stale directionless URLs).
- **Resolution**:
  1. Extended the merge route with source-aware mode (`/products/:id/merge?direction=into`). When `direction === 'into'`, `:id` is the `source` to be retired, search queries locate the canonical `target`, and submitting invokes `mergeProductsAction(selectedTarget.id, [id], selectedTarget.version)`.
  2. Updated `MergeTool.submitSearch` to retain `direction=into` across searches via `URLSearchParams`.
  3. Added end-to-end user flow test in Phase 4: CTA click → URL with `direction=into` → `submitSearch` preserving `direction=into` → selecting candidate target → verifying `mergeProductsAction` receives candidate as `targetId` and blocked product as `sourceIds`.
- Unresolved contradictions: 0.

## Red Team Review

### Session — 2026-09-16
**Findings:** 10 (10 accepted, 0 rejected)  
**Severity breakdown:** 1 Critical, 6 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `report_hidden` source blocked in `mergeProducts` | High | Accept | Phase 2, `api/src/services/admin/merge.ts` |
| 2 | Missing optimistic concurrency version check on DELETE | High | Accept | Phase 1, Phase 2, Phase 3 |
| 3 | Inbound merged aliases (`mergedIntoProductId`) bypass zero-usage check | High | Accept | Phase 2 |
| 4 | Open revisions (`ProductEdit`) allow concurrent photo upload race | High | Accept | Phase 2 |
| 5 | Media deletion bypasses backup freeze lease | High | Accept | Phase 2 |
| 6 | Polymorphic `Report` rows orphaned upon product/review/deal cascade | High | Accept | Phase 2 |
| 7 | Missing DELETE-specific negative RBAC tests (401/403) | Medium | Accept | Phase 4 |
| 8 | Mobile offline sync 404 destroys user pantry item | Critical | Accept | Phase 2, Phase 4 |
| 9 | Missing barcode conflict preview in source-aware merge tool | High | Accept | Phase 3 |
| 10 | Error transport of `pantryItemCount` on 409 conflict | Medium | Accept | Phase 1, Phase 3 |

### Adjudication & Resolutions Applied
1. **`report_hidden` Merge Support**: Updated Phase 2 to modify `mergeProducts` in `api/src/services/admin/merge.ts` so sources with `status === 'report_hidden'` can merge into active targets, unblocking the containment-then-merge workflow.
2. **Optimistic Concurrency**: Updated Phase 1, 2, and 3 to require `version` token on `DELETE /v1/admin/products/:id?version=:version`, throwing `version_conflict` on stale delete attempts.
3. **Inbound Alias & Deep Usage Guard**: Phase 2 now checks `tx.record.count({ where: { OR: [{ productId: id }, { product: { mergedIntoProductId: id } }] } })` and `tx.product.count({ where: { mergedIntoProductId: id } })`.
4. **Open Edit Guard**: Phase 2 rejects deletion if open revisions exist on the product.
5. **Media Freeze Safety**: Phase 2 executes deletion under `runWithMediaMutationLease` to prevent backup/manifest divergence.
6. **Report Reconciliation**: Phase 2 dismisses open polymorphic reports targeting deleted product.
7. **RBAC Verification**: Phase 4 tests 401 unauthenticated and 403 non-admin rejections.
8. **Mobile Offline Sync Recovery Contract**:
   - Phase 1 adds `PRODUCT_NOT_FOUND` to `ERROR_CODES`.
   - Phase 2 defines contract in `api/src/services/products/product-visibility.ts` (`assertProductUse` throws `PRODUCT_NOT_FOUND` on deleted products) and `apps/mobile/src/db/sync.ts` (`pushPending` catches 404 for offline creates, unlinks `productId = null`, and converts to a custom item, preserving all user data and never calling `destroyPermanently()` or clearing `householdId` falsely).
   - Phase 4 implements deletion-wins tests in `apps/mobile/tests/unit/sync-deleted-product.test.ts` for both personal and household offline records.
9. **Merge Barcode Conflict Warning**: Phase 3 displays clear barcode conflict indicator in source-mode candidate cards.
10. **Structured Conflict Error Contract**: Phase 1 & 3 ensure `pantryItemCount` is carried across error boundaries or authoritatively refetched on conflict.

### Whole-Plan Consistency Sweep
- Checked all phases for stale terms, conflicting requirements, and broken references.
- Every finding's resolution is reflected in its target phase file with matching markers.
- Phase 1 (`phase-01-shared-schema-contracts.md`): defines `adminProductDeleteQuerySchema` and `PRODUCT_NOT_FOUND`.
- Phase 2 (`phase-02-backend-delete-endpoint.md`): implements version check, alias guard, open edit lock, media lease, report cleanup, `mergeProducts` hidden source support, and mobile offline sync recovery contract.
- Phase 3 (`phase-03-admin-ui-delete-modal.md`): passes version token, preserves `direction=into` query state in `submitSearch`, and previews barcode compatibility.
- Phase 4 (`phase-04-verification-tests.md`): tests full CTA → search → target journey, RBAC 401/403, version conflict, alias blocking, report dismissal, and deletion-wins mobile offline sync tests.
- Unresolved contradictions: 0.

<!-- slug: admin-delete-product-catalog -->
