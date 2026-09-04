---
phase: 1
title: "Backend Contracts, Migration, Security, Community Feed, and Universal Rate Limiting"
status: pending
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Backend Contracts, Migration, Security, Community Feed, and Universal Rate Limiting

## Overview
Implement the backend foundation required by the mobile review system, resolving critical queue deduplication, status drift across admin/report paths, empty-string counting, report abuse vulnerabilities, and credential validation identified in red-team review:
1. **Prisma Database Migration**: Add dedicated global composite indexes on `Review` for high-performance catalog-wide filtering and sorting:
   `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
2. **Distinct Reporter Counting for Auto-Hide (`api/src/services/reports/repository.ts`)**: Update `maybeAutoHide` to count distinct `reporterId` values rather than raw report rows, preventing a single malicious user from auto-hiding reviews by submitting duplicate reports.
3. **Database-Validated Optional Auth (`api/src/plugins/auth.ts`)**: Add an `app.optionalAuth` preHandler that validates `tokenVersion` and active account status against the database whenever a Bearer token is provided on public feeds (`/products/:id/reviews`, `/reviews/community`), ensuring revoked or suspended credentials cannot access private or hidden review states.
4. **Separate Create & Patch Body Schemas (`packages/shared/src/schemas/review.ts`)**:
   - `reviewCreateSchema`: accepts optional string, normalizes empty/whitespace to `null`.
   - `reviewPatchSchema`: accepts `string | null | undefined`, where `undefined` preserves existing body, and `null` (or empty string) normalizes to `null` to clear the comment and decrement `reviewCount`.
5. **Recalc Queue Deduplication Fix (`api/src/queues/jobs/product-rating-recalc.ts`)**: Remove the fixed deterministic `jobId: product-rating-recalc-${productId}`. BullMQ retains completed jobs (`removeOnComplete: 1000`), which causes subsequent rating updates for the same product to be silently dropped as duplicates. Allowing auto-generated unique job IDs ensures every review mutation reliably triggers product rating recalculation.
6. **Universal Status Recalculation Coverage**: Trigger `enqueueProductRatingRecalc(productId)` across all review status transition points:
   - Author edit/delete in `api/src/routes/reviews/update.ts` (when rating, body presence, or status changes, with atomic check against resurrecting soft-deleted reviews).
   - Admin review moderation in `api/src/routes/admin/reviews/status.ts:13-18` (when status changes).
   - Abuse report resolution in `api/src/routes/admin/reports/resolve.ts:18-21` and auto-hide in `api/src/services/reports/repository.ts:47-50`.
7. **Authoritative Own Review Route (`GET /v1/products/:id/my-review`)**: Provide a dedicated endpoint in `api/src/routes/reviews/my-review.ts` returning `{ review: Review | null }`. This allows the mobile review screen to authoritatively determine edit vs. create mode without paginated community feed scanning.
8. **Server-Side Self-Vote Prevention**: Enforce in `api/src/routes/reviews/helpful.ts` that `review.userId !== req.user.id`, throwing `403 FORBIDDEN` on self-votes.
9. **Idempotency on Review Creation**: Enable `config: { idempotent: 'required', rateLimit: reviewWriteRateLimit }` in `create.ts`.
10. **Shared Review Schema Expansion**: Extend the shared `Review` contract to include optional lightweight `product` projection (`id`, `name`, `brand`, `imageUrl`).
11. **Personal Reviews Route Projection**: Update `api/src/services/reviews/repository.ts` and `api/src/routes/reviews/my-reviews.ts` (`GET /v1/me/reviews`) to select `product` information.
12. **Community Reviews Feed Endpoint**: Implement `GET /v1/reviews/community` in `api/src/routes/reviews/community.ts` supporting deterministic keyset pagination (composite cursor with `id` tie-breaker), sorting (`score` vs `new`), profanity-filter visibility rules (`status: 'visible'`), active-product constraints, and viewer `myVote` projection.
13. **Universal Rate Limiting**: Apply explicit 60/min limit on reads, 15/min on write mutations, and 30/min on voting.
14. **Testing & Vendored Sync**: Add integration tests covering distinct reporter auto-hide, optional auth token-version validation, 429 limits, community cursor pagination, and sync `@expyrico/shared` vendored dist.

<!-- Updated: Red Team Review Round 2 - Added distinct reporter auto-hide, database-validated optionalAuth, separate create/patch body schemas for null clearing, and universal 60/min read limits -->

## Requirements

### Functional
- **Prisma Schema & Migration (`api/prisma/schema.prisma`)**:
  - Add composite indexes to `model Review`:
    ```prisma
    @@index([status, score(sort: Desc), id(sort: Desc)])
    @@index([status, createdAt(sort: Desc), id(sort: Desc)])
    ```
- **Distinct Reporter Auto-Hide (`api/src/services/reports/repository.ts`)**:
  - In `maybeAutoHide`:
    ```typescript
    const distinctReporters = await db.report.groupBy({
      by: ['reporterId'],
      where: { targetType, targetId, status: 'open' },
    });
    if (distinctReporters.length >= autoHideReportThreshold) {
      // Auto-hide target
    }
    ```
- **Database-Validated Optional Auth (`api/src/plugins/auth.ts`)**:
  - Implement `app.decorate('optionalAuth', async (req, reply) => { ... })`:
    - If `authorization` header is present:
      - Verify access token signature.
      - Query user in database: verify `user.status === 'active'` and `user.tokenVersion === payload.tokenVersion`.
      - If user revoked/inactive: clear `req.user` or fail closed (never grant authenticated privileges to revoked tokens).
- **Separate Create and Patch Body Schemas (`packages/shared/src/schemas/review.ts`)**:
  - `reviewCreateSchema`:
    ```typescript
    body: z.string().trim().max(2000).transform((v) => (v.length === 0 ? null : v)).optional()
    ```
  - `reviewPatchSchema`:
    ```typescript
    body: z.string().trim().max(2000).nullable().transform((v) => (v === null || v.length === 0 ? null : v)).optional()
    ```
- **BullMQ Recalc Queue (`api/src/queues/jobs/product-rating-recalc.ts`)**:
  - In `enqueueProductRatingRecalc(productId)`:
    - Remove fixed `jobId: product-rating-recalc-${productId}`.
    - Set `removeOnComplete: 100`, `removeOnFail: 100`.
- **Review Status Recalculation Coverage**:
  - `api/src/routes/reviews/update.ts`: Trigger `enqueueProductRatingRecalc` on any rating change, body presence change, or status change. Guard with atomic update checking `status !== 'deleted'`.
  - `api/src/routes/admin/reviews/status.ts`: Await `enqueueProductRatingRecalc(review.productId)` on admin status update.
  - `api/src/services/reports/repository.ts`: Await `enqueueProductRatingRecalc(review.productId)` on auto-hide.
  - `api/src/routes/admin/reports/resolve.ts`: Await `enqueueProductRatingRecalc(review.productId)` on report resolution.
- **Authoritative Own Review Endpoint (`GET /v1/products/:id/my-review`)**:
  - Route: `api/src/routes/reviews/my-review.ts` registered in `api/src/routes/reviews/index.ts`.
  - Requires auth (`onRequest: app.requireAuth`).
  - Returns `toApiReview(review)` if exists for caller and product, else `null`.
- **Server-Side Self-Vote Prevention (`api/src/routes/reviews/helpful.ts`)**:
  - Compare `review.userId === req.user.id`.
  - If match: throw `AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Cannot vote on your own review' })`.
- **Idempotency on Review Creation (`api/src/routes/reviews/create.ts`)**:
  - Add `config: { idempotent: 'required', rateLimit: reviewWriteRateLimit }`.
- **Implement Community Reviews Route (`GET /v1/reviews/community`)**:
  - Use `onRequest: app.optionalAuth`.
  - Query reviews where `status = 'visible'`, `body != null`, and `product.status = 'active'`.
  - Keyset cursor pagination with `id` tie-breaker (`[score, id]` or `[createdAt, id]`).
  - Includes both `user` and `product` relations.

### Security & Rate Limiting Mandate
- Central rate limits in `api/src/routes/reviews/rate-limits.ts`:
  - `reviewReadRateLimit`: 60/min.
  - `reviewWriteRateLimit`: 15/min.
  - `reviewVoteRateLimit`: 30/min.
- Applied across all review routes.

## Related Code Files
- Modify: `api/src/queues/jobs/product-rating-recalc.ts`
- Modify: `api/src/routes/reviews/update.ts`
- Modify: `api/src/routes/reviews/helpful.ts`
- Modify: `api/src/routes/reviews/create.ts`
- Modify: `api/src/routes/admin/reviews/status.ts`
- Modify: `api/src/routes/admin/reports/resolve.ts`
- Modify: `api/src/services/reports/repository.ts`
- Modify: `api/src/plugins/auth.ts`
- Modify: `packages/shared/src/schemas/review.ts`
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260904160000_add_community_reviews_indexes/migration.sql`
- Create: `api/src/routes/reviews/my-review.ts`
- Create: `api/src/routes/reviews/community.ts`
- Create: `api/src/routes/reviews/rate-limits.ts`
- Modify: `api/src/routes/reviews/index.ts`
- Modify: `api/src/routes/reviews/my-reviews.ts`
- Modify: `api/src/services/reviews/repository.ts`
- Create: `api/tests/integration/reviews-community.test.ts`
- Create: `api/tests/integration/reviews-rate-limits.test.ts`

## Success Criteria
- [ ] Auto-hide counts distinct `reporterId` values, preventing single-user duplicate report auto-hiding.
- [ ] Optional auth validates database `tokenVersion` and active status when Bearer tokens are provided.
- [ ] `reviewPatchSchema` accepts `null` and normalizes blank strings to `null`, correctly clearing comments and decrementing `reviewCount`.
- [ ] BullMQ recalculation queue allows successive jobs for the same product without deduplication drops.
- [ ] Review edits, admin moderation, and report auto-hide all trigger product tally recalculation with zero drift.
- [ ] `GET /v1/products/:id/my-review` returns authoritative review for current user.
- [ ] Self-voting is rejected by the server with 403 Forbidden.
- [ ] Prisma migration applies global composite indexes.
- [ ] `GET /v1/reviews/community` returns active community reviews with deterministic cursor pagination.
- [ ] All review endpoints enforce configured rate limits with passing 429 tests.
