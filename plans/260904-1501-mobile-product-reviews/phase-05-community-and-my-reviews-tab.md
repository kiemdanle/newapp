---
phase: 5
title: "Reviews Hub Screen, Navigation Registration, and Community Feed"
status: pending
priority: P1
effort: "3-4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Reviews Hub Screen, Navigation Registration, and Community Feed

## Overview
Implements and registers the dedicated `ReviewsHub` screen in the mobile navigation architecture, providing two rich, data-grounded feeds:
1. **Navigation Registration**: Register `ReviewsHub` in `apps/mobile/src/navigation/AppNavigator.tsx` (`<Stack.Screen name="ReviewsHub" component={ReviewsHubScreen} options={{ headerShown: true, title: 'Reviews' }} />`) and add entry points from:
   - **Profile Screen** (`apps/mobile/app/(app)/(tabs)/profile.tsx`): ActionRow `"My Reviews & Community"` with `chatbubbles-outline` icon.
   - **Product Details Screen** (`apps/mobile/app/(app)/product/[id].tsx`): `"View all reviews"` link.
2. **My Reviews Feed**: Lists all products the user has reviewed using `useMyReviews()`, rendering the authoritative `product` metadata (`name`, `brand`, `imageUrl`) projected by `GET /v1/me/reviews`, with their recommendation badge, notes, date, and shortcuts to edit or jump to the product.
3. **Community Reviews Feed**: Lists recent helpful reviews across all catalog products using `useCommunityReviews()`, querying `GET /v1/reviews/community` with sorting (`Top helpful` vs `Newest`), infinite pagination, and pull-to-refresh.

<!-- Updated: Red Team Review - Registered ReviewsHub in AppNavigator.tsx, added entry points in Profile and Product Details, and implemented full infinite query pagination for personal reviews -->

## Requirements

### Functional
- **Navigation Registration (`apps/mobile/src/navigation/AppNavigator.tsx`)**:
  - Add to `AppStackParamList`:
    ```typescript
    ReviewsHub: { productId?: string; initialTab?: 'mine' | 'community' } | undefined;
    ```
  - Register `<Stack.Screen name="ReviewsHub" component={ReviewsHubScreen} options={{ headerShown: true, title: 'Reviews' }} />`.
- **Navigation Entry Points**:
  - In `apps/mobile/app/(app)/(tabs)/profile.tsx`:
    - Add `ActionRow`:
      - `testID="profile-action-reviews"`
      - `icon="chatbubbles-outline"`
      - `label="My Reviews & Community"`
      - `subtitle="See your recommendations and community picks"`
      - `onPress={() => navigation.push('ReviewsHub')}`
  - In `ProductReviewsSection.tsx`:
    - Tapping `"View all N reviews"` navigates to `navigation.push('ReviewsHub', { productId: product.id })`.
- **Segmented View Switcher**:
  - Two accessible segmented tabs at the top:
    - `"My Reviews"`: Displays reviews written by the authenticated user (`useMyReviews()`).
    - `"Community"`: Displays recent high-scoring reviews across the community (`useCommunityReviews()`).
  - Active pill styling in Fresh Sage (`#4BAE8A`) with Mint Mist (`#D6F0E6`) accent.
- **My Reviews Feed**:
  - Displays list of user's personal reviews using infinite query `useMyReviews()`.
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

### Non-Functional
- Optimized `FlatList` with `keyExtractor`, `ItemSeparatorComponent`, and windowing to maintain 60fps scrolling.
- Expyrico palette compliance (`#FAFAF8` background, `#D6F0E6` active highlights, `#2C2C28` typography, no Alert Red on recommendation cards).

## Architecture & Layout

```
+-------------------------------------------------------------+
| <- Back                                             Reviews |
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
- Modify: `apps/mobile/src/navigation/AppNavigator.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/profile.tsx`
- Create: `apps/mobile/src/features/reviews/ReviewsHubScreen.tsx`
- Create: `apps/mobile/src/features/reviews/MyReviewCard.tsx`
- Create: `apps/mobile/src/features/reviews/CommunityReviewsFeed.tsx`
- Read: `apps/mobile/src/api/reviews.ts`
- Read: `apps/mobile/src/components/Screen.tsx`
- Test: `apps/mobile/tests/unit/reviews-hub.test.tsx`

## Implementation Steps

1. **Register Screen in `AppNavigator.tsx`**:
   - Add `ReviewsHub` to `AppStackParamList`.
   - Mount `<Stack.Screen name="ReviewsHub" component={ReviewsHubScreen} options={{ headerShown: true, title: 'Reviews' }} />`.

2. **Add Entry Point in `ProfileScreen`**:
   - In `apps/mobile/app/(app)/(tabs)/profile.tsx`, add `ActionRow` linking to `ReviewsHub`.

3. **Build `MyReviewCard.tsx` (`apps/mobile/src/features/reviews/MyReviewCard.tsx`)**:
   - Renders personal review card with product title, brand, product thumbnail, recommendation pill (`wont_buy` on Stone/Pebble/Almost Black), comment body, date, and "Edit" / "View product" buttons (`minHeight: 44`).

4. **Build `CommunityReviewsFeed.tsx` (`apps/mobile/src/features/reviews/CommunityReviewsFeed.tsx`)**:
   - Renders infinite `FlatList` of community reviews using `useCommunityReviews()`.
   - Embeds sorting pills (`Top helpful` vs `Newest`).
   - Renders `ReviewCard` with product banner linking to `ProductDetail`.

5. **Build `ReviewsHubScreen.tsx` (`apps/mobile/src/features/reviews/ReviewsHubScreen.tsx`)**:
   - Implement segmented switch: `[ My Reviews ] [ Community ]`.
   - Dynamically renders active feed based on selected tab.
   - Preserves active tab selection during session.

6. **Add Unit & Navigation Tests (`tests/unit/reviews-hub.test.tsx`)**:
   - Test navigating from Profile to ReviewsHub.
   - Test switching between My Reviews and Community tabs.
   - Test rendering personal reviews and clicking "Edit".
   - Test empty state when user has no reviews.

## Success Criteria
- [ ] `ReviewsHub` is registered in `AppNavigator` and accessible from Profile and Product Details.
- [ ] Users can see all reviews they've authored with full product details (`name`, `brand`, thumbnail).
- [ ] Recommendation states strictly avoid Alert Red (Stone/Pebble/Almost Black used for `wont_buy`).
- [ ] Community feed loads real reviews from `GET /v1/reviews/community`.
- [ ] Pull-to-refresh smoothly reloads data.
- [ ] Empty state provides clear CTA to scan and review products.
- [ ] Unit tests pass with 0 regressions.
