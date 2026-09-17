---
phase: 3
title: "Secondary Long Lists Integration"
status: pending
priority: P1
effort: "1h"
dependencies: ["phase-01-start"]
---

# Phase 3: Secondary Long Lists Integration

## Overview

Integrate `BackToTopButton` into secondary long list screens across the application:
1. **Community Contributions Screen** (`contributions.tsx`)
2. **Product Templates & Drafts Screen** (`drafts.tsx`)
3. **Community Reviews Feed** (`CommunityReviewsFeed.tsx`)
4. **Reviews Hub Screen** (`ReviewsHubScreen.tsx`)

## Requirements

### 1. Community Contributions Screen (`apps/mobile/app/(app)/profile/contributions.tsx`)
- Screen already defines `listRef = useRef<FlatList<CommunityContributionRow>>(null)` and `handleListScroll`.
- Wire `handleListScroll` to update `BackToTopButton` visibility when `currentY >= 280`.
- As a standalone profile stack screen, this screen does NOT have a bottom tab bar: `hasTabBar={false}`.
- Bottom position resolves to `Math.max(insets.bottom, 16) + 16` (~32–48px).
- Render `<BackToTopButton scrollRef={listRef} visible={showBackToTop} hasTabBar={false} testID="contributions-back-to-top" />`.

### 2. Product Templates & Drafts Screen (`apps/mobile/app/(app)/product/drafts.tsx`)
- Screen already defines `listRef = useRef<FlatList<ProductDraftRow>>(null)` and `scrollY = useRef(new Animated.Value(0)).current`.
- Hook into the scroll event or attach a listener on `scrollY` to toggle `showBackToTop`.
- As a standalone product drafts screen, this screen does NOT have a bottom tab bar: `hasTabBar={false}`.
- Render `<BackToTopButton scrollRef={listRef} visible={showBackToTop} hasTabBar={false} testID="drafts-back-to-top" />`.

### 3. Community Reviews Feed (`apps/mobile/src/features/reviews/CommunityReviewsFeed.tsx`)
- Attach `flatListRef = useRef<FlatList<any>>(null)` to `<FlatList>`.
- Wire `onScroll` to track offset.
- This feed is located in the Reviews tab: `hasTabBar={true}`.
- Render `<BackToTopButton scrollRef={flatListRef} visible={showBackToTop} hasTabBar={true} testID="community-reviews-back-to-top" />`.

### 4. Reviews Hub Screen (`apps/mobile/src/features/reviews/ReviewsHubScreen.tsx`)
- Attach `flatListRef = useRef<FlatList<any>>(null)` to the "My Reviews" list.
- Wire `onScroll` to track offset.
- Render `<BackToTopButton scrollRef={flatListRef} visible={showBackToTop} hasTabBar={true} testID="reviews-hub-back-to-top" />`.

## Related Code Files
- Modify: `apps/mobile/app/(app)/profile/contributions.tsx`
- Modify: `apps/mobile/app/(app)/product/drafts.tsx`
- Modify: `apps/mobile/src/features/reviews/CommunityReviewsFeed.tsx`
- Modify: `apps/mobile/src/features/reviews/ReviewsHubScreen.tsx`

## Implementation Steps
1. In `contributions.tsx`, add state/hook for back-to-top, hook into `handleListScroll`, and render `<BackToTopButton>`.
2. In `drafts.tsx`, wire `listRef` and `scrollY` listener to trigger back-to-top visibility, and render `<BackToTopButton>`.
3. In `CommunityReviewsFeed.tsx`, declare `flatListRef`, add `onScroll` handler, and render `<BackToTopButton>`.
4. In `ReviewsHubScreen.tsx`, wire `flatListRef` and `onScroll` handler for the user's review list, and render `<BackToTopButton>`.
5. Test scroll behavior on each secondary screen to verify correct visibility toggling and smooth return to top.

## Success Criteria
- [x] Tapping Back to Top in Community Contributions returns to top.
- [x] Tapping Back to Top in Product Drafts/Templates returns to top.
- [x] Tapping Back to Top in Community Reviews returns to top.
- [x] Correct vertical positioning on non-tab screens (closer to safe area bottom) vs tab screens.

## Risk Assessment
- *Risk*: `contributions.tsx` and `drafts.tsx` already have animated headers / collapsible sticky search bars driven by `Animated.event`.
  - *Mitigation*: The `listener` callback on `Animated.event` or a state update inside the existing `handleListScroll` handler can update `showBackToTop` without interfering with the native animation driver for the collapsible header.

<!-- Updated: Validation Session 1 - Filled Fresh Sage styling and 2.5s auto-fade on inactivity confirmed -->
