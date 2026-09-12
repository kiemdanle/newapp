---
title: "Streamline Review System: Remove Buy Again Recommendation & Consolidate to Star Reviews"
description: "Eliminate redundant 'Buy again', 'Buy on sale', and 'Won't buy' recommendation options from the review system across database schemas, shared DTOs, mobile submission and display flows, and the admin console, keeping only the intuitive 1-to-5 star review system."
status: in-progress
priority: P1
effort: "2d"
tags: ["reviews", "mobile", "api", "database", "admin", "ui-ux"]
created: 2026-09-12
---

# Streamline Review System: Remove Buy Again Recommendation & Consolidate to Star Reviews

## Overview

The Expyrico product review system currently implements two parallel, redundant rating mechanisms side-by-side:
1. A **1-to-5 Star Rating** selector and indicator (e.g. 5 stars, 4 stars, etc.).
2. A **Tri-State Recommendation Selector** with options: `'Buy again'`, `'Buy on sale'`, and `'Won't buy'`.

This duplication creates friction and cognitive overhead during review creation (users must rate stars AND choose a recommendation pill), clutters review cards with redundant badges, complicates analytics tallies in PostgreSQL (`buy_again_count`, `buy_again_on_sale_count`, `wont_buy_count`), and fragments sorting/filtering controls.

This implementation plan completely removes the `'Buy again'`, `'Buy on sale'`, and `'Won't buy'` options, consolidating the entire stack into a clean, modern, industry-standard **1-to-5 Star Review System**.

```
CURRENT (Redundant):
  [ ★ ★ ★ ★ ★ ] Rate this product (1 to 5 stars)
       +
  [ (✓) Buy again ] [ ($) Buy on sale ] [ (X) Won't buy ] Recommendation

NEW STREAMLINED TARGET:
  [ ★ ★ ★ ★ ★ ] Rate this product (1 to 5 stars)
  "4 / 5 · Great!"
  Your thoughts (optional comment up to 2000 chars)
```

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Migrate database schema and `@expyrico/shared` contracts to store and serve numeric 1-to-5 star ratings (`stars: Int`), backfilling historical rows safely | P1 |
| 2 | Streamline mobile review submission (`review.tsx`) by removing the tri-state recommendation card and keeping only the 1-to-5 star selector | P1 |
| 3 | Overhaul mobile review cards (`ReviewCard.tsx`, `MyReviewCard.tsx`, `ProductCommunityCard.tsx`) to display star ratings without recommendation badge pills | P1 |
| 4 | Replace recommendation breakdown pills in `ProductReviewsSection.tsx` and `reviews.tsx` with clean star distribution and average star score | P1 |
| 5 | Update Admin review moderation and analytics console to filter and display reviews by star ratings (1 to 5 stars) | P2 |
| 6 | Comprehensive test coverage across backend integration, mobile components, and Gradle Android device verification | P1 |

## Architecture & Data Model Migration

```
+----------------------------------------------------------------------------+
|                             Database & Contracts                           |
+----------------------------------------------------------------------------+
|                                                                            |
|  reviews Table:                                                            |
|    - Add column: stars SMALLINT NOT NULL DEFAULT 5 (CHECK stars BETWEEN 1 AND 5)
|    - Backfill:                                                             |
|        UPDATE reviews SET stars = 5 WHERE rating = 'buy_again';            |
|        UPDATE reviews SET stars = 3 WHERE rating = 'buy_again_on_sale';    |
|        UPDATE reviews SET stars = 1 WHERE rating = 'wont_buy';             |
|    - Deprecate/drop rating ReviewRating enum                               |
|                                                                            |
|  products Table:                                                           |
|    - Add column: average_rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00        |
|    - Maintain: rating_count, review_count                                  |
|    - Deprecate: buy_again_count, buy_again_on_sale_count, wont_buy_count   |
|                                                                            |
+----------------------------------------------------------------------------+
                                      |
                                      v
+----------------------------------------------------------------------------+
|                          Mobile Review Submission Flow                     |
+----------------------------------------------------------------------------+
|                                                                            |
|  apps/mobile/app/(app)/product/[id]/review.tsx:                            |
|    - REMOVE: Tri-State Recommendation Card (RECOMMENDATION_OPTIONS)        |
|    - REMOVE: starsToRating & ratingToStars translators                     |
|    - KEEP:   1 to 5 Star Rating Selector Card with interactive star buttons |
|    - SUBMIT: { stars: number, body?: string }                              |
|                                                                            |
+----------------------------------------------------------------------------+
                                      |
                                      v
+----------------------------------------------------------------------------+
|                       Mobile Review Display Components                     |
+----------------------------------------------------------------------------+
|                                                                            |
|  ReviewCard.tsx & MyReviewCard.tsx:                                        |
|    - REMOVE: [Buy again] / [On sale] / [Won't buy] pill badges             |
|    - RENDER: Star row (1-5 stars) + numeric score (e.g. 5.0) + timestamp   |
|                                                                            |
|  ProductReviewsSection.tsx & reviews.tsx:                                  |
|    - REMOVE: "18 Buy again · 4 On sale · 2 Won't buy" pill row             |
|    - RENDER: Average Star Hero (e.g. 4.6 ★) + rating counts                 |
|    - FILTER: All / 5★ / 4★ / 3★ / 2★ / 1★ or clean sorting pills           |
|                                                                            |
+----------------------------------------------------------------------------+
```

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Database Schema & Shared Contracts Migration to 1–5 Star Rating](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Mobile Review Form Streamlining (`review.tsx`)](./phase-02-mobile-review-form-streamlining.md) | Pending |
| 3 | [Phase 3: Mobile Display Cards & Feed Overhaul](./phase-03-mobile-display-cards-and-feed-overhaul.md) | Pending |
| 4 | [Phase 4: Admin Dashboard Adaptation & End-to-End Verification](./phase-04-admin-dashboard-adaptation-and-verification.md) | Pending |

## Success Criteria

- [ ] Database schema includes `stars Int` on `Review` and `averageRating` on `Product`, with historical data backfilled.
- [ ] `@expyrico/shared` review contracts require `stars: z.number().int().min(1).max(5)`.
- [ ] Review creation screen (`review.tsx`) contains only 1-to-5 star selector and optional comment; tri-state recommendation card is deleted.
- [ ] Review display cards show only star ratings and zero recommendation badges.
- [ ] Product details and reviews list show average star score (e.g. `4.5 ★`) and review counts without "Buy again" breakdown pills.
- [ ] Admin console displays and filters reviews by 1-5 star ratings.
- [ ] Full automated test suite passes across API, mobile, admin, and shared packages.
- [ ] Verified on physical Android device via local Gradle build and ADB.

<!-- slug: remove-buy-again-option-keep-star-reviews -->
