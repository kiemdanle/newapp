---
phase: 1
title: "Shared Schemas & Database Contracts"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Shared Schemas & Database Contracts

## Overview
Establish the foundational data contracts across `@expyrico/shared` and the PostgreSQL database by restoring `rating` (`buy_again`, `buy_again_on_sale`, `wont_buy`) as the mandatory primary review rating attribute and completely dropping `stars` and `average_rating` columns from the database schema and active review contracts.
<!-- Updated: Validation Session 1 - Drop stars and average_rating columns completely -->

## Requirements
- Functional:
  - `ReviewRating` enum (`buy_again`, `buy_again_on_sale`, `wont_buy`) must be enforced as the required rating attribute on all new reviews.
  - Historical reviews in the database must be backfilled to ensure `rating IS NOT NULL` (mapping any existing `stars >= 4 -> buy_again`, `stars = 3 -> buy_again_on_sale`, `stars <= 2 -> wont_buy`).
  - `@expyrico/shared` must export updated `reviewSchema`, `reviewCreateSchema`, `reviewPatchSchema`, and `reviewListQuerySchema` reflecting `rating` as the primary rating field.
  - `Product` contract retains `buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, and `ratingCount`.
- Non-functional:
  - Clean schema cutover: drop `stars` column from `reviews` and `average_rating` from `products` after backfilling `rating` to guarantee zero schema ambiguity.
  - Strict type safety with 0 TypeScript compilation errors in `@expyrico/shared` and consumers.

## Architecture
```
Review Model (PostgreSQL):
  id: UUID (PK)
  userId: UUID
  productId: UUID
  rating: ReviewRating NOT NULL   <-- Reinstated as primary mandatory rating
  body: Text?
  status: ReviewStatus

Shared Zod Schemas (@expyrico/shared):
  reviewRatingSchema: z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy'])
  reviewCreateSchema: z.object({
    rating: reviewRatingSchema,
    body: z.string().trim().max(2000).nullish(),
  })
  reviewPatchSchema: z.object({
    rating: reviewRatingSchema.optional(),
    body: z.union([z.string().trim().max(2000), z.null()]).optional(),
  })
```

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `api/prisma/migrations/20260913090000_restore_review_rating_remove_stars/migration.sql`
- Modify: `packages/shared/src/schemas/review.ts`
- Modify: `packages/shared/src/schemas/product.ts`
- Modify: `packages/shared/src/index.ts`

## Implementation Steps
1. In `api/prisma/schema.prisma`:
   - Set `rating ReviewRating` (non-nullable).
   - Drop `stars` field from `Review` model.
   - Drop `averageRating` field from `Product` model.
2. Create PostgreSQL migration `20260913090000_restore_review_rating_remove_stars`:
   - Backfill: `UPDATE reviews SET rating = CASE WHEN stars >= 4 THEN 'buy_again'::"review_rating" WHEN stars = 3 THEN 'buy_again_on_sale'::"review_rating" ELSE 'wont_buy'::"review_rating" END WHERE rating IS NULL;`
   - Apply constraint: `ALTER TABLE "reviews" ALTER COLUMN "rating" SET NOT NULL;`
   - Drop check constraint: `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_stars_check";`
   - Drop column: `ALTER TABLE "reviews" DROP COLUMN IF EXISTS "stars";`
   - Drop column: `ALTER TABLE "products" DROP COLUMN IF EXISTS "average_rating";`
3. In `packages/shared/src/schemas/review.ts`:
   - Update `reviewSchema`: make `rating: reviewRatingSchema` required, remove `stars` field completely.
   - Update `reviewCreateSchema`: require `rating: reviewRatingSchema`, optional `body`, remove mandatory `stars` validation and transforms.
   - Update `reviewPatchSchema`: optional `rating: reviewRatingSchema`, optional `body`.
   - Update `reviewListQuerySchema`: optional filter `rating: reviewRatingSchema.optional()`.
   - Export canonical `REVIEW_RATING_METADATA` mapping each `ReviewRating` option to its canonical label, sublabel, and icon.
4. Build `@expyrico/shared` via `pnpm --filter @expyrico/shared build` and sync build outputs to `apps/mobile/local-packages/@expyrico/shared/`.
5. Run Prisma generate: `pnpm --filter api exec prisma generate`.

## Success Criteria
- [x] Prisma schema reflects `rating ReviewRating` (non-null) and completely removes `stars` from `Review` and `averageRating` from `Product`.
- [x] Database migration executes cleanly against local PostgreSQL `pantry` and `pantry_test`.
- [x] `reviewCreateSchema` accepts `{ rating: 'buy_again' }` and rejects `{ stars: 5 }` without rating.
- [x] `@expyrico/shared` builds with 0 errors and type definitions are synced to mobile workspace.

## Risk Assessment
- **Risk:** Existing tests or callers passing `{ stars: 5 }` fail schema validation.
  - *Observable signal:* Type errors or schema validation 400s during test runs.
  - *Mitigation:* Update API routes and test factories in Phase 2 before mobile/admin UI cutover.
