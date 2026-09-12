---
phase: 3
title: "Mobile Display Cards & Feed Overhaul"
status: pending
priority: P1
effort: "5h"
dependencies: ["phase-01-start.md", "phase-02-mobile-review-form-streamlining.md"]
---

# Phase 3: Mobile Display Cards & Feed Overhaul

## Overview
Overhaul review display cards, feed views, and section headers across the mobile app to eliminate all recommendation badge pills ('Buy again', 'On sale', "Won't buy") and consolidate presentation around clean 1-to-5 star visual indicators and average rating summaries.

## Requirements
- Functional:
  - `apps/mobile/src/features/reviews/ReviewCard.tsx`:
    - Remove `badgeConfig` dictionary and the recommendation badge container from the header row (lines 114–130).
    - Render author avatar, name, and relative timestamp on the left header.
    - Render 5-star row with numeric score (`5.0`, `4.0`, etc.) in place of the badge pill.
  - `apps/mobile/src/features/reviews/MyReviewCard.tsx`:
    - Remove `badgeConfig` and recommendation pill badge.
    - Display clean 5-star visual row with score and relative timestamp.
  - `apps/mobile/src/features/reviews/ProductCommunityCard.tsx`:
    - Remove `rev.rating === 'buy_again' ? 'Buy again' : ...` recommendation label.
    - Display product name, star score (e.g. `★ 4.8`), and review excerpts.
  - `apps/mobile/src/features/reviews/ProductReviewsSection.tsx`:
    - Remove the tri-state breakdown row (`buyAgainCount Buy again · buyAgainOnSaleCount On sale · wontBuyCount Won't buy`).
    - Display average star rating banner with large star icon, numeric score (e.g. `4.5 ★`), and subtitle (`24 ratings · 14 written reviews`).
  - `apps/mobile/app/(app)/product/[id]/reviews.tsx`:
    - Remove the `Rating Sentiment Breakdown Bar` with `Buy again` / `On sale` / `Won't buy` filters.
    - Replace with clean star rating distribution / filters (e.g. `All`, `5★`, `4★`, `3★`, `2★`, `1★`) or retain streamlined sort pills (`Top helpful` & `Newest`).
- Non-functional:
  - Strict compliance with Expyrico color palette: Honey `#F5A623` for stars, Fresh Sage `#4BAE8A` for positive accents, Almost Black `#2C2C28` and `#FAFAF8` for typography.
  - Full dark and light theme responsiveness.
  - Update all associated mobile test suites.

## Architecture
- `ReviewCard.tsx` & `MyReviewCard.tsx`:
  - Reusable card primitives consumed in Product Details, Reviews Hub, and Profile screen.
- `ProductReviewsSection.tsx` & `reviews.tsx`:
  - Review list surfaces displaying aggregate metrics and paginated review feeds.

## Related Code Files
- Modify:
  - `apps/mobile/src/features/reviews/ReviewCard.tsx`
  - `apps/mobile/src/features/reviews/MyReviewCard.tsx`
  - `apps/mobile/src/features/reviews/ProductCommunityCard.tsx`
  - `apps/mobile/src/features/reviews/ProductReviewsSection.tsx`
  - `apps/mobile/app/(app)/product/[id]/reviews.tsx`
  - `apps/mobile/tests/unit/product-reviews-section.test.tsx`
  - `apps/mobile/tests/unit/product-reviews-page.test.tsx`
  - `apps/mobile/tests/unit/reviews-hub.test.tsx`

## Implementation Steps
1. In `ReviewCard.tsx`:
   - Delete `badgeConfig`.
   - Update header layout to place star row and score cleanly.
2. In `MyReviewCard.tsx`:
   - Delete `badgeConfig` and recommendation pill.
   - Align star indicator styling.
3. In `ProductCommunityCard.tsx`:
   - Replace recommendation text with star rating badge.
4. In `ProductReviewsSection.tsx`:
   - Delete `breakdownRow` and `buyAgainCount` / `buyAgainOnSaleCount` / `wontBuyCount` displays.
   - Refactor sentiment header to focus on average star rating and review count.
5. In `reviews.tsx`:
   - Delete tri-state filter pills.
   - Add star-based rating filter pills or simplify to sort pills (`Top helpful`, `Newest`).
6. Update mobile unit tests in `product-reviews-section.test.tsx`, `product-reviews-page.test.tsx`, and `reviews-hub.test.tsx`.
7. Run `pnpm --filter mobile test`.

## Success Criteria
- [ ] No review card in the entire mobile app renders "Buy again", "Buy on sale", or "Won't buy".
- [ ] All reviews display standard 1-to-5 star ratings.
- [ ] Product review sections display clean average star score and review totals.
- [ ] All mobile unit tests pass.

## Risk Assessment
- **Risk**: Snapshot tests failing due to removed recommendation badges.
  - **Mitigation**: Update snapshot references to reflect the streamlined star review layout.
