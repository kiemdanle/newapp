---
phase: 1
title: "Backend Contracts, Migration, Synchronous Tally Durability, and Security Hardening"
status: pending
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Backend Contracts, Migration, Synchronous Tally Durability, and Security Hardening

## Overview
Implement the backend foundation required by the mobile review system, resolving critical queue durability, concurrent vote recount races, status drift across admin/report paths, empty-string counting, report abuse vulnerabilities, public DTO sanitization, and credential validation identified in red-team review:
1. **Synchronous Product Tally Durability with Split Lock Helpers (`api/src/services/reviews/product-tallies.ts`)**:
   - To realize the exact lock -> mutate -> recompute order without race conditions or deadlocks, Phase 1 exports two discrete helper functions:
     - `lockProductForReviewMutation(tx: Prisma.TransactionClient, productId: string): Promise<void>`
     - `recomputeAndSyncProductTallies(tx: Prisma.TransactionClient, productId: string): Promise<void>`
   - Every review mutation (`createReviewRoute`, `updateReviewRoute`), admin moderation status change, and report auto-hiding executes:
     ```typescript
     await prisma.$transaction(async (tx) => {
       await lockProductForReviewMutation(tx, productId); // 1. Lock Product row FIRST
       const review = await tx.review.create({ ... });    // 2. Mutate Review row
       await recomputeAndSyncProductTallies(tx, productId); // 3. Recompute and write tallies on Product
       return review;
     });
     ```
   - Guarantees immediate consistency: when mobile refetches `useProduct(id)`, it reads 100% fresh tallies upon transaction commit.
2. **Clean BullMQ Queue Deletion**:
   - The uncoordinated background worker in `api/src/queues/jobs/product-rating-recalc.ts` is deleted completely.
   - Removed from `api/src/queues/index.ts:59` and `api/src/workers/runner.ts:39`, eliminating dead code and preventing uncoordinated background jobs from racing the synchronous transactional writer.
3. **Legacy `not_helpful` Vote Migration**:
   - In `migration.sql`:
     ```sql
     DELETE FROM "review_votes" WHERE "value" = 'not_helpful';
     ```
   - Cleans up legacy downvotes so database records reflect the thumbs-up only interaction model.
4. **ViewerId Serialization on All Endpoints (`api/src/services/reviews/repository.ts`)**:
   - `toApiReview(r, { viewerId, myVote })` computes `isOwnReview = Boolean(viewerId && r.userId === viewerId)`.
   - Explicitly passed in `create.ts`, `update.ts`, `my-review.ts`, `my-reviews.ts`, `list-for-product.ts`, and `community.ts`.
5. **Removal of Broken In-Memory `'rating'` Sort**:
   - In `packages/shared/src/schemas/review.ts`: update `reviewSortSchema = z.enum(['score', 'new']).default('score')` (removing `'rating'`).
   - In `api/src/routes/reviews/list-for-product.ts`: remove in-memory `items.sort()` block.
6. **Vote Recount Concurrency Serialization (`api/src/services/reviews/repository.ts`)**:
   - In `recomputeReviewScore`, execute `SELECT id FROM reviews WHERE id = ${reviewId}::uuid FOR UPDATE` inside the transaction before running `groupBy`. This serializes concurrent votes on the same review and prevents stale snapshot overwrites.
7. **Prisma Database Migration**:
   - Add composite indexes on `Review` for catalog-wide filtering and sorting:
     `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
   - **Database-Enforced Concurrency-Safe Report Dedup**: Add a partial unique index on `reports` in `migration.sql`:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS "reports_open_per_reporter_target_idx"
     ON "reports" ("reporter_id", "target_type", "target_id")
     WHERE "status" = 'open';
     ```
     In `api/src/routes/reports/create.ts`, catch Prisma unique constraint violation (`P2002`) and map to `409 CONFLICT`, preventing concurrent duplicate reports.
8. **Distinct Reporter Auto-Hide (`api/src/services/reports/repository.ts`)**:
   - In `maybeAutoHide`, count distinct `reporterId` values where `status in ['open', 'resolved']`. Auto-hide is strictly triggered when `distinctReporters.length > AUTO_HIDE_REPORT_THRESHOLD` (on the 4th distinct reporter, preserving spec §2.8 threshold).
9. **Product Visibility Gate on Review Lists (`api/src/routes/reviews/list-for-product.ts`)**: Call `getVisibleProduct(actor, productId)` before querying reviews. Return 404 for draft, pending, or report-hidden products unless caller has authorized access.
10. **Privacy-Hardened Public Review DTO (`packages/shared/src/schemas/review.ts` & `api/src/services/reviews/repository.ts`)**:
   - Public review responses omit both top-level `userId` AND `author.id` to completely eliminate user UUID harvesting and tracking.
   - Projects `author: { firstName: string, avatarUrl: string | null }` and a server-derived boolean `isOwnReview: boolean`.
11. **Thumbs-Up Only API Contract (`api/src/routes/reviews/helpful.ts`)**:
   - Restrict `POST /v1/reviews/:id/helpful` to `{ helpful: true }` (or no body).
   - Use `DELETE /v1/reviews/:id/helpful` to remove votes.
   - Eliminate hidden downvoting from the public API.
   - Enforce server check `review.userId !== req.user.id` (`403 FORBIDDEN`).
12. **Database-Validated Optional Auth (`api/src/plugins/auth.ts`)**: Add an `app.optionalAuth` preHandler that validates `tokenVersion` and active account status against the database whenever a Bearer token is provided on public feeds (`/products/:id/reviews`, `/reviews/community`).
13. **Separate Create & Patch Body Schemas (`packages/shared/src/schemas/review.ts`)**:
   - `reviewCreateSchema`: accepts optional string, normalizes empty/whitespace to `null`.
   - `reviewPatchSchema`: accepts `string | null | undefined`, where `undefined` preserves existing body, and `null` (or empty string) normalizes to `null` to clear the comment and decrement `reviewCount`.
14. **Authoritative Own Review Route (`GET /v1/products/:id/my-review`)**: Provide a dedicated endpoint in `api/src/routes/reviews/my-review.ts` returning `{ review: Review | null }`.
15. **Idempotency on Review Creation**: Enable `config: { idempotent: 'required', rateLimit: reviewWriteRateLimit }` in `create.ts`.
16. **Shared Review Schema Expansion**: Extend the shared `Review` contract to include optional lightweight `product` projection (`id`, `name`, `brand`, `imageUrl`).
17. **Personal Reviews Route Projection**: Update `api/src/services/reviews/repository.ts` and `api/src/routes/reviews/my-reviews.ts` (`GET /v1/me/reviews`) to select `product` information.
18. **Community Reviews Feed Endpoint**: Implement `GET /v1/reviews/community` in `api/src/routes/reviews/community.ts` supporting deterministic keyset pagination (composite cursor with `id` tie-breaker), sorting (`score` vs `new`), profanity-filter visibility rules (`status: 'visible'`), active-product constraints, and viewer `myVote` projection.
19. **Universal Rate Limiting**: Apply explicit 60/min limit on reads, 15/min on write mutations, and 30/min on voting.
20. **Testing & Vendored Sync**: Add integration tests covering synchronous tally updates with lock ordering, concurrent vote row locking, distinct reporter auto-hide, duplicate report rejection, product-visibility gating, thumbs-up only voting, optional auth token-version validation, 429 limits, and sync `@expyrico/shared` vendored dist.

<!-- Updated: Red Team Review Round 8 - Split lock and recompute helpers in product-tallies.ts, cleanly deleted uncoordinated BullMQ queue/worker, migrated legacy not_helpful votes, serialized viewerId across all routes, and removed broken in-memory 'rating' sort -->

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

    DELETE FROM "review_votes" WHERE "value" = 'not_helpful';
    ```
- **Privacy-Hardened Public Review DTO (`packages/shared/src/schemas/review.ts`)**:
  - In `reviewSchema`:
    - Omit top-level `userId` and `author.id`.
    - Project `author`:
      ```typescript
      author: z.object({
        firstName: z.string(),
        avatarUrl: z.string().url().nullable(),
      }).optional()
      ```
    - Project `isOwnReview: z.boolean().default(false)`.
  - In `toApiReview(r, { viewerId, myVote })`:
    - `out.isOwnReview = Boolean(viewerId && r.userId === viewerId)`.
    - `out.author = r.user ? { firstName: r.user.firstName, avatarUrl: r.user.avatarUrl } : undefined`.
- **Synchronous Product Tallies with Split Helpers (`api/src/services/reviews/product-tallies.ts`)**:
  - Export `lockProductForReviewMutation(tx: Prisma.TransactionClient, productId: string): Promise<void>`:
    ```typescript
    await tx.$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
    ```
  - Export `recomputeAndSyncProductTallies(tx: Prisma.TransactionClient, productId: string): Promise<void>`:
    ```typescript
    const byRating = await tx.review.groupBy({
      by: ['rating'],
      where: { productId, status: 'visible' },
      _count: { _all: true },
    });
    const tally = { buy_again: 0, buy_again_on_sale: 0, wont_buy: 0 };
    for (const row of byRating) tally[row.rating] = row._count._all;
    const ratingCount = tally.buy_again + tally.buy_again_on_sale + tally.wont_buy;
    const reviewCount = await tx.review.count({
      where: { productId, status: 'visible', body: { not: null } },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        buyAgainCount: tally.buy_again,
        buyAgainOnSaleCount: tally.buy_again_on_sale,
        wontBuyCount: tally.wont_buy,
        ratingCount,
        reviewCount,
      },
    });
    ```
- **BullMQ Queue Retirement**:
  - Delete `api/src/queues/jobs/product-rating-recalc.ts`.
  - Remove queue registration in `api/src/queues/index.ts:59`.
  - Remove worker spawn in `api/src/workers/runner.ts:39`.
- **Vote Recount Row Locking (`api/src/services/reviews/repository.ts`)**:
  - In `recomputeReviewScore(db: Db, reviewId: string)`:
    - Execute `await db.$executeRaw`SELECT id FROM reviews WHERE id = ${reviewId}::uuid FOR UPDATE`;` before `db.reviewVote.groupBy`.
- **Database-Enforced Duplicate Open Report Rejection (`api/src/routes/reports/create.ts`)**:
  - Catch Prisma `P2002` error on report create and map to `409 CONFLICT`.
- **Distinct Reporter Auto-Hide (`api/src/services/reports/repository.ts`)**:
  - In `maybeAutoHide`:
    ```typescript
    const distinctReporters = await prisma.report.groupBy({
      by: ['reporterId'],
      where: { targetType, targetId, status: { in: ['open', 'resolved'] } },
    });
    if (distinctReporters.length <= AUTO_HIDE_REPORT_THRESHOLD) return { hidden: false };
    ```
- **Type-Safe Product Visibility Gating (`api/src/routes/reviews/list-for-product.ts`)**:
  - If `req.user` exists:
    ```typescript
    const product = await getVisibleProduct({ id: req.user.id, role: req.user.role }, productId);
    if (!product) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    ```
  - If anonymous:
    ```typescript
    const raw = await prisma.product.findUnique({ where: { id: productId }, include: PRODUCT_INCLUDE });
    if (!raw) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    const canonical = await resolveCanonicalProduct(raw, prisma);
    if (canonical.status !== 'active') throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
    ```
- **Thumbs-Up Only Voting (`api/src/routes/reviews/helpful.ts`)**:
  - In `POST /reviews/:id/helpful`:
    - Enforce `review.userId !== req.user.id` (`403 FORBIDDEN`).
    - Validate `{ helpful: z.literal(true).optional().default(true) }`.
    - Upsert `reviewVote` with `value: 'helpful'`.
  - In `DELETE /reviews/:id/helpful`:
    - Delete vote for caller and review.
- **Database-Validated Optional Auth (`api/src/plugins/auth.ts`)**:
  - Validates `tokenVersion` and active account status against database when Bearer header is present.
- **Separate Create and Patch Body Schemas (`packages/shared/src/schemas/review.ts`)**:
  - `reviewCreateSchema`: normalizes empty/whitespace to `null`.
  - `reviewPatchSchema`: accepts `string | null | undefined`, where `null` explicitly clears body and `undefined` preserves.
- **Authoritative Own Review Endpoint (`GET /v1/products/:id/my-review`)**:
  - Returns `toApiReview(review, { viewerId: req.user!.id })` if exists for caller and product, else `null`.
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
- Create: `api/src/services/reviews/product-tallies.ts`
- Delete: `api/src/queues/jobs/product-rating-recalc.ts`
- Modify: `api/src/queues/index.ts`
- Modify: `api/src/workers/runner.ts`
- Modify: `api/src/services/reviews/repository.ts`
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
- Create: `api/tests/integration/reviews-community.test.ts`
- Create: `api/tests/integration/reviews-rate-limits.test.ts`
- Modify: `api/tests/integration/reviews-helpful.test.ts`
- Modify: `api/tests/integration/reports-create.test.ts`

## Success Criteria
- [ ] Product row is locked first via `lockProductForReviewMutation`, then Review is mutated, then tallies recomputed via `recomputeAndSyncProductTallies` within the same transaction.
- [ ] BullMQ queue and worker are deleted cleanly with zero orphaned references.
- [ ] Legacy `not_helpful` votes are cleaned up in migration.
- [ ] All endpoints pass `viewerId` to `toApiReview`, accurately generating `isOwnReview`.
- [ ] Broken in-memory `'rating'` sort is removed from shared schema and product review route.
- [ ] Vote recalculation executes `SELECT FOR UPDATE` on `Review`, ensuring race-free vote counts under concurrent bursts.
- [ ] Partial unique index `reports_open_per_reporter_target_idx` prevents concurrent duplicate open reports, returning 409 Conflict.
- [ ] Auto-hide counts distinct `reporterId` values across `open` and `resolved` reports, strictly requiring $>3$ distinct reporters.
- [ ] Review lists on draft/hidden products reject with 404 via type-safe visibility branching.
- [ ] Helpful endpoint supports thumbs-up only and rejects author self-voting with 403.
- [ ] Public review DTO sanitizes both top-level `userId` and `author.id`, projecting only `author: { firstName, avatarUrl }` and `isOwnReview: boolean`.
- [ ] Optional auth validates database `tokenVersion` and active status when Bearer tokens are provided.
- [ ] `reviewPatchSchema` accepts `null` to clear comments and decrement `reviewCount`.
- [ ] Review edits, admin moderation, and report auto-hide all trigger product tally recalculation with zero drift.
- [ ] `GET /v1/products/:id/my-review` returns authoritative review for current user.
- [ ] Prisma migration applies global composite indexes.
- [ ] `GET /v1/reviews/community` returns active community reviews with deterministic cursor pagination.
- [ ] All review endpoints enforce configured rate limits with passing 429 tests.
