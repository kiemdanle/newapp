---
title: Restore buy again rating and remove stars
date: 2026-09-13
summary: "Reverted 1-to-5 star ratings back to tri-state recommendation model across database, API, mobile, and admin"
---

# Restore buy again rating and remove stars

Reverted 1-to-5 star ratings back to tri-state recommendation model across database, API, mobile, and admin.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Motivation

Per product requirement changes, the previous decision to streamline reviews to a standard 1-to-5 star system was reversed in favor of the friction-free, tri-state recommendation model:
- `Buy again` (Top pick / Positive recommendation)
- `Buy on sale` (Worth deal at discount / Positive recommendation)
- `Won't buy` (Pass on it / Negative recommendation)

Star ratings and decimal averages have been removed entirely across all review DTOs, API endpoints, mobile UI elements, and admin console screens.

## Key Changes by Domain

### 1. Database & Schema
- Added migration `20260913090000_restore_review_rating_remove_stars`:
  - Backfilled historical reviews where `rating IS NULL` using `stars` (`stars >= 4 -> buy_again`, `stars = 3 -> buy_again_on_sale`, `stars <= 2 -> wont_buy`).
  - Set `reviews.rating` to `NOT NULL`.
  - Dropped constraint `reviews_stars_check` and column `stars` from `reviews`.
  - Dropped column `average_rating` from `products`.
- Updated `api/prisma/schema.prisma` to reflect non-nullable `rating ReviewRating` and removal of `stars` and `averageRating`.
- Regenerated Prisma client and applied migration to local `pantry` and `pantry_test` databases.

### 2. Shared Contracts (`@expyrico/shared`)
- Updated `packages/shared/src/schemas/review.ts`:
  - `reviewSchema`: requires `rating: reviewRatingSchema`, dropped `stars`.
  - `reviewCreateSchema`: requires `rating`, optional `body` (trimmed, max 2000), no `stars`.
  - `reviewPatchSchema`: optional `rating`, optional `body`, no `stars`.
  - `reviewListQuerySchema`: optional `rating` filter.
  - Exported canonical `REVIEW_RATING_METADATA` mapping each rating to its label, sublabel, and icon.
- Rebuilt `@expyrico/shared` and synchronized dist to `apps/mobile/local-packages/@expyrico/shared/dist/` and verified with `check-vendored-shared-dist.mjs`.

### 3. Backend API (`api`)
- `recomputeAndSyncProductTallies`: computes `buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, and `ratingCount` via `groupBy({ by: ['rating'] })`. Dropped `_avg: { stars: true }` and `averageRating`.
- `serializer.ts`: dropped `averageRating` from product serialization.
- `search.ts`: removed `average_rating` from raw SQL projection.
- `repository.ts`: `toApiReview` directly maps `rating: r.rating` without star fallbacks.
- `create.ts` & `update.ts`: accept and validate `rating`, removed `stars`.
- `list-for-product.ts`: supports `query.rating` filter.
- `admin/analytics.ts`: dropped `byStars` aggregation and `starDistribution`; retains `buyAgainPct`, `buyAgainOnSalePct`, `wontBuyPct`.

### 4. Mobile Application (`apps/mobile`)
- `review.tsx`:
  - Removed 1-to-5 star selector card, `stars` state, and star handlers.
  - Restored Tri-State Recommendation Card using `REVIEW_BADGE_CONFIG` based on canonical `REVIEW_RATING_METADATA`.
  - Styled with Expyrico palette: Fresh Sage (`#4BAE8A`/`#D6F0E6`/`#3A8F6F`), Honey (`#F5A623`/`#FEEFC3`/`#2C2C28`), and Pebble (`#8C8C85`/`#F0F0ED`/`#2C2C28`).
- `reviews.tsx`:
  - Replaced star pills with recommendation filter pills (`All`, `Buy again`, `Buy on sale`, `Won't buy`).
  - Replaced star score hero with recommendation sentiment score (`% recommend`) and breakdown pills.
- `[id].tsx`:
  - Replaced star row under product title with community sentiment (`👍 X% recommend · N ratings`) and personal recommendation badge (`[✓ Buy again] (You)`).
- `ReviewCard.tsx` & `MyReviewCard.tsx`:
  - Replaced star indicators with recommendation badges using `REVIEW_BADGE_CONFIG`.
- `ProductReviewsSection.tsx`:
  - Displays recommendation percentage `((buyAgain + buySale) / total) * 100`, breakdown chips, and encouraging empty state on unreviewed items.
- `ProductCommunityCard.tsx` & `CommunityReviewsFeed.tsx`:
  - Uses recommendation badges in review previews and sorts groups by `recommendPercent`.

### 5. Admin Console (`apps/admin`)
- `reviews/page.tsx`:
  - Table header updated to `Sentiment / Rating` rendering color-coded recommendation badges.
  - Filter updated to `Purchase Sentiment` (`buy_again`, `buy_again_on_sale`, `wont_buy`).
- `reviews/[id]/page.tsx`:
  - Detail header renders recommendation label from `REVIEW_RATING_METADATA`.

## Verification & Proof

- `@expyrico/shared`: 13 test files, 196 tests passing (100%).
- `@expyrico/api`: 28 unit test files (166 tests) + all 7 review integration suites (37 tests) passing (100%).
- `@expyrico/admin`: 16 test files, 80 tests passing (100%).
- `@expyrico/mobile`: 6 review test suites (39 tests) passing (100%).
- Typechecks: 0 errors across `@expyrico/shared`, `@expyrico/api`, `@expyrico/mobile`, `@expyrico/admin`.
- Android APK: Built debug APK via local Gradle toolchain (`apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, 82MB).
- Code Review: Reviewed by `code-reviewer` subagent; all warnings addressed and resolved.
