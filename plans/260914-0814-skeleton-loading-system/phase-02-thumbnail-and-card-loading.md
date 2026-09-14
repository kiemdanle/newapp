---
phase: 2
title: "Thumbnail & Card Inline Loading States"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-skeleton-primitives"]
---

# Phase 2: Thumbnail & Card Inline Loading States

## Overview
Eliminate missing name text flashes (`"Item"`) and image pop-in blanks across `ProductThumbnail`, `RecordCard`, and `PantryGridCard`. When an item's product metadata or photo is actively loading from the server or hydrating from cold cache, render inline shimmering bones directly inside the card instead of unstyled fallback text or empty boxes.

## Requirements
- **Functional**:
  - `ProductThumbnail.tsx`:
    - Track image load settlement (`onLoad`, `onError`, and `useCachedImage.isLoading`).
    - While the image is downloading over the network or hydrating from storage, render a matching `SkeletonBone` with subtle shimmer in place of a blank white/transparent box.
    - On load settlement (`onLoad`), smoothly cross-fade to the rendered image via `fadeDuration={150}`.
    - On load failure (`onError`), display the fallback placeholder icon (`nutrition-outline`).
  - `RecordCard.tsx`:
    - Inspect `isProductLoading` from `useProduct(record.productId)`.
    - If `record.customName` is absent and `isProductLoading` is true:
      - Render an inline `SkeletonBone` (height 16px, width 60%, border radius 4px) in place of the title text, preventing the literal string `"Item"` from flashing.
      - Render an inline `SkeletonBone` (height 12px, width 35%, border radius 3px) in place of the brand text.
    - When `product` resolves, transition smoothly to the real name and brand.
  - `PantryGridCard.tsx`:
    - Apply identical inline loading protection for `displayName` and `brand`.
    - Provide a full 1:1 image skeleton bone inside the top card container while the large grid photo is streaming.
- **Non-functional**:
  - Zero layout shift (height of skeleton text bones matches `lineHeight` of typography tokens exactly).
  - No flickering when navigating between already-cached items (synchronous L1 hits bypass skeleton bones completely).

## Architecture

```
+-----------------------------------------------------------------+
|                       RecordCard Component                      |
|                                                                 |
|  +------------------+  +-------------------------------------+  |
|  | ProductThumbnail |  | Title Row:                          |  |
|  |                  |  |  isProductLoading ?                 |  |
|  |  isLoading ?     |  |    <SkeletonBone width="60%" /> :   |  |
|  |   <SkeletonBone> |  |    <Text>{displayName}</Text>       |  |
|  |   : <Image />    |  +-------------------------------------+  |
|  +------------------+  | Brand Row:                          |  |
|                        |  isProductLoading ?                 |  |
|                        |    <SkeletonBone width="35%" /> :   |  |
|                        |    <Text>{brand}</Text>             |  |
|                        +-------------------------------------+  |
+-----------------------------------------------------------------+
```

## Related Code Files
- Modify:
  - `apps/mobile/src/components/ProductThumbnail.tsx`
  - `apps/mobile/src/features/records/RecordCard.tsx`
  - `apps/mobile/src/features/records/PantryGridCard.tsx`
- Test:
  - `apps/mobile/tests/unit/thumbnail-and-card-loading.test.tsx`

## Implementation Steps
1. Update `ProductThumbnail.tsx`:
   - In `CachedThumbnailImage`, maintain an `imageLoaded` state (`useState(false)`).
   - Render `SkeletonBone` positioned absolutely or as a background overlay while `!imageLoaded` and `isLoading`.
   - Wire `onLoadEnd={() => setImageLoaded(true)}` on `<Image>`.
2. Update `RecordCard.tsx`:
   - Destructure `isLoading: isProductLoading` from `useProduct(record.productId ?? undefined)`.
   - Add condition:
     ```tsx
     const shouldShowNameSkeleton = !record.customName && Boolean(record.productId) && isProductLoading;
     ```
   - In JSX, conditionally render `<SkeletonBone width="60%" height={16} />` when `shouldShowNameSkeleton` is true.
   - Conditionally render `<SkeletonBone width="35%" height={12} />` for brand when `!record.brand && Boolean(record.productId) && isProductLoading`.
3. Update `PantryGridCard.tsx`:
   - Mirror the inline title/brand skeleton logic.
4. Create `tests/unit/thumbnail-and-card-loading.test.tsx`:
   - Test that `RecordCard` renders skeleton bones when `isProductLoading === true` and `record.customName === null`.
   - Test that `RecordCard` renders the actual product name when `product` is loaded.
   - Test that `ProductThumbnail` renders skeleton shimmer while image is loading.

## Success Criteria
- [ ] No appearance of the raw string `"Item"` when opening a record with an uncached product.
- [ ] No blank white boxes while product images are downloading over network.
- [ ] Smooth transition with zero layout jitter once metadata and images resolve.
- [ ] Unit tests pass with 100% assertions satisfied.

## Risk Assessment
- **Risk**: Repeated re-renders of `<Image>` causing image reload loops if `key` changes on load state flip.
  - *Observable Signal*: Image flickers repeatedly after loading.
  - *Pre-decided Response*: Keep the `<Image>` mounted continuously with `style={[style, !imageLoaded && { opacity: 0 }]}` rather than conditionally unmounting the image element.
