---
title: Admin Product Catalog Deletion and Merge Guard Plan
date: 2026-09-16
summary: "Created and validated implementation plan for admin product catalog deletion with zero-pantry-usage check, merge prompt, and search-hiding preservation"
---

# Admin Product Catalog Deletion and Merge Guard Plan

Created and validated implementation plan for admin product catalog deletion with zero-pantry-usage check, merge prompt, and search-hiding preservation.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Problem
Admins currently have tools to edit catalog products, merge products, and moderate submissions, but lack a direct deletion feature for bad or duplicate products. When an admin attempts to delete a product:
1. If no pantry items are referencing that product (0 records in any status), the entry can be deleted safely, releasing its barcode/QR payload and purging associated media.
2. If pantry items reference that product, direct deletion would orphan or corrupt user pantry data. In that case, deletion must be blocked and the admin prompted to use the Merge tool (`/products/:id/merge`) instead.
3. The "Hide from search" feature (`report_hidden`) must remain intact to prevent new pantry items from being created against a bad product while deciding whether to merge or delete.

## Key Decisions & Validation
1. **Pantry Record Scope:** Any historical pantry item (`Record` row regardless of `status in ['active', 'consumed', 'discarded', 'expired']`) references the product and blocks deletion. Deletion requires `tx.record.count({ where: { productId: id } }) === 0`.
2. **UI Placement:** Trigger accessible on both the product detail page (`/products/:id`) and the products table (`/products`), with a dedicated "Pantry Items" count column in the table.
3. **In-Use Modal UX:** When in-use, `DeleteProductModal` displays the block explanation, a primary CTA to open the Merge Tool, and an immediate action button to "Hide from search".
4. **Zero-Usage Deletion:** When 0 records exist, `DELETE /v1/admin/products/:id` uses a row-level lock (`FOR UPDATE`), detaches giveaways, enqueues media cleanups for private and public photo storage keys, cascades `ProductPhoto`, `ProductEdit`, `Review`, `Deal`, records an audit log row (`product.delete`), and returns 204.
5. **Merge Directionality & Query Preservation for In-Use Products:** Inverted merge direction for move-away cleanup. `/products/:id/merge?direction=into` sets `:id` as the `source` to be retired, searching for and selecting the canonical `target`, ensuring the blocked product is passed as `sourceIds: [id]` and retired as `status: 'merged_into'`, rather than becoming the surviving winner. In `MergeTool`, `submitSearch` preserves `direction=into` across candidate searches via `URLSearchParams` to prevent resetting to winner mode. Tested via full user journey: CTA click -> target search -> choose target -> merge action.
6. **Red Team Review Hardening:** Adjudicated and applied 10 adversarial findings:
   - Added `version` token check to `DELETE /v1/admin/products/:id?version=:version` for optimistic concurrency.
   - Extended usage guard to account for inbound merged aliases (`mergedIntoProductId`) and deep record references.
   - Blocked deletion when open revisions (`ProductEdit`) exist to eliminate concurrent photo upload races.
   - Enclosed media deletion in `runWithMediaMutationLease` to prevent media backup / manifest divergence.
   - Reconciled polymorphic `Report` records on deleted products/reviews/deals to prevent orphaned reports.
   - Updated `mergeProducts` to permit `report_hidden` sources into active targets, unblocking the containment-then-merge flow.
   - Added negative RBAC tests (401/403) and end-to-end source merge journey verification.
   - Defined mobile offline sync recovery contract in `apps/mobile/src/db/sync.ts`: offline-created records receiving 404 `PRODUCT_NOT_FOUND` unlink `productId = null` and preserve all user data as custom items, preventing destructive data loss on mobile.
   - Added deletion-wins test specifications in `apps/mobile/tests/unit/sync-deleted-product.test.ts` for personal and household offline records.

## Artifacts Produced
- Implementation Plan: `plans/260916-1250-admin-delete-product-catalog/plan.md`
- Phase 1: `plans/260916-1250-admin-delete-product-catalog/phase-01-shared-schema-contracts.md`
- Phase 2: `plans/260916-1250-admin-delete-product-catalog/phase-02-backend-delete-endpoint.md`
- Phase 3: `plans/260916-1250-admin-delete-product-catalog/phase-03-admin-ui-delete-modal.md`
- Phase 4: `plans/260916-1250-admin-delete-product-catalog/phase-04-verification-tests.md`
- Validated via `ak plan validate` with 0 unresolved contradictions.
