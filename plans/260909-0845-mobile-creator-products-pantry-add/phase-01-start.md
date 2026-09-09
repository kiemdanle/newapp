---
phase: 1
status: completed
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Shared Schema and API Creator Products Listing

## Overview
Update `@expyrico/shared` validation schemas and the Fastify backend API `listDrafts` service to include the creator's `active` (approved) products in the drafts listing endpoint, and properly serialize public thumbnail URLs for active products.

## Requirements
- Functional:
  - `PRODUCT_DRAFT_STATUSES` includes `'active'` in addition to `'draft'`, `'pending'`, and `'changes_required'`.
  - `productDraftsQuerySchema` accepts `status: 'all'` or any individual status in `['draft', 'pending', 'changes_required', 'active']`.
  - `GET /v1/products/drafts` defaults to returning all 4 statuses for the authenticated creator (`createdByUserId = actorId`).
  - Active products serialize thumbnail URLs pointing to their public cover images (`photos[0].thumbnailUrl` or CDN path) rather than private thumbnail routes.
  <!-- Applied: Red Team Finding 4 - Strict creator-only isolation in listDrafts -->
  - The Prisma query in `listDrafts` strictly and unconditionally binds `createdByUserId: actorId` across all queries, ensuring that active or pending products created by other users can never be returned in the creator's list regardless of query parameters.
- Non-functional:
  - Strict backward compatibility for clients calling `GET /v1/products/drafts` without parameters.
  - Zero information leakage: non-active rows created by other users remain strictly hidden (`404 not found`).
  - Database queries stay indexed on `(createdByUserId, updatedAt DESC, id DESC)`.

## Architecture
1. **Schema Updates (`@expyrico/shared`)**:
   - `PRODUCT_DRAFT_STATUSES = ['draft', 'pending', 'changes_required', 'active'] as const`.
   - `productDraftStatusSchema = z.enum(PRODUCT_DRAFT_STATUSES)`.
   - `productDraftsQuerySchema` adds optional `status: z.union([productDraftStatusSchema, z.literal('all')]).optional()`.
   - `productDraftCoverSchema` supports both public HTTPS URLs and relative paths.
2. **Backend Service (`api/src/services/products/product-drafts.ts`)**:
   - In `toDraftRow`: Check if `product.status === 'active'`. If active, extract the public thumbnail URL or fallback to private thumbnail route.
   - In `listDrafts`: If `query.status` is omitted or `'all'`, query with `status: { in: ['draft', 'pending', 'changes_required', 'active'] }`. If a specific status is requested, query with `status: query.status`.

## Related Code Files
- Modify: `packages/shared/src/schemas/product.ts`
- Modify: `packages/shared/src/schemas/product.test.ts`
- Modify: `api/src/services/products/product-drafts.ts`
- Modify: `api/tests/integration/products-draft-lifecycle.test.ts`

## Implementation Steps
1. In `packages/shared/src/schemas/product.ts`:
   - Expand `PRODUCT_DRAFT_STATUSES` to `['draft', 'pending', 'changes_required', 'active'] as const`.
   - Update `productDraftsQuerySchema` to permit `active` and `all`.
2. In `packages/shared/src/schemas/product.test.ts`:
   - Update tests to verify that `status: 'active'` and `status: 'all'` pass validation.
3. In `api/src/services/products/product-drafts.ts`:
   - Update `toDraftRow` to resolve public cover photo URLs for active products.
   - Update `listDrafts` `where` clause to include `active` in the default target statuses.
4. In `api/tests/integration/products-draft-lifecycle.test.ts`:
   - Add test proving `GET /v1/products/drafts` returns active products created by the user.
   - Add test proving another user's active product is not listed in drafts.

## Success Criteria
- [x] `packages/shared` tests pass: `npm test` in `packages/shared`.
- [x] `GET /v1/products/drafts` returns the user's active products alongside draft and pending rows.
- [x] Active products include public thumbnail URLs in the response payload.
- [x] API integration tests pass: `npm test -- products-draft-lifecycle.test.ts` in `api`.

## Risk Assessment
- **Risk**: Existing client code expecting only unapproved items might show unexpected rows if not prepared.
  - **Mitigation**: The mobile app is updated in Phase 2 with explicit tabs (`All`, `Active`, `In review`, `Drafts`), giving users full filtering control.
