---
title: Plan Streamline Review System to Star Reviews Only
date: 2026-09-12
summary: "Designed 4-phase implementation plan to remove redundant Buy again recommendations and consolidate review system to 1-to-5 star ratings across DB, shared contracts, mobile UI, and admin console."
---

# Plan Streamline Review System to Star Reviews Only

Designed a comprehensive 4-phase technical implementation plan in `plans/260912-1701-remove-buy-again-option-keep-star-reviews` to eliminate the redundant 'Buy again', 'Buy on sale', and 'Won't buy' recommendation options and consolidate to 1-to-5 star reviews:

1. **Phase 1: Database Schema & Shared Contracts Migration to 1–5 Star Rating**:
   - Add `stars Int @db.SmallInt` (1..5) to `Review` table and `averageRating` to `Product` table in Prisma with SQL data backfill.
   - Update `@expyrico/shared` review schemas (`Review`, `ReviewCreate`, `ReviewPatch`).
   - Update backend aggregation tallies in `product-tallies.ts`.

2. **Phase 2: Mobile Review Form Streamlining (`review.tsx`)**:
   - Remove the `RECOMMENDATION_OPTIONS` card and mapping functions.
   - Keep only the 1-to-5 star rating selector card with dynamic captions (`5/5 · Excellent!`, etc.).
   - Submit `stars` directly to the backend.

3. **Phase 3: Mobile Display Cards & Feed Overhaul**:
   - Remove recommendation badge pills from `ReviewCard.tsx`, `MyReviewCard.tsx`, and `ProductCommunityCard.tsx`.
   - Replace "Buy again" breakdown pills in `ProductReviewsSection.tsx` and `reviews.tsx` with clean average star score and review counts.

4. **Phase 4: Admin Dashboard Adaptation & End-to-End Verification**:
   - Update `apps/admin/src/app/(admin)/reviews/` to display and filter reviews by 1-5 star ratings.
   - Update automated integration/unit tests across API, Mobile, and Admin.
   - Build Android APK via local Gradle, install via ADB, and verify on physical device.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
