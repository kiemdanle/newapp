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

## Validation Log

### Session 1 — 2026-09-12
**Trigger:** Post-plan validation interview to confirm review rating format, star granularity, legacy column deprecation, and submission requirements.
**Questions asked:** 4

### Verification Results
- Claims checked: 10
- Verified: 10 | Failed: 0 | Unverified: 0
- Tier: Standard
- Key verified anchors:
  - `api/prisma/schema.prisma` defines `stars Int` on `Review` and `averageRating Decimal` on `Product`.
  - Migration `20260912180000_add_review_stars_and_product_average_rating` deployed and verified on PostgreSQL.
  - `@expyrico/shared` exports `reviewStarsSchema = z.number().int().min(1).max(5)`.
  - `api/src/services/reviews/product-tallies.ts` recomputes `averageRating` and `ratingCount`.
  - `apps/mobile/app/(app)/product/[id]/review.tsx` renders 1-to-5 star selector only.
  - `ReviewCard.tsx` and `MyReviewCard.tsx` render star indicators with zero recommendation badges.
  - `ProductReviewsSection.tsx` and `reviews.tsx` display average star scores and star filter pills (`All`, `5★`..`1★`).
  - `apps/admin/src/app/(admin)/reviews/` displays and filters reviews by 1-5 star ratings.

#### Questions & Answers

1. **[Architecture / Aggregate Rating Format]** How should the aggregate product rating be presented on Product Details and review lists?
   - Options: Decimal average + count (e.g. 4.5 ★ • 24 ratings) (Recommended) | Full 5-bar star histogram distribution | Rounded visual stars only
   - **Answer:** Decimal average + count (e.g. 4.5 ★ • 24 ratings)
   - **Rationale:** High clarity and information density, keeping the screen light and uncluttered while giving users exact scores.

2. **[Architecture / Star Granularity]** What rating granularity should be allowed when users submit a review?
   - Options: Integer stars (1 to 5) for submission, fractional for averages (Recommended) | Half-star ratings (0.5 increments) | Binary rating mapped to stars
   - **Answer:** Integer stars (1 to 5) for submission, fractional for averages
   - **Rationale:** Discrete integer stars ensure simple, frictionless mobile touch targets (44dp+), while aggregate product ratings display fractional averages with 1 decimal place.

3. **[Database / Legacy Enum Deprecation]** How should the legacy 'rating' column (buy_again, on_sale, wont_buy) be managed in the database?
   - Options: Keep rating nullable for backward compatibility (Recommended) | Drop legacy rating column in future cleanup | Maintain rating via DB trigger
   - **Answer:** Keep rating nullable for backward compatibility
   - **Rationale:** Keeps the transition safe and non-breaking for existing database consumers and historical data, while new records write to `stars`.

4. **[Requirements / Rating Requirement]** What are the mandatory submission requirements for writing a product review?
   - Options: Mandatory stars (1-5), optional comment (Recommended) | Both stars and comment mandatory | Either stars or comment
   - **Answer:** Mandatory stars (1-5), optional comment
   - **Rationale:** Minimizes submission friction so users can quickly rate products in seconds, while still providing an optional 2000-character comment field.

#### Confirmed Decisions
- **Review Submission:** Mandatory integer star rating (`1..5`) with optional written comment.
- **Aggregate Presentation:** Numeric average with 1 decimal place (e.g. `4.3 ★`) + total rating count.
- **Schema Strategy:** `stars Int` on `Review` as primary source of truth, with `rating` retained as nullable for backwards compatibility.
- **Review Filters:** Horizontal star filter pills (`All`, `5★`, `4★`, `3★`, `2★`, `1★`).

### Whole-Plan Consistency Sweep
- Zero unresolved contradictions across all phases.
- Verified full alignment across database, shared contracts, mobile UI, and admin console.

<!-- slug: remove-buy-again-option-keep-star-reviews -->
