---
phase: 2
title: "Backend API Tallies, Serialization & Routes"
status: pending
priority: P1
effort: "4h"
dependencies: ["1"]
---

# Phase 2: Backend API Tallies, Serialization & Routes

## Overview
Update backend review processing, tally aggregation, route validation, and response serialization to operate exclusively on the 3-option recommendation rating (`buy_again`, `buy_again_on_sale`, `wont_buy`) without computing or requiring star ratings.
<!-- Updated: Validation Session 1 - Clean removal of stars and averageRating from backend tallies -->
<!-- Updated: Validation Session 2 - Product merge recomputes tallies from reviews table -->

## Requirements
- Functional:
  - `POST /products/:id/reviews` accepts `{ rating: ReviewRating, body?: string }`, persists the review, and recomputes product recommendation tallies.
  - `PATCH /reviews/:id` accepts `{ rating?: ReviewRating, body?: string }` and updates tallies atomically within a transaction.
  - `toApiReview` guarantees `rating: ReviewRating` is non-null on all API responses.
  - `recomputeAndSyncProductTallies` groups visible reviews by `rating` to update `buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, `ratingCount`, and `reviewCount`.
  - `GET /products/:id/reviews` supports optional `rating` filter parameter (`buy_again`, `buy_again_on_sale`, `wont_buy`).
- Non-functional:
  - Strict deadlock prevention: maintain strict lock ordering (`SELECT ... FOR UPDATE` on `products` before mutating reviews or updating tallies).
  - Fast aggregation using indexed queries on `(productId, status)`.

## Architecture
```
Review Mutation Flow:
  1. Client sends POST /products/:id/reviews with { rating: 'buy_again', body: '...' }
  2. Route validates req.body with reviewCreateSchema
  3. Inside Prisma transaction:
       a. Lock product: SELECT id FROM products WHERE id = :productId FOR UPDATE
       b. Insert Review record with rating = input.rating
       c. recomputeAndSyncProductTallies:
            - GROUP BY rating WHERE productId = :id AND status = 'visible'
            - Count buy_again, buy_again_on_sale, wont_buy
            - UPDATE products SET buy_again_count = ..., rating_count = ...
  4. Return toApiReview with { rating: 'buy_again', ... }
```

## Related Code Files
- Modify: `api/src/services/reviews/product-tallies.ts`
- Modify: `api/src/services/reviews/repository.ts`
- Modify: `api/src/routes/reviews/create.ts`
- Modify: `api/src/routes/reviews/update.ts`
- Modify: `api/src/routes/reviews/list.ts`
- Modify: `api/src/services/products/serializer.ts`
- Modify: `api/src/services/products/search.ts`
- Modify: `api/src/services/admin/merge.ts`
- Modify: `api/tests/helpers/factories.ts`
- Modify: `api/tests/unit/schemas-review.test.ts`
- Modify: `api/tests/unit/products-serializer.test.ts`
- Modify: `api/tests/unit/errors.test.ts`

## Implementation Steps
1. In `api/src/services/reviews/product-tallies.ts`:
   - Simplify aggregation: group visible reviews by `rating` and count total ratings.
   - Update `products` row with `buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, `ratingCount`, and `reviewCount`.
   - Remove `_avg: { stars: true }` and `averageRating` calculations.
2. In `api/src/services/reviews/repository.ts`:
   - In `toApiReview`: assign `rating: r.rating ?? 'buy_again'`.
   - Remove `stars` field from `toApiReview` output entirely.
3. In `api/src/routes/reviews/create.ts`:
   - Parse `input = reviewCreateSchema.parse(req.body)`: `rating` is required.
   - Insert into DB: `rating: input.rating, body: input.body ?? null`.
4. In `api/src/routes/reviews/update.ts`:
   - Parse `patch = reviewPatchSchema.parse(req.body)`.
   - Update `rating: patch.rating`, `body: patch.body`.
5. In `api/src/routes/reviews/list-for-product.ts`:
   - Support `query.rating` filter: when passed, add `where.rating = query.rating`.
6. In `api/src/services/admin/merge.ts`:
   - Verify product merge invokes `await recomputeAndSyncProductTallies(tx, resolvedTargetId);` within the merge transaction to recalculate exact recommendation counts from all visible reviews on the target product.
7. Update test factories and unit tests:
   - `factories.ts`: default review factory uses `rating: 'buy_again'`.
   - `schemas-review.test.ts`: test validation of `rating` and absence of `stars`.
   - `products-serializer.test.ts`: verify serialized tallies.

## Success Criteria
- [x] `POST /products/:id/reviews` accepts `{ rating: 'buy_again' }` and rejects payload without `rating`.
- [x] Product tallies (`buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`) update accurately upon review creation and edit.
- [x] `toApiReview` returns `rating: 'buy_again' | 'buy_again_on_sale' | 'wont_buy'` without errors.
- [x] All API unit and integration tests pass cleanly (`pnpm --filter api test`).

## Risk Assessment
- **Risk:** Product search SQL or merge queries reference legacy columns or fail on null values.
  - *Observable signal:* Search or merge endpoint test failures.
  - *Mitigation:* Explicitly verify `api/src/services/products/search.ts` and `api/src/services/admin/merge.ts`.
