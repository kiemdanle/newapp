---
phase: 1
title: "Backend Contracts, Migration, Tally Drift Fix, Community Feed, and Universal Rate Limiting"
status: pending
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Backend Contracts, Migration, Tally Drift Fix, Community Feed, and Universal Rate Limiting

## Overview
Implement the backend foundation required by the mobile review screens and enforce the platform's security, data integrity, and performance mandates:
1. **Prisma Database Migration**: Add dedicated global composite indexes on `Review` for high-performance catalog-wide filtering and sorting:
   `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])`.
2. **Review Edit Tally Drift Fix (`api/src/routes/reviews/update.ts`)**: Currently, review PATCH only enqueues rating recalculation when `rating` changes. Fix this bug so `enqueueProductRatingRecalc` is enqueued whenever `rating`, `body` presence (null <-> text), or `status` (clean <-> hidden via profanity filter) changes, preventing tally drift.
3. **Shared Review Schema Expansion**: Extend the shared `Review` contract in `packages/shared/src/schemas/review.ts` to include optional lightweight `product` projection (`id`, `name`, `brand`, `imageUrl`).
4. **Personal Reviews Route Projection**: Update `api/src/services/reviews/repository.ts` and `api/src/routes/reviews/my-reviews.ts` (`GET /v1/me/reviews`) to include product information so personal review history cards can display what product was reviewed.
5. **Community Reviews Feed Endpoint**: Implement `GET /v1/reviews/community` in `api/src/routes/reviews/community.ts` supporting deterministic keyset pagination (composite cursor with `id` tie-breaker), sorting (`score` vs `new`), profanity-filter visibility rules (`status: 'visible'`), active-product constraints, and viewer `myVote` projection.
6. **Universal Rate Limiting (Security Mandate)**: Add explicit `config.rateLimit` configurations across ALL review routes (read endpoints: 60/min, write mutations: 15/min, voting: 30/min). Currently, `create.ts`, `list-for-product.ts`, `my-reviews.ts`, and `update.ts` lack rate limits.
7. **Testing & Vendored Sync**: Add backend integration tests in `api/tests/integration/reviews-community.test.ts`, update `api/tests/integration/my-reviews.test.ts`, add tally drift transition tests in `api/tests/integration/reviews-update.test.ts`, add 429 rate limit coverage in `api/tests/integration/reviews-rate-limits.test.ts`, and sync `@expyrico/shared` vendored dist.

<!-- Updated: Validation Session 1 - Added Prisma migration for global review indexes, deterministic cursor pagination, review edit tally drift fix in update.ts, universal rate limits, and simplified sorting to score/new -->

## Requirements

### Functional
- **Prisma Schema & Migration (`api/prisma/schema.prisma`)**:
  - Add composite indexes to `model Review`:
    ```prisma
    @@index([status, score(sort: Desc), id(sort: Desc)])
    @@index([status, createdAt(sort: Desc), id(sort: Desc)])
    ```
  - Run migration: `pnpm --filter @expyrico/api exec prisma migrate dev --name add_community_reviews_indexes`.
- **Review Edit Tally Recalculation Fix (`api/src/routes/reviews/update.ts`)**:
  - Replace conditional check `if (input.rating !== undefined && input.rating !== existing.rating)` with comprehensive check:
    ```typescript
    const ratingChanged = input.rating !== undefined && input.rating !== existing.rating;
    const bodyPresenceChanged = input.body !== undefined && ((input.body === null || input.body.trim().length === 0) !== (existing.body === null || existing.body.trim().length === 0));
    const statusChanged = status !== existing.status;

    if (ratingChanged || bodyPresenceChanged || statusChanged) {
      await enqueueProductRatingRecalc(existing.productId);
    }
    ```
  - Ensures `reviewCount` and recommendation tallies never desynchronize on edits.
- **Shared Review Schema Expansion (`packages/shared/src/schemas/review.ts`)**:
  - Add `product` field to `reviewSchema`:
    ```typescript
    product: z.object({
      id: z.string().uuid(),
      name: z.string(),
      brand: z.string().nullable(),
      imageUrl: z.string().url().nullable(),
    }).optional()
    ```
  - Add query & response schemas:
    ```typescript
    export const communityReviewListQuerySchema = z.object({
      sort: z.enum(['score', 'new']).default('score'),
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    });
    export type CommunityReviewListQuery = z.infer<typeof communityReviewListQuerySchema>;
    ```
- **Update Personal Reviews Route (`GET /v1/me/reviews`)**:
  - In `api/src/routes/reviews/my-reviews.ts`:
    - Update Prisma query `include`:
      ```typescript
      include: {
        user: { select: { id: true, firstName: true, avatarUrl: true } },
        product: { select: { id: true, name: true, brand: true, imageUrl: true } },
      }
      ```
    - Pass `r.product` into `toApiReview(r)`.
- **Implement Community Reviews Route (`GET /v1/reviews/community`)**:
  - Route: `api/src/routes/reviews/community.ts` registered in `api/src/routes/reviews/index.ts`.
  - Rate limiting: standard read rate limit (`max: 60, timeWindow: '1 minute'`).
  - Auth: optional auth (publicly readable; if `req.user` exists, projects `myVote`).
  - Query filters:
    - Only reviews where `status === 'visible'` (excludes profanity-flagged `hidden` reviews and `deleted` reviews).
    - Only reviews whose target product is `status: 'active'` (excludes private/draft/deleted products).
    - Only reviews with written comments (`body !== null`) so community feed features meaningful reviews.
  - Sorting & Deterministic Pagination:
    - `sort === 'score'`: `orderBy: [{ score: 'desc' }, { id: 'desc' }]`. Cursor encodes `[score, id]` in base64url string.
    - `sort === 'new'`: `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`. Cursor encodes `[createdAt, id]` in base64url string.
  - Returns `{ items: Review[], cursor: string | null }`.

### Security & Rate Limiting Mandate
- Define central rate limits in `api/src/routes/reviews/rate-limits.ts`:
  ```typescript
  export const reviewReadRateLimit = { max: 60, timeWindow: '1 minute' } as const;
  export const reviewWriteRateLimit = { max: 15, timeWindow: '1 minute' } as const;
  export const reviewVoteRateLimit = { max: 30, timeWindow: '1 minute' } as const;
  ```
- Apply to every review route:
  - `POST /v1/products/:id/reviews`: `config: { rateLimit: reviewWriteRateLimit }`
  - `PATCH /v1/reviews/:id`: `config: { rateLimit: reviewWriteRateLimit }`
  - `DELETE /v1/reviews/:id`: `config: { rateLimit: reviewWriteRateLimit }`
  - `GET /v1/products/:id/reviews`: `config: { rateLimit: reviewReadRateLimit }`
  - `GET /v1/me/reviews`: `config: { rateLimit: reviewReadRateLimit }`
  - `GET /v1/reviews/community`: `config: { rateLimit: reviewReadRateLimit }`
  - `POST/DELETE /v1/reviews/:id/helpful`: `config: { rateLimit: reviewVoteRateLimit }`

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260904160000_add_community_reviews_indexes/migration.sql`
- Modify: `packages/shared/src/schemas/review.ts`
- Modify: `api/src/services/reviews/repository.ts`
- Create: `api/src/routes/reviews/rate-limits.ts`
- Modify: `api/src/routes/reviews/create.ts`
- Modify: `api/src/routes/reviews/list-for-product.ts`
- Modify: `api/src/routes/reviews/my-reviews.ts`
- Modify: `api/src/routes/reviews/update.ts`
- Modify: `api/src/routes/reviews/helpful.ts`
- Modify: `api/src/routes/reviews/index.ts`
- Create: `api/src/routes/reviews/community.ts`
- Modify: `api/tests/integration/my-reviews.test.ts`
- Modify: `api/tests/integration/reviews-update.test.ts`
- Create: `api/tests/integration/reviews-community.test.ts`
- Create: `api/tests/integration/reviews-rate-limits.test.ts`
- Vendored Sync: `apps/mobile/local-packages/@expyrico/shared/dist/`

## Implementation Steps

1. **Add Prisma Composite Indexes & Migration**:
   - Add `@@index([status, score(sort: Desc), id(sort: Desc)])` and `@@index([status, createdAt(sort: Desc), id(sort: Desc)])` to `model Review` in `api/prisma/schema.prisma`.
   - Generate migration and verify with `pnpm --filter @expyrico/api exec prisma migrate deploy`.

2. **Fix Tally Drift in `api/src/routes/reviews/update.ts`**:
   - Enqueue `enqueueProductRatingRecalc` whenever rating changes, body presence changes, or status changes.

3. **Update Shared Schemas**:
   - In `packages/shared/src/schemas/review.ts`:
     - Add `product` object projection to `reviewSchema`.
     - Define `communityReviewListQuerySchema` (`sort`: `'score' | 'new'`).
   - Build packages/shared: `pnpm --filter @expyrico/shared build`.
   - Copy dist to `apps/mobile/local-packages/@expyrico/shared/dist/`.
   - Verify with `node scripts/check-vendored-shared-dist.mjs`.

4. **Define Rate Limits & Apply Across All Routes**:
   - Create `api/src/routes/reviews/rate-limits.ts` exporting read, write, and vote rate limit configs.
   - Attach rate limit configs to all endpoints in `create.ts`, `update.ts`, `list-for-product.ts`, `my-reviews.ts`, `community.ts`, and `helpful.ts`.

5. **Update `api/src/services/reviews/repository.ts`**:
   - Update `ReviewWithAuthor` type to include optional `product`.
   - Map `out.product = { id, name, brand, imageUrl }` when `r.product` exists.

6. **Update `api/src/routes/reviews/my-reviews.ts`**:
   - Add `product: { select: { id: true, name: true, brand: true, imageUrl: true } }` to `prisma.review.findMany` include.

7. **Implement `api/src/routes/reviews/community.ts`**:
   - Register route `GET /reviews/community` with `reviewReadRateLimit`.
   - Parse `communityReviewListQuerySchema`.
   - Query reviews where `status = 'visible'`, `body != null`, and `product.status = 'active'`.
   - Keyset cursor pagination with `id` tie-breaker.
   - If authenticated viewer, resolve `myVotes` map.
   - Return `{ items, cursor }`.
   - Register in `api/src/routes/reviews/index.ts`.

8. **Integration Tests**:
   - In `api/tests/integration/reviews-update.test.ts`:
     - Test clean -> hidden transition (profanity added in edit) recalculates product tallies.
     - Test hidden -> visible transition (profanity removed in edit) recalculates product tallies.
     - Test rating-only -> written comment transition recalculates `reviewCount`.
     - Test written comment -> empty transition recalculates `reviewCount`.
   - In `api/tests/integration/my-reviews.test.ts`:
     - Assert `res.json().items[0].product` contains `id`, `name`, `brand`, `imageUrl`.
   - In `api/tests/integration/reviews-community.test.ts`:
     - Test sorting by score and by newest with deterministic cursor pagination.
     - Test that reviews with `status: 'hidden'` are excluded.
     - Test that reviews for inactive/draft products are excluded.
     - Test that authenticated viewer receives populated `myVote`.
   - In `api/tests/integration/reviews-rate-limits.test.ts`:
     - Test that exceeding rate limits returns 429 for read, write, and vote route groups.

## Success Criteria
- [ ] Database migration successfully adds composite indexes for global review queries.
- [ ] Review edits (`update.ts`) reliably trigger product tally recalculation across all 4 transition states (clean<->hidden, rating-only<->written).
- [ ] `packages/shared` exports expanded `reviewSchema` and builds cleanly.
- [ ] Vendored shared dist check exits with code 0.
- [ ] `GET /v1/me/reviews` returns `product` metadata on every item.
- [ ] `GET /v1/reviews/community` is live, tested, and returns active community reviews with deterministic cursor pagination.
- [ ] **Every review route has explicit rate limiting configured** per security mandates.
- [ ] 429 integration tests pass across read, write, and vote route groups.
- [ ] All new and existing API integration tests pass 100%.

## Risk Assessment
- **Risk**: Keyset pagination with duplicate scores causes missed or duplicate items between pages.
- **Mitigation**: Compound `[score, id]` tie-breaker ordering with indexed `id(sort: Desc)` ensures 100% deterministic pagination across page boundaries.
