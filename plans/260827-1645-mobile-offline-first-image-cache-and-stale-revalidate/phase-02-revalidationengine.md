---
phase: 2
title: "RevalidationEngine"
status: pending
priority: P1
dependencies: ["phase-01-storagecore"]
---

# Phase 2: RevalidationEngine

## Overview
Implement the Stale-While-Revalidate (SWR) background revalidation engine in `apps/mobile/src/cache/image-revalidator.ts` and React hook `useCachedImage()`. Handles conditional network checks (`If-None-Match`, `If-Modified-Since`), `304 Not Modified` payload-free revalidation, silent offline resilience, and automatic in-place cache replacement when an image changes.

<!-- Updated: Validation Session 2026-08-27 - 24h Public / 15m Private Freshness TTL Policy -->

## Requirements
- **Functional**:
  - `useCachedImage({ uri, target, photoId, variant, headers, freshTtlMs })` hook:
    - **Step 1 (Instant Return)**: If cached on disk/memory, return `{ uri: cachedUri, isLoading: false, isRevalidating: true }` on Frame 0.
    - **Step 2 (Freshness Check)**: If `Date.now() - cached.timestamp < freshTtlMs` (24h for public catalog images, 15m for private user drafts), skip network check.
    - **Step 3 (Conditional Fetch)**: If stale, send background `GET` with `If-None-Match: cached.etag` and `If-Modified-Since: cached.lastModified`.
    - **Step 4 (304 Handling)**: If response is 304, update cache timestamp without redownloading image bytes.
    - **Step 5 (200 Handling)**: If response is 200 (image was modified), read new bytes, update disk cache, and smoothly emit the new URI.
    - **Step 6 (Offline Grace)**: If network request fails or device is offline, keep displaying the existing cached image without triggering UI errors.
- **Non-functional**:
  - Background revalidations must not block the main thread or UI interactions.
  - Deduplicate in-flight revalidations so identical image URLs across lists trigger only 1 network call.

## Architecture

```mermaid
flowchart TD
    A[Component Requests Image] --> B{In Memory or Disk?}
    B -->|Yes| C[Render Cached Image Immediately]
    B -->|No| D[Fetch Over Network]
    
    C --> E{Cache Stale? >24h Public or >15m Private}
    E -->|No (Within Fresh TTL)| F[Keep Displaying - No Network Call]
    E -->|Yes| G[Background Conditional Fetch: If-None-Match ETag]
    
    G --> H{Server Response}
    H -->|304 Not Modified| I[Refresh Cache Timestamp - 0 Bytes]
    H -->|200 OK New Image| J[Update Disk Cache & Transition Image]
    H -->|Network Error / Offline| K[Silent Fallback - Keep Cached Image]
    
    D --> L[Save To Cache & Display Image]
```

## Related Code Files
- Create: `apps/mobile/src/cache/image-revalidator.ts`
- Create: `apps/mobile/src/cache/useCachedImage.ts`
- Modify: `apps/mobile/src/api/product-private-image.tsx` (integrate with SWR engine)

## Implementation Steps
1. Create `image-revalidator.ts`:
   - Implement `fetchAndCacheImage(url, options)` with conditional `If-None-Match` and `If-Modified-Since` headers.
   - Support both public direct URLs and authenticated private media routes with automatic 401 token refresh retry.
   - Implement in-flight promise deduplication map to prevent redundant concurrent fetches for the same image URL.
2. Create `useCachedImage.ts` hook:
   - Provide `{ uri, isLoading, isRevalidating, error, reload }`.
   - Perform synchronous L1 check followed by fast asynchronous L2 disk lookup.
   - Launch background revalidation when stale (>24h public, >15m private).
3. Update `product-private-image.tsx` to utilize `useCachedImage` and persist private images to user-scoped disk storage instead of ephemeral-only memory.

## Success Criteria
- [ ] Stale cached images render immediately on mount and revalidate in background.
- [ ] Server 304 response transfers zero image bytes and refreshes local timestamp.
- [ ] Modified image on server replaces local image smoothly.
- [ ] Network disconnection keeps cached images visible without error.

## Risk Assessment
- **Duplicate Concurrent Fetches**: Virtualized list items rendering the same image simultaneously could fire multiple duplicate requests.
  - *Mitigation*: In-flight request deduplication map keys on URI and shares a single active Promise across all subscriber components.
- **Flickering on Revalidation**: If an image revalidates with identical bytes, re-rendering could flash.
  - *Mitigation*: Only update component state if 200 response yields different ETag or changed data URI.
