---
phase: 1
title: "StorageCore"
status: pending
priority: P1
dependencies: []
---

# Phase 1: StorageCore

## Overview
Implement the core on-device persistent image caching layer (`ImageDiskCache`) in `apps/mobile/src/cache/image-disk-cache.ts`. Provides a tiered L1 in-memory + L2 persistent storage engine with user-scoped isolation, automatic cache serialization, and size-bounded Least Recently Used (LRU) pruning (100 MB budget).

<!-- Updated: Validation Session 2026-08-27 - 100 MB LRU Budget & Native/AsyncStorage Storage Core -->

## Requirements
- **Functional**:
  - Store and retrieve image payloads and metadata (`dataUri`, `etag`, `lastModified`, `timestamp`, `byteSize`) persistently on device.
  - Tiered architecture: Fast L1 in-memory Map for microsecond synchronous hits + L2 persistent store for cold start instant persistence.
  - Multi-account isolation: User-scoped keys for private images (`${userId}::...`) and shared keys for public catalog photos.
  - Purge API: `purgeAll()`, `purgeUserPrivate(userId)`, and `purgeTarget(target)`.
  - LRU Eviction: Automatically track access timestamps and evict oldest items when total cache size exceeds 100 MB.
- **Non-functional**:
  - Memory consumption per cached item minimized.
  - Zero native build dependencies (uses `@react-native-async-storage/async-storage` already in `package.json`).

## Architecture

```
+-------------------------------------------------------------+
|                     ImageDiskCache                          |
|                                                             |
|  +-------------------------------------------------------+  |
|  | L1 Memory Cache (Map<string, CacheEntry>)             |  |
|  |   - Instant synchronous lookup (<1ms)                 |  |
|  +-------------------------------------------------------+  |
|                            |                                |
|                            v (miss / cold start)            |
|  +-------------------------------------------------------+  |
|  | L2 Persistent Storage (@image_cache:* in AsyncStorage)|  |
|  |   - Survives app restarts                             |  |
|  |   - Key: @img_c:<hash>                                |  |
|  |   - Value: { dataUri, etag, lastModified, size, at }  |  |
|  +-------------------------------------------------------+  |
|                            |                                |
|                            v (eviction)                     |
|  +-------------------------------------------------------+  |
|  | LRU Pruning Engine (Cap: 100MB / Max: 2000 items)     |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

## Related Code Files
- Create: `apps/mobile/src/cache/image-disk-cache.ts`
- Create: `apps/mobile/src/cache/image-cache-types.ts`
- Modify: `apps/mobile/src/auth/session-store.ts` (hook `purgeUserPrivate` on sign-out)

## Implementation Steps
1. Create `image-cache-types.ts` defining `CacheEntryMetadata`, `CacheOptions`, and `CacheKeyInput`.
2. Create `ImageDiskCache` singleton in `image-disk-cache.ts`:
   - `get(key: string): Promise<CacheEntry | null>`
   - `getSync(key: string): CacheEntry | null` (from L1 memory)
   - `set(key: string, entry: CacheEntry): Promise<void>`
   - `remove(key: string): Promise<void>`
   - `purgeUserPrivate(userId: string): Promise<void>`
   - `pruneLru(maxBytes?: number): Promise<void>` (defaults to 100 MB)
3. Wire cache initialization on mobile app bootstrap so metadata index is hydrated into L1 memory for zero-latency lookups.
4. Hook `session-store.ts` to call `purgeUserPrivate(userId)` on `signOut()` and `signIn()`.

## Success Criteria
- [ ] Cached images persist across app restart and are readable within <5ms.
- [ ] Private images are isolated per user and cleared when logging out.
- [ ] LRU prunes old entries when cache exceeds 100 MB capacity limit.

## Risk Assessment
- **Storage Quota Overflow**: If many high-resolution photos are cached, storage could grow.
  - *Mitigation*: Thumbnails and display WebP images are typically <50KB each; 100 MB budget stores >2,000 images. Hard cap at 100 MB with automatic LRU eviction.
- **Corrupted Cache Entry**: Bad JSON string in storage could throw during parse.
  - *Mitigation*: Wrap all reads in safe `try/catch` with automatic corrupted key removal.
