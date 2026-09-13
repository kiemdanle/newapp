---
title: "Restore 'Buy Again', 'Buy on Sale', and 'Won't Buy' Rating & Remove Stars Rating"
description: "Revert from 1-to-5 star ratings back to the tri-state recommendation model ('Buy again', 'Buy on sale', 'Won't buy') as the sole product review rating system across database schemas, shared DTOs, mobile submission and display components, and the admin moderation console."
status: completed
priority: P1
effort: "2d"
tags: ["reviews", "mobile", "api", "database", "admin", "ui-ux"]
created: 2026-09-13
---

# Restore 'Buy Again', 'Buy on Sale', and 'Won't Buy' Rating & Remove Stars Rating

## Overview

Previously, the review system was streamlined to eliminate the tri-state recommendation pills (`'Buy again'`, `'Buy on sale'`, `'Won't buy'`) in favor of a standard 1-to-5 star rating. 

Per current product requirements, that decision is reversed:
1. **Bring back** the three-option recommendation rating:
   - **`Buy again`** (Top pick / Positive recommendation)
   - **`Buy on sale`** (Worth it at a discount / Neutral-positive recommendation)
   - **`Won't buy`** (Pass on it / Negative recommendation)
2. **Remove** the 1-to-5 star rating entirely across all user-facing surfaces and API contracts.
3. **Keep ONLY** the `'Buy again'`, `'Buy on sale'`, and `'Won't buy'` rating model as the unified, friction-free way to rate products in Expyrico.

```
PREVIOUS (1-5 Stars Only):
  [ ★ ★ ★ ★ ★ ] Rate this product (1 to 5 stars)
  "4.3 out of 5 stars" · Star filter pills [5★] [4★] [3★] [2★] [1★]

NEW TARGET (Recommendation Only - Zero Stars):
  [ (✓) Buy again ]   [ ($) Buy on sale ]   [ (X) Won't buy ]
  "85% recommend" · Breakdown: 18 Buy again · 4 On sale · 2 Won't buy
  Recommendation filter pills: [All] [Buy again] [Buy on sale] [Won't buy]
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Update database schema & `@expyrico/shared` review contracts to make `rating` (`ReviewRating`) the mandatory primary rating field and sunset `stars` from review DTOs | P1 |
| 2 | Refactor backend API review tallies, serialization, and routes to compute and return recommendation counters (`buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`) | P1 |
| 3 | Overhaul mobile review creation form (`review.tsx`) by removing the 1-to-5 star selector and restoring the tri-state recommendation selector card with Expyrico palette styling | P1 |
| 4 | Update mobile review cards (`ReviewCard`, `MyReviewCard`, `ProductCommunityCard`) and screen headers (`[id].tsx`) to display recommendation badges and eliminate star indicators | P1 |
| 5 | Overhaul `ProductReviewsSection.tsx` and `reviews.tsx` to display recommendation percentages, counter pill rows, and recommendation filter tabs instead of star distribution | P1 |
| 6 | Adapt Admin review moderation console (`reviews/page.tsx`, `reviews/[id]/page.tsx`) and analytics to filter and display recommendation ratings | P2 |
| 7 | Update automated test suites across `@expyrico/shared`, `api`, `apps/mobile`, and `apps/admin` with 100% pass rate and zero TypeScript errors | P1 |

## Architecture & Data Flow

```
+-------------------------------------------------------------------------------+
|                            Database & Shared DTOs                             |
+-------------------------------------------------------------------------------+
|  reviews Table:                                                               |
|    - rating ReviewRating NOT NULL ('buy_again', 'buy_again_on_sale', 'wont_buy')
|    - stars column completely dropped from database and contracts              |
|                                                                               |
|  products Table:                                                              |
|    - buy_again_count INT NOT NULL DEFAULT 0                                   |
|    - buy_again_on_sale_count INT NOT NULL DEFAULT 0                           |
|    - wont_buy_count INT NOT NULL DEFAULT 0                                    |
|    - rating_count INT NOT NULL DEFAULT 0                                      |
|    - average_rating column completely dropped from database                   |
|  @expyrico/shared:                                                            |
|    - reviewRatingSchema: z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy'])   |
|    - reviewCreateSchema: requires rating: reviewRatingSchema, body?: string   |
|    - reviewPatchSchema: rating?: reviewRatingSchema, body?: string            |
|    - reviewSchema: rating: reviewRatingSchema (non-null)                       |
|                                                                               |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
|                        Mobile Review Submission Flow                          |
+-------------------------------------------------------------------------------+
|                                                                               |
|  apps/mobile/app/(app)/product/[id]/review.tsx:                               |
|    - REMOVE: 1 to 5 Star Selector Card, star press handlers, ratingToStars   |
|    - RESTORE: Tri-State Recommendation Selector Card                          |
|        * [Buy again]      -> Fresh Sage #4BAE8A / Mint Mist #D6F0E6           |
|        * [Buy on sale]    -> Honey #F5A623 / Soft Butter #FEEFC3              |
|        * [Won't buy]      -> Pebble #8C8C85 / Stone #F0F0ED                   |
|    - SUBMIT: { rating: ReviewRating, body?: string | null }                   |
|                                                                               |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
|                        Mobile Display & Feed Components                       |
+-------------------------------------------------------------------------------+
|                                                                               |
|  ReviewCard.tsx & MyReviewCard.tsx:                                           |
|    - REMOVE: Star row ([★ ★ ★ ★ ★]) & numeric score (5.0)                     |
|    - RENDER: Recommendation Badge pill (Buy again / Buy on sale / Won't buy)  |
|                                                                               |
|  ProductCommunityCard.tsx:                                                    |
|    - REMOVE: Star row in community feed preview                               |
|    - RENDER: Recommendation Badge pill                                        |
|                                                                               |
|  ProductReviewsSection.tsx & reviews.tsx:                                     |
|    - REMOVE: Star hero icon, "4.3 out of 5 stars", star filter pills [5★]...   |
|    - RENDER: Recommendation Hero (% recommend)                                |
|    - RENDER: Tally pills ("18 Buy again · 4 On sale · 2 Won't buy")           |
|    - FILTER: [All] [Buy again] [Buy on sale] [Won't buy]                      |
|                                                                               |
|  Product Detail Header (app/(app)/product/[id].tsx):                          |
|    - REMOVE: Star rating row under product title                              |
|    - RENDER: User's recommendation badge pill or aggregate recommendation %   |
|                                                                               |
+-------------------------------------------------------------------------------+
                                       |
                                       v
+-------------------------------------------------------------------------------+
|                        Admin Console & Moderation                             |
+-------------------------------------------------------------------------------+
|                                                                               |
|  apps/admin/src/app/(admin)/reviews/page.tsx:                                 |
|    - Filter: "Purchase Sentiment" (Buy again, Buy on sale, Won't buy)         |
|    - Table: Recommendation badge with Expyrico color tokens                   |
|                                                                               |
|  apps/admin/src/app/(admin)/reviews/[id]/page.tsx:                            |
|    - Recommendation Card with full badge and review body                      |
|                                                                               |
+-------------------------------------------------------------------------------+
```
## Advisory Resolutions & Architectural Hardening

### 1. Data Layer & Zero Half-State Guarantee
- **Issue:** Prevent database or API contracts from being left in an ambiguous or half-migrated state where `stars` and `rating` conflict or null ratings cause 500s.
- **Resolution:**
  - Database migration `20260913090000_restore_review_rating_remove_stars` executes an atomic 5-step transition:
    1. Backfill any historical reviews where `rating IS NULL` using `stars` (`stars >= 4 -> buy_again`, `stars = 3 -> buy_again_on_sale`, `stars <= 2 -> wont_buy`).
    2. Enforce `ALTER TABLE "reviews" ALTER COLUMN "rating" SET NOT NULL;`.
    3. Drop database constraint `ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_stars_check";`.
    4. Drop physical column `ALTER TABLE "reviews" DROP COLUMN IF EXISTS "stars";`.
    5. Drop physical column `ALTER TABLE "products" DROP COLUMN IF EXISTS "average_rating";`.
  - Server-side validation: `@expyrico/shared`'s `reviewCreateSchema` and `reviewPatchSchema` validate `rating: z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy'])` as the required rating field, eliminating dual-state transforms.

### 2. Canonical Surface Inventory (Commit `26a66d8` Diff Authority)
- **Authority:** Commit `26a66d8` (`feat(reviews): streamline review system to 1-to-5 star reviews only`) is the canonical reference diff. Every surface touched by `26a66d8` is systematically addressed in this plan:
  - **Prisma & DB:** `api/prisma/schema.prisma`, `api/prisma/migrations/`
  - **Shared Schemas:** `packages/shared/src/schemas/review.ts`, `packages/shared/src/schemas/product.ts`, `packages/shared/src/index.ts`
  - **API Routes:** `api/src/routes/reviews/create.ts`, `update.ts`, `list.ts`
  - **API Services:** `api/src/services/reviews/product-tallies.ts`, `repository.ts`, `api/src/services/products/serializer.ts`, `search.ts`, `api/src/services/admin/merge.ts`, `analytics.ts`
  - **Mobile Screens:** `apps/mobile/app/(app)/product/[id]/review.tsx`, `reviews.tsx`, `apps/mobile/app/(app)/product/[id].tsx`
  - **Mobile Features:** `apps/mobile/src/features/reviews/ReviewCard.tsx`, `MyReviewCard.tsx`, `ProductReviewsSection.tsx`, `ProductCommunityCard.tsx`
  - **Admin Pages:** `apps/admin/src/app/(admin)/reviews/page.tsx`, `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`, `apps/admin/src/lib/admin-api.ts`
  - **Automated Tests:** `api/tests/unit/schemas-review.test.ts`, `products-serializer.test.ts`, `errors.test.ts`, `api/tests/helpers/factories.ts`, `apps/mobile/tests/unit/api-reviews.test.tsx`, `product-review-screen.test.tsx`, `product-reviews-page.test.tsx`, `product-reviews-section.test.tsx`, `reviews-hub.test.tsx`, `apps/mobile/__tests__/routes/product-detail.test.tsx`, and admin tests.

### 3. Shared Canonical Rating Metadata Contract (No Client Hardcoding)
- **Issue:** Avoid client hardcoding of recommendation copy, labels, and sublabels across mobile and admin.
- **Resolution:**
  - Export `REVIEW_RATING_METADATA` directly from `@expyrico/shared/src/schemas/review.ts`:
    ```typescript
    export const REVIEW_RATING_METADATA = {
      buy_again: {
        value: 'buy_again',
        label: 'Buy again',
        sublabel: 'Top pick',
        icon: 'checkmark-circle',
      },
      buy_again_on_sale: {
        value: 'buy_again_on_sale',
        label: 'Buy on sale',
        sublabel: 'Worth deal',
        icon: 'pricetag',
      },
      wont_buy: {
        value: 'wont_buy',
        label: "Won't buy",
        sublabel: 'Pass on it',
        icon: 'thumbs-down',
      },
    } as const;
    ```
  - Both `apps/mobile` and `apps/admin` import `REVIEW_RATING_METADATA` as the single source of truth for display copy, icon identifiers, and values.

### 4. Real Android Device Build Policy Compliance
- **Requirement:** Comply with `AGENTS.md` Android build and install policy:
  - Do not use Expo CLI, EAS, Expo Go, or Expo dev workflows.
  - Build Android APK directly with local Gradle toolchain:
    ```bash
    cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug
    ```
  - Install and verify on physical Android phone via `adb`:
    ```bash
    adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
    ```
  - Verify complete review creation, display, and camera/photo attachment flows directly on device.

### 5. Production Rollout & Live Endpoint Verification
- **Issue:** Green local test suites do not guarantee production database migration execution.
- **Resolution:**
  - Run production database migration during deployment:
    ```bash
    DATABASE_URL="<production-postgres-url>" pnpm --filter api exec prisma migrate deploy
    ```
  - Execute live API verification probe against production backend to confirm `rating` is active and non-null:
    ```bash
    curl -sS -H "Authorization: Bearer <token>" "https://<api-domain>/v1/products/<id>/reviews" | jq '.items[0].rating'
    ```

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Shared Schemas & Database Contracts](./phase-01-start.md) | Completed |
| 2 | [Phase 2: Backend API Tallies, Serialization & Routes](./phase-02-backend-api-tallies-and-routes.md) | Completed |
| 3 | [Phase 3: Mobile Review Submission & Product Detail Feed](./phase-03-mobile-review-submission-and-feed.md) | Completed |
| 4 | [Phase 4: Mobile Review Display Cards & Section Overhaul](./phase-04-mobile-review-display-cards-and-sections.md) | Completed |
| 5 | [Phase 5: Admin Review Moderation & Analytics](./phase-05-admin-review-moderation-and-analytics.md) | Completed |
| 6 | [Phase 6: Automated Testing & Verification](./phase-06-automated-testing-and-verification.md) | Completed |

## Success Criteria

- [x] `@expyrico/shared` review contracts require `rating: z.enum(['buy_again', 'buy_again_on_sale', 'wont_buy'])` and remove `stars` from required inputs and outputs.
- [x] Database migration ensures `reviews.rating` is populated and constrained, with `products` maintaining `buy_again_count`, `buy_again_on_sale_count`, and `wont_buy_count`.
- [x] Backend API routes (`POST /products/:id/reviews`, `PATCH /reviews/:id`) validate and store `rating` without requiring `stars`.
- [x] `ProductReview` screen (`review.tsx`) renders the 3-option recommendation card (`Buy again`, `Buy on sale`, `Won't buy`) with zero star elements.
- [x] `ReviewCard`, `MyReviewCard`, and `ProductCommunityCard` display recommendation badges and contain zero star icons or numeric star scores.
- [x] `ProductReviewsSection` and `reviews.tsx` display aggregate recommendation percentages, 3-option breakdown pills, and recommendation filter tabs.
- [x] Product detail header (`[id].tsx`) displays community recommendation percentage and user's personal recommendation badge if reviewed.
- [x] Database migration completely drops `stars` from `reviews` and `average_rating` from `products`.
- [x] Admin console displays and filters reviews by recommendation sentiment (`buy_again`, `buy_again_on_sale`, `wont_buy`).
- [x] Automated tests pass with 0 errors across `@expyrico/shared`, `api`, `apps/mobile`, and `apps/admin`.
- [x] Expyrico color palette compliance verified: Fresh Sage `#4BAE8A` / Mint Mist `#D6F0E6` for Buy again, Honey `#F5A623` / Soft Butter `#FEEFC3` for Buy on sale, Pebble `#8C8C85` / Stone `#F0F0ED` for Won't buy.

## Validation Log

### Session 1 — 2026-09-13
**Trigger:** Post-plan validation interview to confirm recommendation percentage calculation, database stars column lifecycle, product details header layout, and form validation requirements.
**Questions asked:** 4

### Verification Results
- Claims checked: 15
- Verified: 15 | Failed: 0 | Unverified: 0
- Tier: Full
- Key verified anchors:
  - `api/prisma/schema.prisma` defines `ReviewRating` enum (`buy_again`, `buy_again_on_sale`, `wont_buy`).
  - `reviews.rating` is currently nullable in PostgreSQL, ready to be backfilled and set to NOT NULL.
  - `products` table retains `buy_again_count`, `buy_again_on_sale_count`, `wont_buy_count`, and `rating_count`.
  - `@expyrico/shared` exports `reviewRatingSchema` matching the 3 recommendation options.
  - `recomputeAndSyncProductTallies` recomputes tallies inside transactional locking.
  - `apps/mobile/app/(app)/product/[id]/review.tsx` currently has star selector card to be replaced by tri-state recommendation card.
  - `apps/mobile/src/features/reviews/ReviewCard.tsx` currently renders 5-star visual indicator lines 85–101.
  - `apps/mobile/src/features/reviews/ProductReviewsSection.tsx` renders decimal star average to be replaced by recommendation summary.
  - `apps/mobile/app/(app)/product/[id]/reviews.tsx` has star filter pills to be replaced by recommendation filter pills.
  - `apps/admin/src/app/(admin)/reviews/page.tsx` renders star rating filter and columns to be updated to sentiment ratings.

#### Questions & Answers

1. **[Architecture / Recommendation Sentiment %]** How should the aggregate community recommendation percentage be calculated?
   - Options: Buy again + Buy on sale combined (Recommended) | Strict 'Buy again' only | Raw tally breakdown only (no percentage)
   - **Answer:** Buy again + Buy on sale combined
   - **Rationale:** Treats both top pick (`buy_again`) and value discount (`buy_again_on_sale`) as positive recommendations, producing an accurate and intuitive grocery satisfaction score: `((buyAgain + buyOnSale) / total) * 100`.

2. **[Architecture / Database Migration Strategy]** How should the 'stars' column in the PostgreSQL 'reviews' table be handled in the database migration?
   - Options: Keep stars column nullable (Archival) (Recommended) | Drop stars column entirely | Maintain stars via trigger (Dual-write)
   - **Answer:** Drop stars column entirely
   - **Rationale:** Ensures a clean cutover with zero dead columns or schema ambiguity; completely removes `stars` from `reviews` and `average_rating` from `products`.

3. **[UI/UX / Product Header Summary]** What should be displayed under the product title on the Product Details screen?
   - Options: Community sentiment % + user badge if reviewed (Recommended) | User personal badge only | Community sentiment % only
   - **Answer:** Community sentiment % + user badge if reviewed
   - **Rationale:** Gives users immediate social proof from the community (e.g. `👍 85% recommend · 24 ratings`), while immediately reflecting the user's personal recommendation badge (`[✓ Buy again] Your review`) if they already reviewed the item.

4. **[Requirements / Submission Requirements]** What are the mandatory submission requirements for creating a product review?
   - Options: Mandatory recommendation, optional comment (Recommended) | Both recommendation and comment mandatory
   - **Answer:** Mandatory recommendation, optional comment
   - **Rationale:** Friction-free mobile review workflow allows users to rate items with a single tap, while providing an optional 2000-character comment field for detailed notes.

#### Confirmed Decisions
- **Sentiment Calculation:** `recommendPct = Math.round(((buyAgainCount + buyAgainOnSaleCount) / Math.max(ratingCount, 1)) * 100)`.
- **Database Clean Cutover:** Drop `stars` from `reviews` and `average_rating` from `products` in the PostgreSQL migration.
- **Product Header Representation:** Display community sentiment percentage for all items, plus the user's personal recommendation pill badge when reviewed.
- **Form Requirements:** Recommendation selection (`buy_again`, `buy_again_on_sale`, `wont_buy`) is mandatory; written text body is optional.

#### Action Items
- [ ] Phase 1: Update PostgreSQL migration to drop `stars` column and `average_rating` column after backfilling `rating`.
- [ ] Phase 1: Remove `stars` from `Review` model in `api/prisma/schema.prisma` and remove `averageRating` from `Product` model.
- [ ] Phase 2: Remove `_avg: { stars: true }` and `averageRating` updates from `recomputeAndSyncProductTallies`.
- [ ] Phase 3: Implement community sentiment % + personal badge in `app/(app)/product/[id].tsx` header.
- [ ] Phase 3: Implement mandatory recommendation validation with optional comment in `review.tsx`.
- [ ] Phase 4: Implement combined sentiment percentage in `ProductReviewsSection.tsx`.

#### Impact on Phases
- Phase 1: Updated to drop `stars` and `average_rating` columns from PostgreSQL schema and models.
- Phase 2: Updated to remove `averageRating` from serializer and tally recomputation.
- Phase 3: Updated to render both community sentiment % and personal badge on product details header.
- Phase 4: Updated to use `(buyAgain + buyOnSale) / total * 100` formula for `% recommend`.
### Session 2 — 2026-09-13
**Trigger:** Follow-up validation interview on product merge tally synchronization, offline submission gating, zero-review empty state presentation, and default list sorting.
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture / Product Merge Tallies]** When duplicate products are merged in Admin, how should recommendation tallies be updated?
   - Options: Re-aggregate from reviews table (Recommended) | Sum product counters directly
   - **Answer:** Re-aggregate from reviews table (Recommended)
   - **Rationale:** Merging can involve duplicate reviews from the same user or hidden/moderated reviews; calling `recomputeAndSyncProductTallies` against visible reviews guarantees 100% database accuracy and zero counter drift.

2. **[Architecture / Offline Submission Handling]** How should the mobile app handle review submission when offline or network connection is lost?
   - Options: Online-only with ConnectionGuard notice (Recommended) | Queue in local database for background sync
   - **Answer:** Online-only with ConnectionGuard notice (Recommended)
   - **Rationale:** Reviews require server-side user verification, product lock acquisition, and moderation profanity checks. Gating submission with `ConnectionGuardStore` and displaying the offline modal notice prevents sync loss.

3. **[UI/UX / Zero-Review Empty State]** How should the Community Reviews section display on products with 0 reviews?
   - Options: Empty state card with CTA button (Recommended) | Hide section entirely until reviewed
   - **Answer:** Empty state card with CTA button (Recommended)
   - **Rationale:** Encourages community participation and contribution by showing "No community ratings yet. Be the first to rate this product!" with a direct "Write a review" CTA button.

4. **[UI/UX / Default Review Sort]** What should be the default sorting order on the product reviews screen?
   - Options: Helpful score first (Recommended) | Newest first
   - **Answer:** Helpful score first (Recommended)
   - **Rationale:** Defaulting to `sort: 'score'` (Wilson lower bound) surfaces the highest-quality, most helpful community ratings first, matching the shared API contract default.

#### Confirmed Decisions
- **Merge Integrity:** `admin/merge.ts` re-aggregates recommendation counters via `recomputeAndSyncProductTallies`.
- **Offline Guard:** `review.tsx` is gated with `useConnectionGuardStore` and `ConnectionLossModal`.
- **Empty State UX:** Zero-review products render an encouraging empty card with a "Write a review" CTA.
- **Default Sort:** Reviews screen defaults to helpful score sorting (`sort: 'score'`).

#### Action Items
- [ ] Phase 2: Confirm `api/src/services/admin/merge.ts` invokes `recomputeAndSyncProductTallies(tx, resolvedTargetId)`.
- [ ] Phase 3: Ensure `apps/mobile/app/(app)/product/[id]/review.tsx` integrates `useConnectionGuardStore`.
- [ ] Phase 3: Verify `reviews.tsx` initializes with `sort: 'score'` and query defaults.
- [ ] Phase 4: Implement empty state card in `ProductReviewsSection.tsx` with "Write a review" CTA.

#### Impact on Phases
- Phase 2: Verified product merge service recomputes tallies from reviews table.
- Phase 3: Gated review submission with `useConnectionGuardStore` and set `sort: 'score'` default.
- Phase 4: Added zero-review empty state with "Write a review" button.

### Whole-Plan Consistency Sweep
- **Contradictions checked:** 12 core architectural boundaries checked across `plan.md` and all 6 phase files.
- **Unresolved contradictions:** 0.
- **Key alignments confirmed:**
  1. Database Migration: `reviews.stars` and `products.average_rating` are completely dropped in PostgreSQL migration; `reviews.rating` is set to `NOT NULL` after backfill.
  2. Data Contracts: `@expyrico/shared` mandates `rating: ReviewRating` on all reviews, exports canonical `REVIEW_RATING_METADATA`, and removes `stars` from schemas.
  3. API Services: `recomputeAndSyncProductTallies` groups exclusively by `rating` and updates `buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, and `ratingCount`.
  4. Product Merge: `api/src/services/admin/merge.ts` calls `recomputeAndSyncProductTallies` directly inside the merge transaction.
  5. Mobile Offline Gating: `review.tsx` uses `useConnectionGuardStore` to block submissions when offline with an immediate user modal.
  6. Mobile Submission: `review.tsx` displays only the 3 recommendation cards with mandatory selection and optional comment; zero star rating code.
  7. Mobile Display: `ReviewCard`, `MyReviewCard`, and `ProductCommunityCard` display recommendation badges and zero stars.
  8. Product Detail: Header in `[id].tsx` and section in `ProductReviewsSection.tsx` display combined recommendation sentiment (`(buyAgain + buyOnSale) / total * 100`) and the user's personal recommendation pill if reviewed.
  9. Zero-Review State: `ProductReviewsSection.tsx` displays an encouraging empty state card with a "Write a review" CTA button.
  10. Default Sort: `reviews.tsx` defaults to `sort: 'score'` (Wilson lower bound).
  11. Admin Console: Review table, filters, and daily analytics operate on recommendation sentiment.
  12. Test Coverage & Android Build: All packages updated to test recommendation contracts; debug APK compiled via local Gradle toolchain per `AGENTS.md`.
<!-- slug: restore-buy-again-rating-remove-stars -->
