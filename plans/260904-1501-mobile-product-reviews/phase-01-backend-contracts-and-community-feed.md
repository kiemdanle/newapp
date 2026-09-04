---
phase: 1
title: "Backend Contracts, Migration, Transactional Durability, and Security Hardening"
status: pending
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Backend Contracts, Migration, Transactional Durability, and Security Hardening

## Overview
Implement the backend foundation required by the mobile review system, resolving critical queue durability, concurrent vote recount races, status drift across admin/report paths, empty-string counting, report abuse vulnerabilities, public DTO sanitization, and credential validation identified in red-team review:
1. **Transactional Product Tally Durability (`api/src/services/reviews/product-tallies.ts`)**:
   - Instead of fire-and-forget Redis enqueue that permanently loses recalculations during Redis outages or races immediate mobile refetches, review mutations (`create.ts`, `update.ts`) and moderation actions execute tally updates within the same database transaction using `SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`.
   - Recomputes `buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, `ratingCount`, and `reviewCount` atomically in Postgres so `useProduct(id)` immediately observes fresh counters upon commit.
2. **Vote Recount Concurrency Serialization (`api/src/services/reviews/repository.ts`)**:
   - In `recomputeReviewScore`, execute `SELECT id FROM reviews WHERE id = ${reviewId}::uuid FOR UPDATE` inside the transaction before running `groupBy`. This serializes concurrent votes on the same review and prevents stale snapshot overwrites.
3. **Prisma Database Migration**:
   - Add composite indexes on `Review` for catalog-wide filtering and sorting:
     `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
   - **Database-Enforced Concurrency-Safe Report Dedup**: Add a partial unique index on `reports` in `migration.sql`:
     ```sql
     CREATE UNIQUE INDEX IF NOT EXISTS "reports_open_per_reporter_target_idx"
     ON "reports" ("reporter_id", "target_type", "target_id")
     WHERE "status" = 'open';
     ```
     In `api/src/routes/reports/create.ts`, catch Prisma unique constraint violation (`P2002`) and map to `409 CONFLICT`, preventing concurrent duplicate reports.
4. **Distinct Reporter Auto-Hide (`api/src/services/reports/repository.ts`)**:
   - In `maybeAutoHide`, count distinct `reporterId` values where `status in ['open', 'resolved']`. Auto-hide is strictly triggered when `distinctReporters.length > AUTO_HIDE_REPORT_THRESHOLD` (on the 4th distinct reporter, preserving spec §2.8 threshold).
5. **Product Visibility Gate on Review Lists (`api/src/routes/reviews/list-for-product.ts`)**: Call `getVisibleProduct(actor, productId)` before querying reviews. Return 404 for draft, pending, or report-hidden products unless caller has authorized access.
6. **Sanitized Public Review DTO (`packages/shared/src/schemas/review.ts` & `api/src/services/reviews/repository.ts`)**:
   - Public review responses omit the top-level internal `userId`, projecting `author: { id, firstName, avatarUrl }` and `isOwnReview: boolean`.
7. **Thumbs-Up Only API Contract (`api/src/routes/reviews/helpful.ts`)**:
   - Restrict `POST /v1/reviews/:id/helpful` to `{ helpful: true }` (or no body).
   - Use `DELETE /v1/reviews/:id/helpful` to remove votes.
   - Eliminate hidden downvoting from the public API.
   - Enforce server check `review.userId !== req.user.id` (`403 FORBIDDEN`).
8. **Database-Validated Optional Auth (`api/src/plugins/auth.ts`)**: Add an `app.optionalAuth` preHandler that validates `tokenVersion` and active account status against the database whenever a Bearer token is provided on public feeds (`/products/:id/reviews`, `/reviews/community`).
9. **Separate Create & Patch Body Schemas (`packages/shared/src/schemas/review.ts`)**:
   - `reviewCreateSchema`: accepts optional string, normalizes empty/whitespace to `null`.
   - `reviewPatchSchema`: accepts `string | null | undefined`, where `undefined` preserves existing body, and `null` (or empty string) normalizes to `null` to clear the comment and decrement `reviewCount`.
10. **Authoritative Own Review Route (`GET /v1/products/:id/my-review`)**: Provide a dedicated endpoint in `api/src/routes/reviews/my-review.ts` returning `{ review: Review | null }`.
11. **Idempotency on Review Creation**: Enable `config: { idempotent: 'required', rateLimit: reviewWriteRateLimit }` in `create.ts`.
12. **Shared Review Schema Expansion**: Extend the shared `Review` contract to include optional lightweight `product` projection (`id`, `name`, `brand`, `imageUrl`).
13. **Personal Reviews Route Projection**: Update `api/src/services/reviews/repository.ts` and `api/src/routes/reviews/my-reviews.ts` (`GET /v1/me/reviews`) to select `product` information.
14. **Community Reviews Feed Endpoint**: Implement `GET /v1/reviews/community` in `api/src/routes/reviews/community.ts` supporting deterministic keyset pagination (composite cursor with `id` tie-breaker), sorting (`score` vs `new`), profanity-filter visibility rules (`status: 'visible'`), active-product constraints, and viewer `myVote` projection.
15. **Universal Rate Limiting**: Apply explicit 60/min limit on reads, 15/min on write mutations, and 30/min on voting.
16. **Testing & Vendored Sync**: Add integration tests covering transactional tally updates, concurrent vote row locking, distinct reporter auto-hide, duplicate report rejection, product-visibility gating, thumbs-up only voting, optional auth token-version validation, 429 limits, and sync `@expyrico/shared` vendored dist.

<!-- Updated: Red Team Review Round 5 - Added transactional product tally updates with SELECT FOR UPDATE on products, vote recount row locking with SELECT FOR UPDATE on reviews, and full 15-finding critical/high alignment -->

## Requirements

### Functional
- **Transactional Product Tallies (`api/src/services/reviews/product-tallies.ts`)**:
  - Export `syncProductRatingTallies(tx: Prisma.TransactionClient, productId: string): Promise<void>`:
    ```typescript
    await tx.$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
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
  - Executed inside the transaction for `createReviewRoute`, `updateReviewRoute`, admin review status changes, and report auto-hide.
- **Vote Recount Row Locking (`api/src/services/reviews/repository.ts`)**:
  - In `recomputeReviewScore(db: Db, reviewId: string)`:
    - Execute `await db.$executeRaw`SELECT id FROM reviews WHERE id = ${reviewId}::uuid FOR UPDATE`;` before `db.reviewVote.groupBy`.
    - Guarantees sequential, race-free recalculation of `helpfulCount` and Wilson score during concurrent voting bursts.
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
- **Product Visibility Gating (`api/src/routes/reviews/list-for-product.ts`)**:
  - Check product visibility via `getVisibleProduct` before querying reviews.
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
  - Validates `tokenVersion` and active account status against database when Bearer header is present.
- **Separate Create and Patch Body Schemas (`packages/shared/src/schemas/review.ts`)**:
  - `reviewCreateSchema`: normalizes empty/whitespace to `null`.
  - `reviewPatchSchema`: accepts `string | null | undefined`, where `null` explicitly clears body and `undefined` preserves.
- **Authoritative Own Review Endpoint (`GET /v1/products/:id/my-review`)**:
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
- Create: `api/src/services/reviews/product-tallies.ts`
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
- [ ] Product tallies update transactionally inside review writes with `SELECT FOR UPDATE` on `Product`, guaranteeing zero Redis outage data loss and immediate refetch freshness.
- [ ] Vote recalculation executes `SELECT FOR UPDATE` on `Review`, ensuring race-free vote counts under concurrent bursts.
- [ ] Partial unique index `reports_open_per_reporter_target_idx` prevents concurrent duplicate open reports, returning 409 Conflict.
- [ ] Auto-hide counts distinct `reporterId` values across `open` and `resolved` reports, strictly requiring $>3$ distinct reporters.
- [ ] Review lists on draft/hidden products reject with 404 via `getVisibleProduct`.
- [ ] Helpful endpoint supports thumbs-up only and rejects author self-voting with 403.
- [ ] Public review DTO sanitizes top-level internal user IDs.
- [ ] Optional auth validates database `tokenVersion` and active status when Bearer tokens are provided.
- [ ] `reviewPatchSchema` accepts `null` to clear comments and decrement `reviewCount`.
- [ ] Review edits, admin moderation, and report auto-hide all trigger product tally recalculation with zero drift.
- [ ] `GET /v1/products/:id/my-review` returns authoritative review for current user.
- [ ] Prisma migration applies global composite indexes.
- [ ] `GET /v1/reviews/community` returns active community reviews with deterministic cursor pagination.
- [ ] All review endpoints enforce configured rate limits with passing 429 tests.
