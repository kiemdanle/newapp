---
phase: 1
title: "Database Schema & Shared Contracts Migration to 1–5 Star Rating"
status: pending
priority: P1
effort: "6h"
dependencies: []
---

# Phase 1: Database Schema & Shared Contracts Migration to 1–5 Star Rating

## Overview
Migrate `@expyrico/shared` review DTO contracts and the backend Prisma PostgreSQL database schema from the tri-state recommendation enum (`buy_again`, `buy_again_on_sale`, `wont_buy`) to a numeric 1-to-5 star rating model (`stars Int`), safely backfilling historical review records and updating product aggregate tallies.

## Requirements
- Functional:
  - Update `packages/shared/src/schemas/review.ts`:
    - Define `reviewStarsSchema = z.number().int().min(1).max(5)`.
    - Update `reviewSchema`, `reviewCreateSchema`, and `reviewPatchSchema` to use `stars: reviewStarsSchema` (with backwards-compatibility aliases during transition if needed).
    - Remove or deprecate `reviewRatingSchema` and `ReviewRating`.
  - Update `packages/shared/src/schemas/product.ts`:
    - Add `averageRating: z.number().min(0).max(5)` and `ratingCount: z.number().int().nonnegative()`.
    - Remove/deprecate `buyAgainCount`, `buyAgainOnSaleCount`, and `wontBuyCount`.
  - Update `api/prisma/schema.prisma`:
    - Add `stars Int @default(5) @db.SmallInt` to `model Review`.
    - Add `averageRating Decimal @default(0) @db.Decimal(3, 2) @map("average_rating")` to `model Product`.
    - Create Prisma migration with backfill:
      ```sql
      ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "stars" SMALLINT NOT NULL DEFAULT 5;
      UPDATE "reviews" SET "stars" = 5 WHERE "rating" = 'buy_again';
      UPDATE "reviews" SET "stars" = 3 WHERE "rating" = 'buy_again_on_sale';
      UPDATE "reviews" SET "stars" = 1 WHERE "rating" = 'wont_buy';
      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "average_rating" DECIMAL(3, 2) NOT NULL DEFAULT 0.00;
      ```
  - Update `api/src/services/reviews/product-tallies.ts`:
    - Compute `ratingCount` (count of visible reviews) and `averageRating` (`AVG(stars)` rounded to 2 decimals).
    - Update `Product` record in transaction.
  - Update `api/src/services/reviews/repository.ts`:
    - `toApiReview` maps `stars: r.stars`.
  - Update `api/src/routes/reviews/create.ts` and `update.ts`:
    - Validate `{ stars: number, body?: string }` via `reviewCreateSchema`.
- Non-functional:
  - Zero data loss: existing reviews must be accurately mapped (buy_again -> 5, on_sale -> 3, wont_buy -> 1).
  - High concurrency safety: lock product for review mutations (`lockProductForReviewMutation`) preserved.
  - Typecheck passes across `@expyrico/shared` and `api`.

## Architecture
- `packages/shared/src/schemas/review.ts`:
  - Central authoritative contract for review creation, retrieval, and updates.
- `api/src/services/reviews/product-tallies.ts`:
  - Aggregation engine computing product rating stats (`ratingCount`, `averageRating`).
- `api/prisma/migrations/*`:
  - PostgreSQL schema and data migration adding `stars` and `average_rating`.

## Related Code Files
- Modify:
  - `packages/shared/src/schemas/review.ts`
  - `packages/shared/src/schemas/product.ts`
  - `api/prisma/schema.prisma`
  - `api/src/services/reviews/product-tallies.ts`
  - `api/src/services/reviews/repository.ts`
  - `api/src/routes/reviews/create.ts`
  - `api/src/routes/reviews/update.ts`
  - `api/src/services/products/serializer.ts`
  - `api/tests/helpers/factories.ts`
  - `api/tests/integration/reviews-create.test.ts`
  - `api/tests/integration/reviews-update.test.ts`

## Implementation Steps
1. Update shared schemas in `packages/shared/src/schemas/review.ts` and build `@expyrico/shared`.
2. Sync shared dist into mobile: `pnpm --filter @expyrico/shared build && cp -r packages/shared/dist apps/mobile/local-packages/@expyrico/shared/`.
3. Update `api/prisma/schema.prisma` with `stars` and `averageRating` fields and generate Prisma client (`npx prisma generate`).
4. Apply migration script with backfill SQL.
5. Update `product-tallies.ts`, `repository.ts`, `create.ts`, and `update.ts` to consume and output `stars`.
6. Update backend unit and integration tests.
7. Run `pnpm --filter @expyrico/shared typecheck && pnpm --filter api test`.

## Success Criteria
- [ ] Prisma schema and database include `stars` on `Review` and `averageRating` on `Product`.
- [ ] Historical reviews are successfully backfilled to star values (5, 3, 1).
- [ ] `POST /v1/products/:id/reviews` accepts `{ stars: 4, body: "Great!" }` and persists `stars: 4`.
- [ ] `recomputeAndSyncProductTallies` accurately calculates average rating and rating count.
- [ ] All backend review integration tests pass.

## Risk Assessment
- **Risk**: Existing client requests sending legacy `rating: 'buy_again'` during rolling deployment.
  - **Mitigation**: Support optional `stars` and fallback translation in `reviewCreateSchema` / route handlers during transition so neither old nor new clients break.
