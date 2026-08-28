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
    - **Step 1 (Instant Return)**: If cached on disk/memory, return `{ uri: localFileUri, isLoading: false, isRevalidating: true }` on Frame 0.
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
    A[Component Requests Image] --> B{In Memory or Disk?}
    B -->|Yes| C[Render Cached file:// Immediately]
    B -->|No| D[Fetch Over Network]
    
    C --> E{Cache Stale? >24h Public or >15m Private}
    E -->|No (Within Fresh TTL)| F[Keep Displaying - No Network Call]
    E -->|Yes| G[Check In-Flight Promise Map]
    
    G -->|Already In-Flight| H[Attach To Existing Promise]
    G -->|New Request| I[Background Conditional Fetch: If-None-Match ETag]
    
    I --> J{Server Response}
    J -->|304 Not Modified| K[Refresh Cache Timestamp - 0 Bytes]
    J -->|200 OK New Image| L[Write to .tmp -> Atomic Rename to .webp]
    J -->|Network Error / Offline| M[Silent Fallback - Keep Cached file://]
    
    L --> N[Update Index & Smoothly Emit New file:// URI]
    D --> O[Atomic Write to Cache & Display Image]
```

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
