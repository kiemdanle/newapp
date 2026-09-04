---
phase: 4
title: "Community and Personal Reviews Hub Tab"
status: pending
priority: P1
effort: "3-4h"
dependencies: [1, 2, 3]
---

# Phase 4: Community and Personal Reviews Hub Tab

## Overview
Replaces the static placeholder in `apps/mobile/app/(app)/(tabs)/reviews.tsx` with a dual-mode Reviews Hub. Provides two clear views:
1. **My Reviews**: Lists all products the user has reviewed, showing their selected recommendation, notes, date, and shortcuts to edit or jump to the product.
2. **Community Reviews**: Lists recent helpful reviews across the catalog, allowing users to discover groceries worth buying again, with pull-to-refresh and infinite pagination.

## Requirements

### Functional
- **Segmented View Switcher**:
  - Two accessible segmented tabs at the top:
    - `"My Reviews"`: Displays reviews written by the authenticated user (`GET /v1/me/reviews`).
    - `"Community"`: Displays recent high-scoring reviews across the community.
  - Smooth animated indicator or active pill styling in Fresh Sage (`#4BAE8A`).
- **My Reviews Feed**:
  - Displays list of user's personal reviews using `useMyReviews()`.
  - Each item shows:
    - Product name & brand.
    - User's recommendation badge (`Buy again`, `Buy on sale`, `Won't buy`).
    - Review text and created date.
    - Quick actions:
      - `"Edit"`: navigates to `ProductReview` with `{ id: productId }`.
      - `"View Product"`: navigates to `ProductDetail` with `{ id: productId }`.
  - Empty State when user has 0 reviews:
    - Icon: `create-outline` or `chatbubble-ellipses-outline`.
    - Title: `"No reviews yet"`.
    - Subtitle: `"Share your thoughts on products you have used to help others and remember what you loved."`.
    - CTA button: `"Scan a product to review"`, routing to camera scan.
- **Community Feed**:
  - Displays stream of community reviews with infinite scrolling (`fetchNextPage`).
  - Pull-to-refresh (`RefreshControl`) re-queries the latest reviews.
  - Tapping a review item's product title opens the product details screen.
- **State Preservation**:
  - Retains active tab state (`my_reviews` vs `community`) during session navigation.

### Non-Functional
- Optimized `FlatList` with `keyExtractor`, `ItemSeparatorComponent`, and windowing to maintain 60fps scrolling.
- Expyrico palette compliance (`#FAFAF8` background, `#D6F0E6` active highlights, `#2C2C28` typography).

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
   - Renders a personal review card with product title, brand, recommendation pill, comment body, date, and "Edit" / "View product" buttons.
   - Styled using `theme.colors.bgElevated` and `theme.colors.border`.

2. **Build Segmented Header in `reviews.tsx`**:
   - Implement segmented switch: `[ My Reviews ] [ Community ]`.
   - Use `activeTab === 'mine' ? <MyReviewsList /> : <CommunityReviewsFeed />`.

3. **Wire Personal Reviews Query**:
   - Integrate `useMyReviews()` with `FlatList`, pull-to-refresh `refreshing={isRefetching}`, and empty state CTA.

4. **Wire Community Feed**:
   - If a general reviews endpoint `GET /v1/reviews/recent` or product review feed is queried, display infinite scrolling list.

5. **Update Snapshots & Unit Tests (`tests/unit/reviews-tab.test.tsx`)**:
   - Test switching between My Reviews and Community tabs.
   - Test rendering personal reviews and clicking "Edit".
   - Test empty state when user has no reviews.

## Success Criteria
- [ ] Reviews tab renders active segmented views (My Reviews and Community).
- [ ] Users can see all reviews they've authored and tap "Edit" to modify.
- [ ] Pull-to-refresh smoothly reloads data.
- [ ] Empty state provides clear CTA to scan and review products.
- [ ] Unit tests pass with 0 regressions.

## Risk Assessment
- **Risk**: User has reviewed 50+ items leading to slow rendering.
- **Mitigation**: Use `FlatList` with `initialNumToRender={10}`, `maxToRenderPerBatch={10}`, and memoized item renderers.
