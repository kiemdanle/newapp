---
phase: 1
title: "Backend Contracts, Migration, Security Hardening, Community Feed, and Universal Rate Limiting"
status: pending
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Backend Contracts, Migration, Security Hardening, Community Feed, and Universal Rate Limiting

## Overview
Implement the backend foundation required by the mobile review system, resolving critical queue deduplication, status drift across admin/report paths, empty-string counting, report abuse vulnerabilities, public DTO sanitization, and credential validation identified in red-team review:
1. **Prisma Database Migration**:
   - Add composite indexes on `Review` for catalog-wide filtering and sorting:
     `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
   - **Database-Enforced Concurrency-Safe Report Dedup**: Add a partial unique index on `reports` in `migration.sql`:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS "reports_open_per_reporter_target_idx"
     ON "reports" ("reporter_id", "target_type", "target_id")
     WHERE "status" = 'open';
     ```
     In `api/src/routes/reports/create.ts`, catch Prisma unique constraint violation (`P2002`) and map to `409 CONFLICT`, preventing concurrent duplicate reports.
2. **Distinct Reporter Auto-Hide (`api/src/services/reports/repository.ts`)**:
   - In `maybeAutoHide`, count distinct `reporterId` values where `status in ['open', 'resolved']`. Auto-hide is strictly triggered when `distinctReporters.length > AUTO_HIDE_REPORT_THRESHOLD` (on the 4th distinct reporter, preserving spec §2.8 threshold).
3. **Product Visibility Gate on Review Lists (`api/src/routes/reviews/list-for-product.ts`)**: Call `getVisibleProduct(actor, productId)` before querying reviews. Return 404 for draft, pending, or report-hidden products unless caller has authorized access.
4. **Sanitized Public Review DTO (`packages/shared/src/schemas/review.ts` & `api/src/services/reviews/repository.ts`)**:
   - Public review responses omit the top-level internal `userId`, projecting `author: { id, firstName, avatarUrl }` and `isOwnReview: boolean`.
5. **Thumbs-Up Only API Contract (`api/src/routes/reviews/helpful.ts`)**:
   - Restrict `POST /v1/reviews/:id/helpful` to `{ helpful: true }` (or no body).
   - Use `DELETE /v1/reviews/:id/helpful` to remove votes.
   - Eliminate hidden downvoting from the public API.
   - Enforce server check `review.userId !== req.user.id` (`403 FORBIDDEN`).
6. **Database-Validated Optional Auth (`api/src/plugins/auth.ts`)**: Add an `app.optionalAuth` preHandler that validates `tokenVersion` and active account status against the database whenever a Bearer token is provided on public feeds (`/products/:id/reviews`, `/reviews/community`).
7. **Separate Create & Patch Body Schemas (`packages/shared/src/schemas/review.ts`)**:
   - `reviewCreateSchema`: accepts optional string, normalizes empty/whitespace to `null`.
   - `reviewPatchSchema`: accepts `string | null | undefined`, where `undefined` preserves existing body, and `null` (or empty string) normalizes to `null` to clear the comment and decrement `reviewCount`.
8. **Recalc Queue Deduplication Fix (`api/src/queues/jobs/product-rating-recalc.ts`)**: Remove the fixed deterministic `jobId: product-rating-recalc-${productId}` so BullMQ never drops subsequent rating updates for the same product.
9. **Universal Status Recalculation Coverage**: Trigger `enqueueProductRatingRecalc(productId)` across all review status transition points:
   - Author edit/delete in `api/src/routes/reviews/update.ts` (when rating, body presence, or status changes, with atomic check against resurrecting soft-deleted reviews).
   - Admin review moderation in `api/src/routes/admin/reviews/status.ts:13-18` (when status changes).
   - Abuse report resolution in `api/src/routes/admin/reports/resolve.ts:18-21` and auto-hide in `api/src/services/reports/repository.ts:47-50`.
10. **Authoritative Own Review Route (`GET /v1/products/:id/my-review`)**: Provide a dedicated endpoint in `api/src/routes/reviews/my-review.ts` returning `{ review: Review | null }`.
11. **Idempotency on Review Creation**: Enable `config: { idempotent: 'required', rateLimit: reviewWriteRateLimit }` in `create.ts`.
12. **Shared Review Schema Expansion**: Extend the shared `Review` contract to include optional lightweight `product` projection (`id`, `name`, `brand`, `imageUrl`).
13. **Personal Reviews Route Projection**: Update `api/src/services/reviews/repository.ts` and `api/src/routes/reviews/my-reviews.ts` (`GET /v1/me/reviews`) to select `product` information.
14. **Community Reviews Feed Endpoint**: Implement `GET /v1/reviews/community` in `api/src/routes/reviews/community.ts` supporting deterministic keyset pagination (composite cursor with `id` tie-breaker), sorting (`score` vs `new`), profanity-filter visibility rules (`status: 'visible'`), active-product constraints, and viewer `myVote` projection.
15. **Universal Rate Limiting**: Apply explicit 60/min limit on reads, 15/min on write mutations, and 30/min on voting.
16. **Testing & Vendored Sync**: Add integration tests covering distinct reporter auto-hide, concurrent duplicate report rejection, product-visibility gating, thumbs-up only voting, optional auth token-version validation, 429 limits, and sync `@expyrico/shared` vendored dist.

<!-- Updated: Red Team Review Round 4 - Added database-enforced partial unique index on open reports (reports_open_per_reporter_target_idx) with P2002 -> 409 mapping for concurrency safety -->

## Requirements

### Functional
- **Prisma Schema & Migration (`api/prisma/schema.prisma`)**:
  - Add composite indexes to `model Review`:
    ```prisma
    @@index([status, score(sort: Desc), id(sort: Desc)])
    @@index([status, createdAt(sort: Desc), id(sort: Desc)])
    ```
  - In `migration.sql`:
    ```sql
    CREATE UNIQUE INDEX IF NOT EXISTS "reports_open_per_reporter_target_idx"
    ON "reports" ("reporter_id", "target_type", "target_id")
    WHERE "status" = 'open';
    ```
- **Database-Enforced Duplicate Open Report Rejection (`api/src/routes/reports/create.ts`)**:
  - Catch Prisma `P2002` error on report create:
    ```typescript
    try {
      const report = await prisma.report.create({ data: { ... } });
      await maybeAutoHide(report.targetType, report.targetId);
      return reply.status(201).send(toApiReport(report));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.CONFLICT,
          title: 'You have already submitted an open report for this content',
        });
      }
      throw err;
    }
    ```
- **Distinct Reporter Auto-Hide (`api/src/services/reports/repository.ts`)**:
  - In `maybeAutoHide`:
    ```typescript
    const distinctReporters = await prisma.report.groupBy({
      by: ['reporterId'],
      where: { targetType, targetId, status: { in: ['open', 'resolved'] } },
    });
    if (distinctReporters.length <= AUTO_HIDE_REPORT_THRESHOLD) return { hidden: false };
    ```
- **Product Visibility Gating (`api/src/routes/reviews/list-for-product.ts`)**:
  - Check product visibility before querying:
    ```typescript
    const product = await getVisibleProduct({ id: req.user?.id, role: req.user?.role ?? 'user' }, productId);
    if (!product) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    }
    ```
- **Thumbs-Up Only Voting (`api/src/routes/reviews/helpful.ts`)**:
  - In `POST /reviews/:id/helpful`:
    - Enforce `review.userId !== req.user.id` (`403 FORBIDDEN`).
    - Validate `{ helpful: z.literal(true).optional().default(true) }`.
    - Upsert `reviewVote` with `value: 'helpful'`.
  - In `DELETE /reviews/:id/helpful`:
    - Delete vote for caller and review.
- **Sanitized Public Review DTO (`packages/shared/src/schemas/review.ts`)**:
  - Public review item schema exposes `author: { id, firstName, avatarUrl }`, `isOwnReview: boolean`, and omits top-level `userId`.
- **Database-Validated Optional Auth (`api/src/plugins/auth.ts`)**:
  - Implement `app.decorate('optionalAuth', async (req, reply) => { ... })`:
    - If `authorization` header is present:
      - Verify access token signature.
      - Query user in database: verify `user.status === 'active'` and `user.tokenVersion === payload.tokenVersion`.
      - If user revoked/inactive: clear `req.user` or fail closed.
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
- Modify: `api/src/routes/reviews/list-for-product.ts`
- Modify: `api/src/routes/reports/create.ts`
- Modify: `api/src/services/reports/repository.ts`
- Modify: `api/src/routes/admin/reviews/status.ts`
- Modify: `api/src/routes/admin/reports/resolve.ts`
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
- Modify: `api/tests/integration/reviews-helpful.test.ts`
- Modify: `api/tests/integration/reports-create.test.ts`

## Success Criteria
- [ ] Partial unique index `reports_open_per_reporter_target_idx` prevents concurrent duplicate open reports, returning 409 Conflict.
- [ ] Auto-hide counts distinct `reporterId` values across `open` and `resolved` reports, strictly requiring $>3$ distinct reporters.
- [ ] Review lists on draft/hidden products reject with 404 via `getVisibleProduct`.
- [ ] Helpful endpoint supports thumbs-up only and rejects author self-voting with 403.
- [ ] Public review DTO sanitizes top-level internal user IDs.
- [ ] Optional auth validates database `tokenVersion` and active status when Bearer tokens are provided.
- [ ] `reviewPatchSchema` accepts `null` to clear comments and decrement `reviewCount`.
- [ ] BullMQ recalculation queue allows successive jobs for the same product without deduplication drops.
- [ ] Review edits, admin moderation, and report auto-hide all trigger product tally recalculation with zero drift.
- [ ] `GET /v1/products/:id/my-review` returns authoritative review for current user.
- [ ] Prisma migration applies global composite indexes.
- [ ] `GET /v1/reviews/community` returns active community reviews with deterministic cursor pagination.
- [ ] All review endpoints enforce configured rate limits with passing 429 tests.
