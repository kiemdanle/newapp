---
title: Admin Product Catalog Deletion and Merge Guard Implementation
date: 2026-09-16
summary: "Implemented safe admin catalog product deletion, in-use merge prompt, and offline deletion-wins mobile sync recovery across all workspaces."
---

# Admin Product Catalog Deletion and Merge Guard Implementation

## What was implemented
Completed full implementation of the Admin Product Catalog Deletion and Merge Guard feature across `@expyrico/shared`, `api`, `apps/admin`, and `apps/mobile`:
1. **Shared Schemas (`packages/shared`)**: Added `pantryItemCount` to `adminProductRowSchema`, added `adminProductDeleteQuerySchema` with `version: z.coerce.number().int().min(1)`, and defined standard error codes `PRODUCT_HAS_PANTRY_ITEMS` and `PRODUCT_NOT_FOUND` in `packages/shared/src/schemas/error.ts`.
2. **Backend Deletion Route (`api`)**: Implemented `DELETE /v1/admin/products/:id?version=:version` with pessimistic row locking (`FOR UPDATE`), optimistic concurrency check (`version_conflict`), deep usage and inbound alias check (`PRODUCT_HAS_PANTRY_ITEMS`), open revision protection, giveaway detachment, polymorphic report dismissal, media outbox cleanup enqueue, and transactional audit logging (`product.delete`). Updated `get.ts` and `list.ts` to compute authoritative `pantryItemCount`.
3. **Merge Service Enhancement (`api`)**: Updated `mergeProducts` in `api/src/services/admin/merge.ts` to permit sources with `status === 'report_hidden'` when merging into active targets, enabling the immediate-containment-then-merge workflow.
4. **Admin UI (`apps/admin`)**: Built `DeleteProductModal` with dynamic branching (in-use merge guidance vs zero-usage deletion confirmation), added delete triggers to detail page header and actions card, added a "Pantry Items" column and row action to the products table, and extended `MergeTool` to support source-aware merge (`direction=into`) with `submitSearch` query preservation and barcode compatibility warnings.
5. **Mobile Offline Sync Recovery (`apps/mobile`)**: Updated `pushPending` in `apps/mobile/src/db/sync.ts` to differentiate offline CREATE from UPDATE on 404 with deleted product, unlinking `r.productId = null` and preserving all user data (`quantity`, `expiryDate`, `notes`, `householdId`) as custom items without calling `destroyPermanently()`.
6. **Automated Verification Suites**:
   - `api/tests/integration/admin-product-delete.test.ts`: 11 integration tests covering zero-use deletion, in-use blocking, concurrency, alias guards, open edits, giveaways, media cleanup, reports, RBAC, and deleted product API errors.
   - `apps/admin/tests/unit/products-delete.test.ts`: 5 unit tests covering server actions, conflict error handling, source-mode merge routing, and query preservation.
   - `apps/mobile/tests/unit/sync-deleted-product.test.ts`: 3 unit tests verifying deletion-wins behavior for personal and household offline records and server-side record deletion.

## Decisions & Tradeoffs
- **Zero-usage requirement**: Any historical record (`status in ['active', 'consumed', 'discarded', 'expired']`) or inbound merged alias strictly blocks deletion to prevent orphaned foreign keys and historical record corruption.
- **Source-aware merge inversion**: Blocked products are retired as sources (`sourceIds = [id]`), while the candidate selected is the target, preserving pantry records under the canonical product.
- **Offline mobile resilience**: Catalog product deletion never destroys offline user-entered data; unlinking turns it into a custom item, keeping users in full control of their pantry items.

## Verification
- `pnpm --filter @expyrico/shared typecheck`: PASS (0 errors)
- `pnpm --filter api typecheck`: PASS (0 errors)
- `pnpm --filter @expyrico/admin typecheck`: PASS (0 errors)
- `pnpm --filter @expyrico/mobile typecheck`: PASS (0 errors)
- `pnpm --filter api test tests/integration/admin-product-delete.test.ts`: 11/11 tests pass
- `pnpm --filter @expyrico/admin test tests/unit/products-delete.test.ts`: 5/5 tests pass
- `pnpm --filter @expyrico/mobile test tests/unit/sync-deleted-product.test.ts`: 3/3 tests pass
- `node scripts/check-vendored-shared-dist.mjs`: OK (vendored dist matches fresh build)

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
