---
phase: 1
title: "Backend Contracts, Migration, Recalc Queue Fix, Community Feed, and Universal Rate Limiting"
status: pending
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Backend Contracts, Migration, Recalc Queue Fix, Community Feed, and Universal Rate Limiting

## Overview
Implement the backend foundation required by the mobile review system, resolving critical queue deduplication, status drift across admin/report paths, empty-string counting, and performance bottlenecks identified in red-team review:
1. **Recalc Queue Deduplication Fix (`api/src/queues/jobs/product-rating-recalc.ts`)**: Remove the fixed deterministic `jobId: product-rating-recalc-${productId}`. BullMQ retains completed jobs (`removeOnComplete: 1000`), which causes subsequent rating updates for the same product to be silently dropped as duplicates. Allowing auto-generated unique job IDs ensures every review mutation reliably triggers product rating recalculation.
2. **Review Status Recalculation Coverage**: Trigger `enqueueProductRatingRecalc(productId)` in all review status transition points:
   - Author edit/delete in `api/src/routes/reviews/update.ts` (when rating, body presence, or status changes, with concurrency guard preventing resurrection of deleted reviews).
   - Admin review moderation in `api/src/routes/admin/reviews/status.ts:13-18` (when status changes).
   - Abuse report resolution in `api/src/routes/admin/reports/resolve.ts:18-21` and auto-hide in `api/src/services/reports/repository.ts:47-50`.
3. **Empty String Normalization**: In `packages/shared/src/schemas/review.ts` and `create.ts`/`update.ts`, normalize trimmed empty/whitespace `body` to `null`. This guarantees that `reviewCount` and community feed filters (`body != null`) accurately count only genuine written comments.
4. **Authoritative Own Review Route (`GET /v1/products/:id/my-review`)**: Provide a dedicated endpoint in `api/src/routes/reviews/my-review.ts` returning `{ review: Review | null }`. This allows the mobile review screen to authoritatively determine edit vs. create mode without paginated community feed scanning.
5. **Server-Side Self-Vote Prevention**: Enforce in `api/src/routes/reviews/helpful.ts` that `review.userId !== req.user.id`, throwing `403 FORBIDDEN` on self-votes.
6. **Idempotency on Review Creation**: Enable `config: { idempotent: 'required', rateLimit: reviewWriteRateLimit }` in `create.ts`.
7. **Prisma Database Migration**: Add dedicated global composite indexes on `Review`:
   `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
8. **Shared Review Schema Expansion**: Extend the shared `Review` contract to include optional lightweight `product` projection (`id`, `name`, `brand`, `imageUrl`).
9. **Personal Reviews Route Projection**: Update `api/src/services/reviews/repository.ts` and `api/src/routes/reviews/my-reviews.ts` (`GET /v1/me/reviews`) to select `product` information.
10. **Community Reviews Feed Endpoint**: Implement `GET /v1/reviews/community` in `api/src/routes/reviews/community.ts` supporting deterministic keyset pagination (composite cursor with `id` tie-breaker), sorting (`score` vs `new`), profanity-filter visibility rules (`status: 'visible'`), active-product constraints, and viewer `myVote` projection.
11. **Universal Rate Limiting (Security Mandate)**: Add explicit `config.rateLimit` configurations across ALL review routes (read endpoints: 60/min, write mutations: 15/min, voting: 30/min).
12. **Testing & Vendored Sync**: Add integration tests in `api/tests/integration/reviews-community.test.ts`, `api/tests/integration/reviews-rate-limits.test.ts`, update `my-reviews.test.ts` and `reviews-update.test.ts`, and sync `@expyrico/shared` vendored dist.

<!-- Updated: Red Team Review - Applied 6 accepted findings: BullMQ fixed jobId removal, universal status recalc coverage, empty-string normalization to null, server self-vote check (403), GET /v1/products/:id/my-review endpoint, and create route idempotency -->

## Requirements

### Functional
- **BullMQ Recalc Queue (`api/src/queues/jobs/product-rating-recalc.ts`)**:
  - In `enqueueProductRatingRecalc(productId)`:
    - Remove fixed `jobId: product-rating-recalc-${productId}`.
    - Set `removeOnComplete: 100`, `removeOnFail: 100`.
    - Every mutation schedules an independent recalculation job.
- **Review Status Recalculation Coverage**:
  - `api/src/routes/reviews/update.ts`: Trigger `enqueueProductRatingRecalc` on any rating change, body presence change, or status change. Guard with atomic update checking `status !== 'deleted'`.
  - `api/src/routes/admin/reviews/status.ts`: Await `enqueueProductRatingRecalc(review.productId)` on admin status update.
  - `api/src/services/reports/repository.ts`: Await `enqueueProductRatingRecalc(review.productId)` on auto-hide.
  - `api/src/routes/admin/reports/resolve.ts`: Await `enqueueProductRatingRecalc(review.productId)` on report resolution.
- **Empty String Normalization**:
  - In `packages/shared/src/schemas/review.ts`:
    - Define `bodyField = z.string().trim().max(2000).transform((v) => (v.length === 0 ? null : v)).optional()`.
  - In `createReviewRoute` and `updateReviewRoute`:
    - Ensure stored `body` is strictly `string` or `null`.
    - In PATCH: `null` explicitly clears body; `undefined` preserves existing body.
- **Authoritative Own Review Endpoint (`GET /v1/products/:id/my-review`)**:
  - Route: `api/src/routes/reviews/my-review.ts` registered in `api/src/routes/reviews/index.ts`.
  - Requires auth (`onRequest: app.requireAuth`).
  - Returns `toApiReview(review)` if exists for caller and product, else `null`.
- **Server-Side Self-Vote Prevention (`api/src/routes/reviews/helpful.ts`)**:
  - Compare `review.userId === req.user.id`.
  - If match: throw `AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Cannot vote on your own review' })`.
- **Idempotency on Review Creation (`api/src/routes/reviews/create.ts`)**:
  - Add `config: { idempotent: 'required', rateLimit: reviewWriteRateLimit }`.
- **Prisma Schema & Migration (`api/prisma/schema.prisma`)**:
  - Add composite indexes to `model Review`:
    ```prisma
    @@index([status, score(sort: Desc), id(sort: Desc)])
    @@index([status, createdAt(sort: Desc), id(sort: Desc)])
    ```
- **Implement Community Reviews Route (`GET /v1/reviews/community`)**:
  - Query reviews where `status = 'visible'`, `body != null`, and `product.status = 'active'`.
  - Keyset cursor pagination with `id` tie-breaker (`[score, id]` or `[createdAt, id]`).
  - Includes both `user` and `product` relations.

### Security & Rate Limiting Mandate
- Central rate limits in `api/src/routes/reviews/rate-limits.ts`:
  - `reviewReadRateLimit`: 60/min.
  - `reviewWriteRateLimit`: 15/min.
  - `reviewVoteRateLimit`: 30/min.

## Related Code Files
- Modify: `api/src/queues/jobs/product-rating-recalc.ts`
- Modify: `api/src/routes/reviews/update.ts`
- Modify: `api/src/routes/reviews/helpful.ts`
- Modify: `api/src/routes/reviews/create.ts`
- Modify: `api/src/routes/admin/reviews/status.ts`
- Modify: `api/src/routes/admin/reports/resolve.ts`
- Modify: `api/src/services/reports/repository.ts`
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
- [ ] BullMQ recalculation queue allows successive jobs for the same product without deduplication drops.
- [ ] Review edits, admin moderation, and report auto-hide all trigger product tally recalculation with zero drift.
- [ ] Empty or whitespace-only review text normalizes to `null`, correctly maintaining `reviewCount`.
- [ ] `GET /v1/products/:id/my-review` returns authoritative review for current user.
- [ ] Self-voting is rejected by the server with 403 Forbidden.
- [ ] Prisma migration applies global composite indexes.
- [ ] `GET /v1/reviews/community` returns active community reviews with deterministic cursor pagination.
- [ ] All review endpoints enforce configured rate limits with passing 429 tests.
