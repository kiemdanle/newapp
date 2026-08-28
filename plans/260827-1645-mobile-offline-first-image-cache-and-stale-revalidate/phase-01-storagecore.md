---
phase: 1
title: "StorageCore"
status: complete
priority: P1
dependencies: []
---

# Phase 1: StorageCore

## Overview
Implement the core on-device persistent image caching layer (`ImageDiskCache`) in `apps/mobile/src/cache/image-disk-cache.ts`. Provides a decoupled architecture separating lightweight AsyncStorage metadata indexing from sandboxed binary file storage on disk, preventing Android SQLite `CursorWindowAllocationException` while enforcing a 100 MB LRU storage budget and strict multi-account privacy isolation.

<!-- Updated: Red Team Review 2026-08-27 - Decoupled AsyncStorage Metadata Index + Sandboxed Disk File Storage & Privacy Isolation -->

## Requirements
- **Functional**:
  - Decoupled Storage Architecture:
    - **Metadata Ledger (AsyncStorage)**: Keyed by `@img_meta:<hash>`, stores JSON `{ uri, localPath, etag, lastModified, timestamp, byteSize, isPrivate, userId }` (<200 bytes per record).
    - **Binary File Storage (Device Cache Dir)**: Stored as `file://${cacheDir}/img_<hash>.webp`.
  - Multi-Account Isolation:
    - Private images are stored under `${cacheDir}/user_${userId}/` and indexed with `userId`.
    - Public images are stored under `${cacheDir}/public/`.
  - Purge API:
    - `purgeAll()`: Clears both public and private cache files and indexes.
    - `purgeUserPrivate(userId: string)`: Clears only the specified user's private cache folder and index entries on `signOut()`.
  - 100 MB LRU Eviction:
    - Tracks total byte size and last accessed timestamps. Automatically prunes the oldest unaccessed files and metadata rows when total size exceeds 100 MB.
- **Non-functional**:
  - Memory consumption per cached item minimized.
  - Zero Android CursorWindow crashes (no large Base64 blobs stored in SQLite/AsyncStorage).

## Architecture

```
+-------------------------------------------------------------+
|                     ImageDiskCache                          |
|                                                             |
|  +-------------------------------------------------------+  |
|  | L1 In-Memory Index (Map<string, CacheMetadata>)       |  |
|  |   - Instant synchronous lookup (<1ms)                 |  |
|  +-------------------------------------------------------+  |
|                            |                                |
|                            v (miss / cold start)            |
|  +-------------------------------------------------------+  |
|  | AsyncStorage Metadata Index (@img_meta:<hash>)        |  |
|  |   - Key: @img_meta:<hash>                             |  |
|  |   - Value: { localPath, etag, lastModified, at, size }|  |
|  +-------------------------------------------------------+  |
|                            |                                |
|                            v (file payload on disk)         |
|  +-------------------------------------------------------+  |
|  | Sandboxed File System (file://${cacheDir}/...)        |  |
|  |   - Public: ${cacheDir}/public/<hash>.webp            |  |
|  |   - Private: ${cacheDir}/user_<id>/<hash>.webp        |  |
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
1. Create `image-cache-types.ts` defining `CacheMetadata`, `CacheOptions`, and `CacheKeyInput`.
2. Create `ImageDiskCache` singleton in `image-disk-cache.ts`:
   - `get(key: string): Promise<{ uri: string; metadata: CacheMetadata } | null>`
   - `getSync(key: string): { uri: string; metadata: CacheMetadata } | null` (L1 memory check)
   - `saveFile(key: string, bytes: ArrayBuffer | string, metadata: Partial<CacheMetadata>): Promise<string>`
   - `remove(key: string): Promise<void>`
   - `purgeUserPrivate(userId: string): Promise<void>`
   - `pruneLru(maxBytes?: number): Promise<void>` (caps at 100 MB)
3. Hydrate L1 index from AsyncStorage during mobile app bootstrap for zero-latency lookups.
4. Hook `session-store.ts` to call `purgeUserPrivate(userId)` on `signOut()` and `signIn()`.

## Success Criteria
- [ ] Cached images persist across app restart and are readable as `file://...` within <5ms.
- [ ] AsyncStorage rows remain <1KB each, preventing Android CursorWindow allocation exceptions.
- [ ] Private images are isolated per user and cleared when logging out.
- [ ] LRU prunes old entries when cache exceeds 100 MB capacity limit.

## Risk Assessment
- **Android CursorWindow Overflow**: Storing large blobs in AsyncStorage throws SQLite exceptions.
  - *Mitigation*: Raw image binary bytes are stored on the filesystem as `.webp` files; AsyncStorage only stores lightweight index entries.
- **Corrupted Cache Index**: Malformed storage data could throw during parse.
  - *Mitigation*: Wrap all reads in safe `try/catch` with automatic corrupted key removal.
