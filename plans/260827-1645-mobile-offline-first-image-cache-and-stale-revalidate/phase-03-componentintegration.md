---
phase: 3
title: "ComponentIntegration"
status: complete
priority: P1
dependencies: ["phase-01-storagecore", "phase-02-revalidationengine"]
---

# Phase 3: ComponentIntegration

## Overview
Integrate the SWR offline-first disk cache across all visual image components in `apps/mobile`. Enables warm-L1 synchronous rendering on mount and asynchronous L2 disk hydration across Pantry records, product catalog, giveaways, deals, and user profile screens, while enforcing user privacy isolation and sign-out purges.

<!-- Updated: Red Team Review 2026-08-27 - Privacy URL Classification & Session Purge Integration -->

## Requirements
- **Functional**:
  - `ProductThumbnail.tsx`:
    - Render cached image synchronously on warm L1 memory hits, and asynchronously hydrate from local disk cache on cold starts.
    - Classify URLs: any authenticated/private route (`/v1/products/.../photos/`, `/v1/product-edits/...`) automatically scopes to the active `userId`.
    - Revalidate in background when stale (>24h public, >15m private).
  - `PrivateProductImage.tsx`:
    - Persist user draft/edit photos to user-scoped disk cache; display synchronously on warm memory hits and asynchronously hydrate from disk on app open.
  - `Avatar.tsx`:
    - Display cached user avatar synchronously on warm memory hits, or asynchronously hydrate from local cache on app launch.
  - `DealCard.tsx` & `GiveawayCard.tsx`:
    - Cache thumbnail photos for deals and giveaways; render synchronously on warm memory hits and asynchronously hydrate from local disk in feed lists.
  - `GiveawayImageGallery.tsx`:
    - Display hero and thumbnail strip images synchronously on warm memory hits, or asynchronously hydrate from local disk cache.
  - `session-store.ts`:
    - Hook `ImageDiskCache.purgeUserPrivate(userId)` into `signOut()` and account switch handlers.
- **Non-functional**:
  - Smooth fade-in transitions (`fadeDuration={150}`) to avoid harsh layout pops.
  - Consistent aspect ratio and background placeholder color while cache hydrates.

## Architecture

```
+-----------------------------------------------------------------+
|                       Mobile App Screens                        |
|  (Pantry List / Product Detail / Deals Feed / Giveaways / Profile)
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                      Component Layer                            |
|  - ProductThumbnail (Catalog & Record photos)                   |
|  - PrivateProductImage (Draft & Revision private media)         |
|  - Avatar (Profile & Author avatars)                            |
|  - DealCard / GiveawayCard (Community feed thumbnails)          |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                   useCachedImage(uri, options)                  |
|  - Warm Memory: Synchronous cached URI return                   |
|  - Cold Start: Async L2 disk hydration / placeholder           |
|  - In-Flight Deduplication: 1 network request per unique URI    |
|  - Background: Conditional SWR Check (304 / 200)                |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|               ImageDiskCache (Decoupled L1 + L2)                |
|  - L1 Memory Index + AsyncStorage Metadata                      |
|  - Sandboxed Disk File System (file://${cacheDir}/...)          |
+-----------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/src/components/ProductThumbnail.tsx`
- Modify: `apps/mobile/src/api/product-private-image.tsx`
- Modify: `apps/mobile/src/components/Avatar.tsx`
- Modify: `apps/mobile/src/features/deals/DealCard.tsx`
- Modify: `apps/mobile/src/features/giveaways/GiveawayCard.tsx`
- Modify: `apps/mobile/src/features/giveaways/GiveawayImageGallery.tsx`
- Modify: `apps/mobile/src/auth/session-store.ts`

## Implementation Steps
1. Update `ProductThumbnail.tsx`:
   - Use `useCachedImage` to resolve candidate photo URIs with automatic privacy classification.
   - Return cached URI synchronously on warm L1 hits, or asynchronously hydrate with smooth fade-in and background placeholder.
2. Update `PrivateProductImage.tsx`:
   - Replace in-memory-only map with `useCachedImage` backed by `ImageDiskCache`.
3. Update `Avatar.tsx`:
   - Pass user avatar URL through `useCachedImage` with warm-L1 synchronous display and async L2 disk hydration.
4. Update `DealCard.tsx` and `GiveawayCard.tsx`:
   - Connect deal/giveaway image URLs to `useCachedImage` for smooth feed scrolling.
5. Update `GiveawayImageGallery.tsx`:
   - Ensure full-screen modal and thumbnail strip load from cached disk entries.
6. Update `session-store.ts`:
   - Add `ImageDiskCache.purgeUserPrivate(currentUser.id)` on `signOut()` and `signIn()`.

## Success Criteria
- [ ] Navigating to Pantry, Deals, or Giveaways shows zero empty image blanks for previously viewed items.
- [ ] App restart hydrates cached product images from disk into view without requiring network re-download.
- [ ] Private images are deleted when logging out, preventing multi-user device leakage.
- [ ] No regression in image layout, aspect ratios, or fallback icons.

## Risk Assessment
- **Slow List Rendering**: Executing too much logic per thumbnail could impact 60fps scrolling.
  - *Mitigation*: L1 memory lookup is a fast synchronous `Map.get()`, avoiding unnecessary async storage reads on warm hits.
- **Unmounted Component Memory Leaks**: Background fetch completing after unmount.
  - *Mitigation*: Use cleanup flag in `useEffect` to avoid setting state on unmounted components.
