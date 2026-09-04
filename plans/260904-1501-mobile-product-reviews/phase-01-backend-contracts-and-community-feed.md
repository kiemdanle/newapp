---
phase: 1
title: "Backend Contracts, Product Projection, Community Feed, and Universal Rate Limiting"
status: pending
priority: P1
effort: "4-5h"
dependencies: []
---

# Phase 1: Backend Contracts, Product Projection, Community Feed, and Universal Rate Limiting

## Overview
Implement the backend foundation required by the mobile review screens and enforce the platform's security mandate requiring rate limiting on all API endpoints:
1. Extend the shared `Review` contract in `packages/shared/src/schemas/review.ts` to include optional lightweight `product` projection (`id`, `name`, `brand`, `imageUrl`).
2. Update `api/src/services/reviews/repository.ts` and `api/src/routes/reviews/my-reviews.ts` (`GET /v1/me/reviews`) to include product information so personal review history cards can display what product was reviewed.
3. Implement a dedicated community reviews feed endpoint `GET /v1/reviews/community` in `api/src/routes/reviews/community.ts` supporting keyset pagination, sorting (`score` vs `new`), profanity-filter visibility rules (`status: 'visible'`), active-product constraints, and viewer `myVote` projection.
4. **Universal Rate Limiting (Security Mandate)**: Add explicit `config.rateLimit` configurations across ALL review routes (read endpoints: 60/min, write mutations: 15/min, voting: 30/min). Currently, `create.ts`, `list-for-product.ts`, `my-reviews.ts`, and `update.ts` lack rate limits.
5. Add comprehensive backend integration tests in `api/tests/integration/reviews-community.test.ts`, update `api/tests/integration/my-reviews.test.ts`, and add 429 rate limit test coverage across all review route groups.
6. Build and sync `@expyrico/shared` vendored dist to `apps/mobile/local-packages/@expyrico/shared/dist/`.

## Requirements

### Functional
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
  - Sorting:
    - `sort === 'score'`: `orderBy: [{ score: 'desc' }, { createdAt: 'desc' }]`
    - `sort === 'new'`: `orderBy: [{ createdAt: 'desc' }]`
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
- Create: `api/tests/integration/reviews-community.test.ts`
- Create: `api/tests/integration/reviews-rate-limits.test.ts`
- Vendored Sync: `apps/mobile/local-packages/@expyrico/shared/dist/`

## Implementation Steps

1. **Update Shared Schemas**:
   - In `packages/shared/src/schemas/review.ts`:
     - Add `product` object projection to `reviewSchema`.
     - Define `communityReviewListQuerySchema`.
   - Build packages/shared: `pnpm --filter @expyrico/shared build`.
   - Copy dist to `apps/mobile/local-packages/@expyrico/shared/dist/`.
   - Verify with `node scripts/check-vendored-shared-dist.mjs`.

2. **Define Rate Limits & Apply Across All Routes**:
   - Create `api/src/routes/reviews/rate-limits.ts` exporting read, write, and vote rate limit configs.
   - Attach rate limit configs to:
     - `create.ts`: `app.post('/products/:id/reviews', { onRequest: app.requireAuth, config: { rateLimit: reviewWriteRateLimit } })`
     - `update.ts`: `app.patch('/reviews/:id', { onRequest: app.requireAuth, config: { rateLimit: reviewWriteRateLimit } })` and `app.delete`
     - `list-for-product.ts`: `app.get('/products/:id/reviews', { config: { rateLimit: reviewReadRateLimit } })`
     - `my-reviews.ts`: `app.get('/me/reviews', { onRequest: app.requireAuth, config: { rateLimit: reviewReadRateLimit } })`
     - `helpful.ts`: use shared `reviewVoteRateLimit`.

3. **Update `api/src/services/reviews/repository.ts`**:
   - Update `ReviewWithAuthor` type to include optional `product`:
     ```typescript
     type ReviewWithAuthorAndProduct = Review & {
       user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
       product?: Pick<Product, 'id' | 'name' | 'brand' | 'imageUrl'> | null;
     };
     ```
   - In `toApiReview(r, opts)`:
     ```typescript
     if (r.product) {
       out.product = {
         id: r.product.id,
         name: r.product.name,
         brand: r.product.brand ?? null,
         imageUrl: r.product.imageUrl ?? null,
       };
     }
     ```

4. **Update `api/src/routes/reviews/my-reviews.ts`**:
   - Add `product: { select: { id: true, name: true, brand: true, imageUrl: true } }` to `prisma.review.findMany` include.

5. **Implement `api/src/routes/reviews/community.ts`**:
   - Register route `GET /reviews/community` with `reviewReadRateLimit`.
   - Parse `communityReviewListQuerySchema`.
   - Query reviews where `status = 'visible'`, `body != null`, and `product.status = 'active'`.
   - If authenticated viewer, resolve `myVotes` map.
   - Return `{ items, cursor }`.
   - Register in `api/src/routes/reviews/index.ts`.

6. **Integration Tests**:
   - In `api/tests/integration/my-reviews.test.ts`:
     - Assert `res.json().items[0].product` contains `id`, `name`, `brand`, `imageUrl`.
   - In `api/tests/integration/reviews-community.test.ts`:
     - Test sorting by score and by newest.
     - Test that reviews with `status: 'hidden'` are excluded.
     - Test that reviews for inactive/draft products are excluded.
     - Test pagination cursor.
     - Test that authenticated viewer receives populated `myVote`.
   - In `api/tests/integration/reviews-rate-limits.test.ts`:
     - Test that exceeding rate limits returns 429 for read, write, and vote route groups.

## Success Criteria
- [ ] `packages/shared` exports expanded `reviewSchema` and builds cleanly.
- [ ] Vendored shared dist check exits with code 0.
- [ ] `GET /v1/me/reviews` returns `product` metadata on every item.
- [ ] `GET /v1/reviews/community` is live, tested, and returns active community reviews.
- [ ] **Every review route has explicit rate limiting configured** per security mandates.
- [ ] 429 integration tests pass across read, write, and vote route groups.
- [ ] All new and existing API integration tests pass 100%.

## Risk Assessment
- **Risk**: Rate limits interfere with rapid end-to-end integration tests.
- **Mitigation**: Use independent IPs or mock test auth tokens per test case; integration test runner sets high limits in `.env.test` while testing rate limit logic directly in dedicated test.
