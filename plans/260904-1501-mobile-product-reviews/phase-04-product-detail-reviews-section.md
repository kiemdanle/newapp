---
phase: 4
title: "Product Detail Screen Integration and Community Reviews Feed"
status: pending
priority: P1
effort: "4-5h"
dependencies: [1, 2, 3]
---

# Phase 4: Product Detail Screen Integration and Community Reviews Feed

## Overview
Integrate a community reviews section directly into the product detail screen (`apps/mobile/app/(app)/product/[id].tsx`). Displays an aggregate recommendation sentiment banner derived authoritatively from the `Product` model (`buyAgainCount`, `buyAgainOnSaleCount`, `wontBuyCount`, `ratingCount`, `reviewCount`), prominent `"Write a Review"` / `"Edit Your Review"` action button, sort pills (`Top helpful` & `Newest`), and interactive `ReviewCard` components consuming the sanitized public review DTO with `isOwnReview` for type-safe self-voting suppression.

<!-- Updated: Red Team Review Round 7 - Consumed sanitized public review DTO with review.isOwnReview (no internal userId/currentUserId props), used ratingCount denominator, two sort pills (score/new), and Stone/Pebble wont_buy styling -->

## Requirements

### Functional
- **Aggregate Rating Summary Banner**:
  - **Authoritative Data Source & Correct Math**: Must read directly from the `product` record returned by `useProduct(id)` (`apps/mobile/src/api/products.ts:42`):
    - **Denominator**: `product.ratingCount` (the sum of all three recommendation tallies: `buyAgainCount + buyAgainOnSaleCount + wontBuyCount`).
    - **Numerator**: `(product.buyAgainCount ?? 0) + (product.buyAgainOnSaleCount ?? 0)`.
    - **Written Reviews Count**: `product.reviewCount` represents only reviews that carry a written text comment (`body !== null`). It is presented separately and **NEVER used as the denominator** (preventing $>100\%$ ratios).
    ```typescript
    const totalRatings = product.ratingCount ?? 0;
    const positiveCount = (product.buyAgainCount ?? 0) + (product.buyAgainOnSaleCount ?? 0);
    const recommendPct = totalRatings > 0 ? Math.round((positiveCount / totalRatings) * 100) : null;
    const writtenReviewsCount = product.reviewCount ?? 0;
    ```
    - Subtitle copy: e.g. `92% Recommend this product · 24 ratings (14 written reviews)`.
    - Breakdown counts display: `18 Buy again · 4 On sale · 2 Won't buy`.
  - If `totalRatings === 0`: displays gentle empty state `"No reviews yet · Be the first to share your experience"`.
- **Review Action Button**:
  - Uses `useMyProductReview(product.id)`:
    - If user has not reviewed: renders primary button `"Write a review"` navigating to `ProductReview` with `{ id: product.id }`.
    - If user has already reviewed: renders outline button `"Edit your review"` with an author badge `"You recommended this item [Buy again]"`.
- **Sorting Controls**:
  - Exactly 2 database-indexed sort pills:
    1. **Top helpful** (`score`): Bayesian Wilson score, sorted in Postgres.
    2. **Newest** (`new`): Chronological `createdAt DESC`, sorted in Postgres.
  - Tapping a pill triggers query refetch with active pill highlighted in Fresh Sage (`#4BAE8A`).
- **`ReviewCard` Component (`apps/mobile/src/features/reviews/ReviewCard.tsx`)**:
  - Consumes sanitized public review DTO: `review: Review` (which omits `userId` and provides `isOwnReview: boolean`).
  - Author header: user avatar (or initials placeholder), first name (`review.author?.firstName ?? 'Community Member'`), and relative timestamp (`2d ago`, `1mo ago`).
  - Recommendation badge (strictly adhering to Expyrico palette):
    - `Buy again`: Fresh Sage (`#4BAE8A`) text/border on Mint Mist (`#D6F0E6`) background with checkmark icon.
    - `Buy on sale`: Honey (`#F5A623`) text/border on Soft Butter (`#FEEFC3`) background with tag icon.
    - `Won't buy`: Almost Black (`#2C2C28`) text and Pebble (`#8C8C85`) border on Stone (`#F0F0ED`) background with thumbs-down icon. (Zero Alert Red `#E0442A`).
  - Review text body: rendered cleanly with line wrapping.
  - Helpful vote button:
    - Displays thumbs-up icon with vote count `Helpful (N)`.
    - If `myVote === 'helpful'`: highlighted in active Fresh Sage.
    - **Self-Vote & Comment Visibility Gate**:
      ```tsx
      {!review.isOwnReview && review.body ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Vote helpful, currently ${review.helpfulCount} votes`}
          onPress={() => onVoteHelpful(review.id, review.myVote ?? null)}
          style={[styles.helpfulButton, { minHeight: 44 }]}
        >
          <Ionicons name="thumbs-up-outline" size={16} color={review.myVote === 'helpful' ? theme.colors.primary : theme.colors.textMuted} />
          <Text style={styles.helpfulText}>{review.helpfulCount}</Text>
        </Pressable>
      ) : null}
      ```
    - If `review.isOwnReview === true`: renders `"Your review"` subtle badge instead of helpful voting button.
    - If review has no text body (`review.body === null`): helpful button is completely hidden.
- **Pagination & "View all" Navigation**:
  - Displays top 3 reviews directly on the product detail page.
  - If more than 3 reviews exist, renders `"View all N reviews"` link routing to `ReviewsHub` with `{ productId: product.id }`.

### Non-Functional
- Performance: uses memoized `ReviewCard` components to prevent re-rendering when scrolling product photos or editing quantity.
- Design: clean Expyrico styling (`docs/design/expyrico-colour-palette.md`). Warm White cards (`#FAFAF8`), Stone borders (`#F0F0ED`), and Almost Black text (`#2C2C28`). Alert Red `#E0442A` is never used for recommendations.

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
| |  24 ratings (14 reviews) · 18 Buy · 4 Sale · 2 Won't    | |
| +---------------------------------------------------------+ |
|                                                             |
| [ + Write a Review ]                                        |
|                                                             |
| Sort: [ Top helpful ] [ Newest ]                            |
|                                                             |
| +---------------------------------------------------------+ |
| | (Avatar) Alex · 3d ago                      [ Buy again ] | |
| |                                                         | |
| | Stays crisp in the crisper drawer for almost 2 weeks.   | |
| | Great value for everyday cooking.                       | |
| |                                                         | |
| | [ (Y) Helpful (12) ]                                    | |
| +---------------------------------------------------------+ |
|                                                             |
| +---------------------------------------------------------+ |
| | (Avatar) Sarah · 1w ago                   [ Buy on sale ] | |
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
- Read: `apps/mobile/src/api/products.ts`
- Read: `apps/mobile/src/components/Button.tsx`
- Test: `apps/mobile/tests/unit/product-reviews-section.test.tsx`

## Implementation Steps

1. **Build `ReviewCard.tsx` (`apps/mobile/src/features/reviews/ReviewCard.tsx`)**:
   - Accepts `review: Review` and `onVoteHelpful: (reviewId: string, currentVote: 'helpful' | null) => void`.
   - Render author avatar using `Avatar` component, first name, and formatted date (`formatRelativeDate`).
   - Render recommendation badge with icon and matching Expyrico colors (`wont_buy` on Stone/Pebble/Almost Black, no Alert Red).
   - If `!review.isOwnReview && review.body`: render helpful button with `minHeight: 44`.
   - If `review.isOwnReview`: render `"Your review"` tag.

2. **Build `ProductReviewsSection.tsx` (`apps/mobile/src/features/reviews/ProductReviewsSection.tsx`)**:
   - Accepts `product: Product`.
   - Derives recommendation percentage directly using `ratingCount` as denominator and `reviewCount` as written review count.
   - Uses `useMyProductReview(product.id)` to determine button label ("Write a review" vs "Edit your review").
   - Fetches review list via `useProductReviews(product.id, { sort })`.
   - Renders summary banner with recommendation metric.
   - Renders 2 sort pills (`Top helpful` and `Newest`) with active indicator.
   - Maps and renders list of `ReviewCard` items.

3. **Mount in `apps/mobile/app/(app)/product/[id].tsx`**:
   - Place `<ProductReviewsSection product={data} />` cleanly below the `AddRecordForm` and above screen bottom padding.

4. **Add Unit Tests (`apps/mobile/tests/unit/product-reviews-section.test.tsx`)**:
   - Test rendering 0 reviews empty state.
   - Test recommendation percentage calculation strictly using `product.ratingCount`.
   - Test rendering reviews list with recommendation badges.
   - Test self-voting button is hidden when `review.isOwnReview === true`.
   - Test clicking "Write a review" triggers navigation.
   - Test clicking "Helpful" triggers vote mutation.

## Success Criteria
- [ ] Product details screen renders community sentiment summary and review cards.
- [ ] Sentiment percentage is calculated strictly using `product.ratingCount` as denominator.
- [ ] Recommendation badges strictly adhere to Expyrico palette (`wont_buy` uses Stone/Pebble/Almost Black).
- [ ] `ReviewCard` type-safely consumes sanitized DTO and uses `review.isOwnReview` to suppress self-voting.
- [ ] Users can toggle between "Top helpful" and "Newest" sort orders.
- [ ] Tapping helpful increments vote count with instant feedback.
- [ ] Tapping "Write a review" navigates to `ProductReview`.
- [ ] Unit tests pass 100%.
