---
phase: 1
title: "Reusable Component & Hook Architecture"
status: pending
priority: P1
effort: "1.5h"
dependencies: []
---

# Phase 1: Reusable Component & Hook Architecture

## Overview

Design and implement the core `BackToTopButton` component, `useBackToTop` hook, and universal `scrollToTop` responder utility in `apps/mobile/src/components/BackToTopButton.tsx`.

## Requirements

### Functional Requirements
- **Visibility Threshold**: Button remains invisible (`opacity: 0, pointerEvents: "none"`) while scroll offset `y < threshold` (default `280px`). Once `y >= threshold`, it animates in smoothly (`opacity: 1, pointerEvents: "auto"`).
- **Auto-Fade on Inactivity**: When the user pauses scrolling for 2.5s (2500ms), the button smoothly fades out to prevent screen clutter. Resuming scrolling (or touching the scroll view) while still past threshold immediately restores visibility.
- **Smooth Animation**: Uses React Native `Animated` with native driver for high-performance 60fps spring animation (`opacity: 0 -> 1`, `translateY: 8 -> 0`, `scale: 0.85 -> 1`).
- **Resilient Scroll to Top**:
  - `FlatList`: Calls `ref.scrollToOffset({ offset: 0, animated: true })`.
  - `SectionList`: Calls `ref.getScrollResponder()?.scrollTo({ y: 0, animated: true })` (or `scrollToLocation` with fallback), preventing crashes on empty sections.
  - `ScrollView`: Calls `ref.scrollTo({ y: 0, animated: true })`.
- **Smart Bottom Inset Calculation**:
  - Automatically reads `useSafeAreaInsets()`.
  - If `hasTabBar={true}`: positions at `insets.bottom > 0 ? insets.bottom + 68 : 76`.
  - If `hasTabBar={false}`: positions at `Math.max(insets.bottom, 16) + 16`.
  - Supports explicit `bottom` override or `offsetBottom` prop for custom adjustments.
  - Positioned at `right: 16`.

### Non-Functional Requirements
- **Visual Design & Expyrico Palette**:
  - Small circular button: diameter 42px, radius 21px (`width: 42, height: 42, borderRadius: 21`).
  - Icon: `Ionicons` `arrow-up` (size 20, stroke/bold weight, centered).
  - Background Fill: Solid **Fresh Sage (`#4BAE8A`)** in BOTH light and dark themes (zero unapproved `#1B2620` dark card alternatives).
  - Icon Color: **Warm White (`#FAFAF8`)** in both themes for maximum contrast and readability.
  - Pressed State: **Deep Sage (`#3A8F6F`)** with 0.9 opacity for immediate tactile feedback.
  - Light Theme Polish: Soft diffuse elevation (`shadowColor: '#2C2C28'`, `shadowOffset: { width: 0, height: 3 }`, `shadowOpacity: 0.18`, `shadowRadius: 5`, Android `elevation: 5`) with hairline boundary (`borderWidth: StyleSheet.hairlineWidth`, `borderColor: 'rgba(58, 143, 111, 0.20)'`, referencing Deep Sage `#3A8F6F`).
  - Dark Theme Polish: Crisp luminous rim (`borderWidth: 1`, `borderColor: 'rgba(214, 240, 230, 0.35)'` Mint Mist tint) with deep ambient shadow (`shadowColor: '#000000'`, `shadowOffset: { width: 0, height: 4 }`, `shadowOpacity: 0.45`, `shadowRadius: 8`, Android `elevation: 6`) for luminous separation on dark canvas backgrounds.
- **Accessibility**:
  - `accessibilityRole="button"`.
  - `accessibilityLabel="Scroll back to top"`.
  - `accessibilityHint="Double tap to scroll to the top of the list"`.

## Architecture

```tsx
// Hook Interface:
export interface UseBackToTopOptions {
  threshold?: number;
  autoHideTimeout?: number; // default: 2500ms
  hasTabBar?: boolean;
  bottom?: number;
  offsetBottom?: number;
  scrollRef?: React.RefObject<any>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export interface UseBackToTopReturn {
  visible: boolean;
  isVisible: boolean;
  scrollRef: React.RefObject<any>;
  scrollToTop: () => void;
  handleScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  backToTopProps: BackToTopButtonProps;
}

// Component Props:
export interface BackToTopButtonProps {
  scrollRef?: React.RefObject<any>;
  visible?: boolean;
  onPress?: () => void;
  threshold?: number;
  hasTabBar?: boolean;
  bottom?: number;
  offsetBottom?: number;
  right?: number;
  testID?: string;
}
```

## Related Code Files
- Create: `apps/mobile/src/components/BackToTopButton.tsx`
- Create: `apps/mobile/src/components/BackToTopButton.test.tsx`

## Implementation Steps
1. Scaffold `apps/mobile/src/components/BackToTopButton.tsx` with `scrollToTop` helper supporting `FlatList`, `SectionList`, and `ScrollView`.
2. Implement `useBackToTop` hook with threshold detection (`threshold = 280`) and combined `onScroll` forwarding.
3. Implement `BackToTopButton` with native driver spring transitions (`Animated.spring`), layout calculations using `useSafeAreaInsets()`, and Expyrico palette styling.
4. Author comprehensive unit tests in `apps/mobile/src/components/BackToTopButton.test.tsx` covering:
   - Hidden initially at scroll offset 0.
   - Appears when scroll offset exceeds threshold.
   - Disappears when scroll offset returns below threshold.
   - Fires `scrollTo` / `scrollToOffset` when pressed.
   - Correct bottom positioning when `hasTabBar` is true vs false.

## Success Criteria
- [x] `BackToTopButton` and `useBackToTop` exported cleanly.
- [x] Universal scroll-to-top handler functions across list types.
- [x] Unit tests pass with 100% assertion coverage on visibility and scroll triggers.

## Risk Assessment
- *Risk*: `SectionList.scrollToLocation` throws an error if sections or items are empty.

<!-- Updated: Validation Session 1 - Auto-fade on inactivity (2.5s) and Unified Fresh Sage styling in bright & dark themes confirmed (removed #1B2620) -->
  - *Mitigation*: Prefer `ref.getScrollResponder()?.scrollTo({ y: 0, animated: true })` which scrolls the underlying ScrollView directly without indexing into section data.
