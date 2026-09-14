---
phase: 1
title: "Skeleton Core & Shimmer Primitives"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Skeleton Core & Shimmer Primitives

## Overview
Build the foundational skeleton loading components and native-driver pulse/shimmer primitives in `apps/mobile/src/components/skeleton/`. Provides accessible, theme-aware, zero-JS-overhead visual placeholders designed with pixel-perfect dimensional parity to Expyrico's pantry item cards and list components.

## Requirements
- **Functional**:
  - `SkeletonShimmer`:
    - Wraps children in a native-driver pulse animation loop (`Animated.loop`) oscillating opacity between `0.4` and `1.0` over `850ms`.
    - Clean unmount lifecycle: calls `anim.stop()` in `useEffect` cleanup to guarantee zero timer or memory leaks during fast virtualized scrolling.
    - Automatically checks `AccessibilityInfo.isReduceMotionEnabled()` and disables animation when user prefers reduced motion.
  - `SkeletonBone`:
    - Configurable bone primitive supporting `width` (number or percentage), `height`, `borderRadius`, and optional container styles.
    - Resolves background color strictly via `useTheme().colors`:
      - Light theme: base `theme.colors.neutralLight` (`#F0F0ED` Stone) with highlight `theme.colors.bgGlass` (`#D6F0E6`) / `theme.colors.bgElevated` (`#FAFAF8`).
      - Dark theme: base `theme.colors.neutralLight` (`#2D3A34`) with highlight `theme.colors.bgGlass` (`#1F342C`).
      - Zero ad-hoc dark hexes (`#262624`/`#363632` strictly forbidden).
  - `RecordCardSkeleton`:
    - Exact dimensional replica of `RecordCard` in list view:
      - 52×52px squircle thumbnail bone (border radius 12px).
      - Title bone (height 16px, width 60%).
      - Brand/category bone (height 12px, width 35%).
      - Expiry pill bone (height 22px, width 75px, rounded pill).
      - Identical outer padding, margin, card border, and elevated card background.
  - `PantryGridCardSkeleton`:
    - Exact dimensional replica of `PantryGridCard` in 2-column grid view:
      - Aspect-ratio 1:1 image square bone with rounded top corners.
      - Title bone (height 14px, width 75%).
      - Expiry pill bone (height 20px, width 60px).
      - Identical card elevation, border, and border radius (14px).
- **Non-functional**:
  - `useNativeDriver: true` mandatory for all animation loops. Zero bridge traffic during active animation.
  - No external heavy animation libraries; native `Animated` only.
  - Zero layout shift (Cumulative Layout Shift = 0) when transitioning from skeleton to real content.

## Architecture

```
+---------------------------------------------------------------+
|                      SkeletonShimmer                          |
|  - Animated.loop(Animated.sequence([fadeTo(1.0), fadeTo(0.4)]))|
|  - Listens to AccessibilityInfo (respects reduce-motion)      |
|  - Wraps children in single coordinated Animated.View         |
+---------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------+
|                       SkeletonBone                            |
|  - Props: width, height, borderRadius, style                  |
|  - Background: theme.colors.neutralLight                      |
+---------------------------------------------------------------+
            |                                       |
            v                                       v
+-----------------------+               +-----------------------+
|  RecordCardSkeleton   |               | PantryGridCardSkeleton|
|  (52px thumb + rows)  |               | (1:1 image + rows)    |
+-----------------------+               +-----------------------+
```

## Related Code Files
- Create:
  - `apps/mobile/src/components/skeleton/SkeletonShimmer.tsx`
  - `apps/mobile/src/components/skeleton/SkeletonBone.tsx`
  - `apps/mobile/src/components/skeleton/RecordCardSkeleton.tsx`
  - `apps/mobile/src/components/skeleton/PantryGridCardSkeleton.tsx`
  - `apps/mobile/src/components/skeleton/index.ts`
  - `apps/mobile/tests/unit/skeleton-primitives.test.tsx`
- Modify:
  - `packages/theme/src/tokens.ts` (export formal skeleton color tokens if needed)

## Implementation Steps
1. Create `SkeletonShimmer.tsx`:
   - Initialize `Animated.Value(0.4)`.
   - Setup `const anim = Animated.loop(Animated.sequence([...]))` with `useNativeDriver: true`.
   - Start animation on mount, and return `() => anim.stop()` in `useEffect` cleanup to prevent timer leaks.
   - Add `AccessibilityInfo.isReduceMotionEnabled()` check on mount to bypass loop when enabled.
2. Create `SkeletonBone.tsx`:
   - Accept `width`, `height`, `borderRadius`, `style`.
   - Apply theme-aware background colors strictly via `useTheme().colors.neutralLight` (Light: `#F0F0ED` Stone, Dark: `#2D3A34`).
3. Create `RecordCardSkeleton.tsx`:
   - Structure container matching `styles.card` in `RecordCard.tsx` (min-height 76px, padding 12px, border, rounded 14px).
   - Lay out 52×52px thumbnail on the left, vertical text stack in middle, pill bone on the right.
4. Create `PantryGridCardSkeleton.tsx`:
   - Structure container matching `PantryGridCard.tsx` (aspect-ratio 1:1 image box, content pad, pill bone).
5. Create `apps/mobile/tests/unit/skeleton-primitives.test.tsx`:
   - Verify `SkeletonBone` renders with correct dimensional props and styles.
   - Verify `RecordCardSkeleton` and `PantryGridCardSkeleton` render without crashing.
   - Verify dark mode color resolution (`theme.colors.neutralLight`).

## Success Criteria
- [ ] `SkeletonShimmer` oscillates opacity smoothly without frame drops.
- [ ] When reduced motion is enabled, `SkeletonShimmer` renders static bones without animating.
- [ ] `RecordCardSkeleton` dimensions match `RecordCard` exactly (no layout jump when replaced).
- [ ] `PantryGridCardSkeleton` dimensions match `PantryGridCard` exactly.
- [ ] Unit tests pass with 100% assertions satisfied.

## Risk Assessment
- **Risk**: Device memory/CPU overhead if 20+ separate `Animated.Value` instances loop simultaneously in a virtualized list.
  - *Observable Signal*: High CPU usage in Android profiler during skeleton display.
  - *Pre-decided Response*: Centralize pulse phase inside `SkeletonShimmer` so all bones within a card or list share a single `Animated.Value` context.
- **Risk**: Hardcoded bone colors clash with custom high-contrast or dark themes.
  - *Observable Signal*: Bone borders visible against background in dark mode.
  - *Pre-decided Response*: Resolve bone background strictly through `useTheme().colors.neutralLight` and highlight through `theme.colors.bgGlass`.
