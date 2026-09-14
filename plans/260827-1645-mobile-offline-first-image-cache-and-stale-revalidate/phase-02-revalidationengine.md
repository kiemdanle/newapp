---
phase: 2
title: "RevalidationEngine"
status: complete
priority: P1
dependencies: ["phase-01-storagecore"]
---

# Phase 2: RevalidationEngine

## Overview
Implement the Stale-While-Revalidate (SWR) background revalidation engine in `apps/mobile/src/cache/image-revalidator.ts` and React hook `useCachedImage()`. Handles in-flight request deduplication, atomic temporary file commits, conditional network checks (`If-None-Match`, `If-Modified-Since`), `304 Not Modified` payload-free revalidation, and silent offline resilience.

<!-- Updated: Red Team Review 2026-08-27 - In-Flight Request Deduplication & Atomic Temp-File Commit -->

## Requirements
- **Functional**:
  - `useCachedImage({ uri, target, photoId, variant, headers, freshTtlMs })` hook:
    - **Step 1 (Warm Memory Return / Async Disk Hydration)**: If cached in warm L1 memory, return `{ uri: localFileUri, isLoading: false, isRevalidating: !isSyncFresh }` synchronously. If an L1 miss, return `{ uri: null, isLoading: true }` and asynchronously hydrate from L2 disk storage before falling back to network.
    - **Step 2 (Freshness Check)**: If `Date.now() - cached.timestamp < freshTtlMs` (24h for public catalog images, 15m for private user drafts), skip network check.
    - **Step 3 (In-Flight Deduplication)**: Multiple components requesting the same image URI share a single active fetch Promise to prevent redundant network bursts during list scrolling.
    - **Step 4 (Conditional Fetch)**: If stale, send background `GET` with `If-None-Match: cached.etag` and `If-Modified-Since: cached.lastModified`.
    - **Step 5 (304 Handling)**: If response is 304, update cache timestamp without redownloading image bytes.
    - **Step 6 (Atomic File Write)**: If response is 200 (image was modified), write bytes to a `.tmp` file first, then atomically rename to the destination path to prevent truncated file corruption from app backgrounding or concurrency races.
    - **Step 7 (Offline Grace)**: If network request fails or device is offline, keep displaying the existing cached image without triggering UI errors.
- **Non-functional**:
  - Background revalidations must not block the main thread or UI interactions.
  - Zero half-written file corruptions.

## Architecture

```mermaid
flowchart TD
    A[Component Requests Image] --> B{In Warm L1 Memory?}
    B -->|Yes| C[Render Cached URI Synchronously]
    B -->|No| D[Async Hydrate from L2 Disk / Storage]
    D -->|Found on Disk| C
    D -->|Not on Disk| E[Fetch Over Network]
    
    C --> F{Cache Stale? >24h Public or >15m Private}
    F -->|No (Within Fresh TTL)| G[Keep Displaying - No Network Call]
    F -->|Yes| H[Check In-Flight Promise Map]
    
    H -->|Already In-Flight| I[Attach To Existing Promise]
    H -->|New Request| J[Background Conditional Fetch: If-None-Match ETag]
    
    J --> K{Server Response}
    K -->|304 Not Modified| L[Refresh Cache Timestamp - 0 Bytes]
    K -->|200 OK New Image| M[Write to .tmp -> Atomic Rename / Save]
    K -->|Network Error / Offline| N[Silent Fallback - Keep Cached URI]
    
    E --> O[Write to Cache & Display Image]

## Related Code Files
- Create: `apps/mobile/src/cache/image-revalidator.ts`
- Create: `apps/mobile/src/cache/useCachedImage.ts`
- Modify: `apps/mobile/src/api/product-private-image.tsx` (integrate with SWR engine)

## Implementation Steps
1. Create `image-revalidator.ts`:
   - Implement `fetchAndCacheImage(url, options)` with conditional `If-None-Match` and `If-Modified-Since` headers.
   - Implement atomic write utility: writes incoming bytes to `${localPath}.tmp` then renames/replaces destination `${localPath}`.
   - Implement in-flight promise deduplication map `Map<string, Promise<string>>` keyed by normalized URI.
   - Support both public direct URLs and authenticated private media routes with automatic 401 token refresh retry.
2. Create `useCachedImage.ts` hook:
   - Provide `{ uri, isLoading, isRevalidating, error, reload }`.
   - Perform synchronous L1 check followed by fast asynchronous L2 disk lookup.
   - Launch background revalidation when stale (>24h public, >15m private).
3. Update `product-private-image.tsx` to utilize `useCachedImage` and persist private images to user-scoped disk storage.

## Success Criteria
- [ ] Stale cached images render immediately on mount and revalidate in background.
- [ ] Concurrent requests for identical images trigger only 1 network request.
- [ ] Server 304 response transfers zero image bytes and refreshes local timestamp.
- [ ] Modified image on server replaces local image smoothly via atomic rename.
- [ ] Network disconnection keeps cached images visible without error.

## Risk Assessment
- **Duplicate Concurrent Fetches**: Virtualized list items rendering the same image simultaneously could fire multiple duplicate requests.
  - *Mitigation*: In-flight request deduplication map keys on URI and shares a single active Promise across all subscriber components.
- **Half-Written File Corruption**: Process interruption during download leaves broken files on disk.
  - *Mitigation*: Write to `.tmp` file first and perform atomic rename only after the entire download completes and verifies non-empty.
