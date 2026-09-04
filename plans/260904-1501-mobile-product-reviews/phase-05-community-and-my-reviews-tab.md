---
phase: 5
title: "Community and Personal Reviews Hub Tab"
status: pending
priority: P1
effort: "3-4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Community and Personal Reviews Hub Tab

## Overview
Replaces the static placeholder in `apps/mobile/app/(app)/(tabs)/reviews.tsx` with a fully integrated Reviews Hub. Leverages the backend contracts established in Phase 1 to provide two rich, data-grounded feeds:
1. **My Reviews**: Lists all products the user has reviewed using `useMyReviews()`, rendering the authoritative `product` metadata (`name`, `brand`, `imageUrl`) projected by `GET /v1/me/reviews`, with their recommendation badge, notes, date, and shortcuts to edit or jump to the product.
2. **Community Reviews**: Lists recent helpful reviews across all catalog products using `useCommunityReviews()`, querying the new `GET /v1/reviews/community` endpoint with sorting (`score` vs `new`), infinite pagination, and pull-to-refresh.

## Requirements

### Functional
- **Segmented View Switcher**:
  - Two accessible segmented tabs at the top:
    - `"My Reviews"`: Displays reviews written by the authenticated user (`useMyReviews()`).
    - `"Community"`: Displays recent high-scoring reviews across the community (`useCommunityReviews()`).
  - Smooth indicator or active pill styling in Fresh Sage (`#4BAE8A`) with Mint Mist (`#D6F0E6`) accent.
- **My Reviews Feed**:
  - Displays list of user's personal reviews using `useMyReviews()`.
  - Each item renders using `MyReviewCard`:
    - Product name & brand (guaranteed by Phase 1's `product` projection on `Review`).
    - Product thumbnail photo.
    - User's recommendation badge (strictly per Expyrico palette):
      - `Buy again`: Mint Mist `#D6F0E6`, Fresh Sage `#4BAE8A` border/text.
      - `Buy on sale`: Soft Butter `#FEEFC3`, Honey `#F5A623` border/text.
      - `Won't buy`: Neutral Stone `#F0F0ED`, Pebble `#8C8C85` border, Almost Black `#2C2C28` text. (Zero Alert Red `#E0442A`).
    - Review text and created date.
    - Quick actions:
      - `"Edit"`: navigates to `ProductReview` with `{ id: productId }`.
      - `"View Product"`: navigates to `ProductDetail` with `{ id: productId }`.
  - Empty State when user has 0 reviews:
    - Icon: `chatbubble-ellipses-outline`.
    - Title: `"No reviews yet"`.
    - Subtitle: `"Share your thoughts on products you have used to help others and remember what you loved."`.
    - CTA button: `"Scan a product to review"`, routing to camera scan.
- **Community Feed**:
  - Displays stream of community reviews using `useCommunityReviews({ sort })`.
  - Supports sorting pills: `"Top helpful"` (`score`) and `"Newest"` (`new`).
  - Pull-to-refresh (`RefreshControl`) re-queries the latest reviews.
  - Infinite scrolling with `onEndReached` calling `fetchNextPage()`.
  - Tapping a review item's product title opens `ProductDetail`.
- **State Preservation**:
  - Retains active tab state (`my_reviews` vs `community`) during session navigation.

### Non-Functional
- Optimized `FlatList` with `keyExtractor`, `ItemSeparatorComponent`, and windowing to maintain 60fps scrolling.
- Expyrico palette compliance (`#FAFAF8` background, `#D6F0E6` active highlights, `#2C2C28` typography, no Alert Red on recommendation cards).

## Architecture & Layout

```
+-------------------------------------------------------------+
| COMMUNITY                                                   |
| Product Reviews                                             |
| Discover what is worth buying again                         |
|                                                             |
| +---------------------------------------------------------+ |
| |       [ My Reviews (4) ]     |     [ Community ]        | |
| +---------------------------------------------------------+ |
|                                                             |
| (FlatList - My Reviews)                                     |
| +---------------------------------------------------------+ |
| | Oatly Oat Milk Barista Edition            [ Buy again ] | |
| | Oatly · 1L                                              | |
| | "Best milk alternative for coffee. Foams perfectly."    | |
| | Reviewed 3 days ago                                     | |
| | [ Edit Review ]                      [ View Product -> ]| |
| +---------------------------------------------------------+ |
|                                                             |
| +---------------------------------------------------------+ |
| | Chobani Greek Yogurt Plain              [ Buy on sale ] | |
| | Chobani · 32 oz                                         | |
| | "Great protein source, but price increased recently."   | |
| | Reviewed 2 weeks ago                                    | |
| | [ Edit Review ]                      [ View Product -> ]| |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/app/(app)/(tabs)/reviews.tsx`
- Create: `apps/mobile/src/features/reviews/MyReviewCard.tsx`
- Create: `apps/mobile/src/features/reviews/CommunityReviewsFeed.tsx`
- Read: `apps/mobile/src/api/reviews.ts`
- Read: `apps/mobile/src/components/Screen.tsx`
- Test: `apps/mobile/tests/unit/reviews-tab.test.tsx`

## Implementation Steps

1. **Build `MyReviewCard.tsx` (`apps/mobile/src/features/reviews/MyReviewCard.tsx`)**:
   - Renders personal review card with product title, brand, product thumbnail, recommendation pill (`wont_buy` on Stone/Pebble/Almost Black), comment body, date, and "Edit" / "View product" buttons (`minHeight: 44`).
   - Styled using `theme.colors.bgElevated` and `theme.colors.border`.

2. **Build `CommunityReviewsFeed.tsx` (`apps/mobile/src/features/reviews/CommunityReviewsFeed.tsx`)**:
   - Renders infinite `FlatList` of community reviews using `useCommunityReviews()`.
   - Embeds sorting pills (`Top helpful` vs `Newest`).
   - Renders `ReviewCard` with product banner linking to `ProductDetail`.

3. **Wire Segmented Header in `reviews.tsx`**:
   - Implement segmented switch: `[ My Reviews ] [ Community ]`.
   - Dynamically renders active feed based on selected tab.

4. **Update Snapshots & Unit Tests (`tests/unit/reviews-tab.test.tsx`)**:
   - Test switching between My Reviews and Community tabs.
   - Test rendering personal reviews and clicking "Edit".
   - Test empty state when user has no reviews.

## Success Criteria
- [ ] Reviews tab renders active segmented views (My Reviews and Community).
- [ ] Users can see all reviews they've authored with full product details (`name`, `brand`).
- [ ] Recommendation states strictly avoid Alert Red (Stone/Pebble/Almost Black used for `wont_buy`).
- [ ] Community feed loads real reviews from `GET /v1/reviews/community`.
- [ ] Pull-to-refresh smoothly reloads data.
- [ ] Empty state provides clear CTA to scan and review products.
- [ ] Unit tests pass with 0 regressions.

## Risk Assessment
- **Risk**: Missing product reference on older reviews in database.
- **Mitigation**: Graceful fallback to `review.product?.name ?? 'Reviewed Product'` and hide broken thumbnail image placeholders.
