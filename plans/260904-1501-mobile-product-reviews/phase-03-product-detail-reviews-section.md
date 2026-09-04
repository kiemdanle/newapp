---
phase: 3
title: "Product Detail Screen Integration and Community Reviews Feed"
status: pending
priority: P1
effort: "4-5h"
dependencies: [1, 2]
---

# Phase 3: Product Detail Screen Integration and Community Reviews Feed

## Overview
Integrate a community reviews section directly into the product detail screen (`apps/mobile/app/(app)/product/[id].tsx`). Displays an aggregate recommendation sentiment banner (e.g. `92% would buy again · 24 reviews`), prominent `"Write a Review"` / `"Edit Your Review"` action button, sort pills (`Top helpful`, `Newest`, `Rating`), and interactive `ReviewCard` components supporting helpfulness voting, author badges, and moderation visibility rules.

## Requirements

### Functional
- **Aggregate Rating Summary Banner**:
  - Displays calculated sentiment metric:
    - Percentage of reviewers who selected `buy_again` or `buy_again_on_sale`.
    - Breakdown bar or badges (e.g. 18 Buy again · 4 On sale · 2 Won't buy).
    - Total reviews count.
  - If 0 reviews: displays gentle empty state `"No reviews yet · Be the first to share your experience"`.
- **Review Action Button**:
  - If user has not reviewed: renders primary/outline button `"Write a review"` navigating to `ProductReview` with `{ id: product.id }`.
  - If user has already reviewed: renders `"Edit your review"` with a badge `"You reviewed this item [Buy again]"`.
- **Sorting Controls**:
  - 3 sort pills:
    1. **Top helpful** (`score`): default Bayesian helpfulness score.
    2. **Newest** (`new`): latest created date first.
    3. **Helpful ratio** (`rating`): reviews with highest positive helpful votes first.
  - Tapping a pill triggers query refetch with active pill highlighted in Fresh Sage (`#4BAE8A`).
- **`ReviewCard` Component (`apps/mobile/src/features/reviews/ReviewCard.tsx`)**:
  - Author header: user avatar (or initials placeholder), first name, and relative timestamp (`2d ago`, `1mo ago`).
  - Recommendation badge:
    - `Buy again` in Fresh Sage / Mint Mist (`#D6F0E6`)
    - `Buy on sale` in Honey / Soft Butter (`#FEEFC3`)
    - `Won't buy` in Alert Red (`#E0442A`)
  - Review text body: rendered cleanly with line wrapping.
  - Helpful vote button:
    - Displays thumbs-up icon with vote count `Helpful (N)`.
    - If `myVote === 'helpful'`: highlighted in active Fresh Sage.
    - If review has no text body (`body === null`): helpful button is hidden (per backend schema `422 REVIEW_HAS_NO_COMMENT` rule).
    - Prevents voting on user's own review.
    - Triggers light haptic feedback and optimistic count toggle.
- **Pagination & "View all" Navigation**:
  - Displays top 3 reviews directly on the product detail page.
  - If more than 3 reviews exist, renders `"View all N reviews"` link that expands or navigates to the full reviews list.

### Non-Functional
- Performance: uses memoized `ReviewCard` components to prevent re-rendering when scrolling product photos or editing quantity.
- Design: clean Expyrico styling (`docs/design/expyrico-colour-palette.md`). Warm White cards (`#FAFAF8`), Stone borders (`#F0F0ED`), and Almost Black text (`#2C2C28`).

## Architecture & Layout

```
+-------------------------------------------------------------+
| [ Product Image Gallery ]                                   |
| Product Name                                                |
| Brand · Category                                            |
| [ Add to Pantry Form ]                                      |
|                                                             |
| ================= COMMUNITY REVIEWS ======================= |
|                                                             |
| +---------------------------------------------------------+ |
| |  (V) 92% Recommend this product                         | |
| |  24 reviews · 18 Buy again · 4 On sale · 2 Won't buy   | |
| +---------------------------------------------------------+ |
|                                                             |
| [ + Write a Review ]                                        |
|                                                             |
| Sort: [ Top helpful ] [ Newest ] [ Rating ]                 |
|                                                             |
| +---------------------------------------------------------+ |
| | (Avatar) Alex M. · 3d ago                 [ Buy again ] | |
| |                                                         | |
| | Stays crisp in the crisper drawer for almost 2 weeks.   | |
| | Great value for everyday cooking.                       | |
| |                                                         | |
| | [ (Y) Helpful (12) ]                                    | |
| +---------------------------------------------------------+ |
|                                                             |
| +---------------------------------------------------------+ |
| | (Avatar) Sarah T. · 1w ago              [ Buy on sale ] | |
| |                                                         | |
| | Good flavor but slightly pricey at full MSRP.           | |
| |                                                         | |
| | [ (Y) Helpful (5) ]                                     | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/product/[id].tsx`
- Create: `apps/mobile/src/features/reviews/ReviewCard.tsx`
- Create: `apps/mobile/src/features/reviews/ProductReviewsSection.tsx`
- Read: `apps/mobile/src/api/reviews.ts`
- Read: `apps/mobile/src/components/Button.tsx`
- Test: `apps/mobile/tests/unit/product-reviews-section.test.tsx`

## Implementation Steps

1. **Build `ReviewCard.tsx` (`apps/mobile/src/features/reviews/ReviewCard.tsx`)**:
   - Accepts `review: Review`, `currentUserId?: string`, `onVoteHelpful: (reviewId: string, currentVote: 'helpful' | null) => void`.
   - Render author avatar using `Avatar` component, first name, and formatted date (`formatRelativeDate`).
   - Render recommendation badge with icon and matching Expyrico colors.
   - If `review.body` is present, render body text; if `review.body` is null, hide body and helpful button.
   - Render helpful button with `accessibilityLabel="Vote review as helpful"`.

2. **Build `ProductReviewsSection.tsx` (`apps/mobile/src/features/reviews/ProductReviewsSection.tsx`)**:
   - Fetches reviews using `useProductReviews(productId, { sort })`.
   - Fetches current user's profile to identify existing review.
   - Calculates aggregate recommendation percentage:
     `recommendCount = buyAgainCount + buyAgainOnSaleCount`.
     `recommendPct = Math.round((recommendCount / total) * 100)`.
   - Renders summary banner with recommendation metric.
   - Renders "Write a review" / "Edit your review" button.
   - Renders 3 sort pills with active indicator.
   - Maps and renders list of `ReviewCard` items.

3. **Mount in `apps/mobile/app/(app)/product/[id].tsx`**:
   - Place `<ProductReviewsSection productId={data.id} />` cleanly below the `AddRecordForm` and above screen bottom padding.
   - Ensure screen scrolling remains smooth with no nested virtualized list warnings (`ScrollView` with mapped cards).

4. **Add Unit Tests (`apps/mobile/tests/unit/product-reviews-section.test.tsx`)**:
   - Test rendering 0 reviews empty state.
   - Test rendering reviews list with recommendation badges.
   - Test clicking "Write a review" triggers navigation.
   - Test clicking "Helpful" triggers vote mutation.
   - Test changing sort pill refetches with new sort order.

## Success Criteria
- [ ] Product details screen renders community sentiment summary and review cards.
- [ ] Users can toggle between "Top helpful", "Newest", and "Rating" sort orders.
- [ ] Tapping helpful increments vote count with instant feedback.
- [ ] Tapping "Write a review" navigates to `ProductReview`.
- [ ] Unit tests pass 100%.

## Risk Assessment
- **Risk**: A product with 100+ reviews causes slow rendering inside `ScrollView`.
- **Mitigation**: Limit inline product reviews to initial 5 items with a "Load more reviews" or "View all" trigger.
