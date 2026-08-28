---
phase: 4
title: "Verification"
status: complete
priority: P1
dependencies: ["phase-01-storagecore", "phase-02-revalidationengine", "phase-03-componentintegration"]
---

# Phase 4: Verification

## Overview
Perform comprehensive unit testing, SWR revalidation lifecycle simulation, offline fallback validation, concurrent in-flight deduplication tests, multi-user privacy isolation tests, and monorepo typechecks across `@expyrico/mobile` and `@expyrico/shared`.

<!-- Updated: Red Team Review 2026-08-27 - Concurrency Deduplication, Multi-User Isolation & Decoupled Storage Tests -->

## Requirements
- **Functional Verification**:
  - Unit tests for `ImageDiskCache`: get, set, delete, purgeUserPrivate, LRU 100 MB cap eviction.
  - Verification of decoupled storage: AsyncStorage keys contain only metadata (<1KB), preventing CursorWindow errors.
  - SWR lifecycle simulation:
    1. Cold start cache miss -> fetches and stores image on disk.
    2. Warm start cache hit -> renders image immediately (<5ms).
    3. Stale cache revalidation with 304 Not Modified -> retains cached image, updates timestamp, 0 payload bytes.
    4. Modified image with 200 OK -> updates local cache and updates rendered URI via atomic file commit.
    5. Concurrent requests for same image URI -> exactly 1 network fetch triggered.
    6. Network failure / offline state -> continues displaying cached image without error.
    7. Sign-out purge -> clears private images while preserving public catalog images.
- **Non-functional Verification**:
  - Zero TypeScript compiler errors (`tsc --noEmit`).
  - Mobile Jest test suite passing.

## Test Matrix

| Test Case | Scenario | Expected Outcome |
|---|---|---|
| **L1/L2 Cache Hit** | Request previously viewed image URI | Returns cached file URI immediately on Frame 0 |
| **SWR 304 Not Modified** | Server image unchanged | Revalidates in background with ETag, 0 bytes downloaded, cache timestamp refreshed |
| **SWR 200 Replacement** | Image updated on server | Replaces disk cache via atomic rename and updates component state seamlessly |
| **In-Flight Deduplication** | 5 concurrent requests for same URI | Only 1 network request fired; all 5 callers resolve with cached file |
| **Offline Resilience** | Device network disconnected | Renders cached image gracefully with zero errors |
| **Account Privacy Purge** | User signs out | Private images deleted from disk and index; public images preserved |
| **CursorWindow Safety** | Store 100 images in cache | AsyncStorage index rows strictly <1KB each |
| **LRU Size Capping** | Cache exceeds 100 MB budget | Oldest entries evicted automatically until under cap |

## Related Code Files
- Create: `apps/mobile/src/cache/__tests__/image-disk-cache.test.ts`
- Create: `apps/mobile/src/cache/__tests__/useCachedImage.test.ts`
- Run: `pnpm --filter @expyrico/mobile typecheck`
- Run: `pnpm --filter @expyrico/mobile test`

## Implementation Steps
1. Create `image-disk-cache.test.ts` covering:
   - Synchronous and asynchronous cache hits.
   - Decoupled storage (AsyncStorage metadata index vs file disk storage).
   - User-scoped private image purging on logout.
   - LRU eviction order when reaching 100 MB size threshold.
2. Create `useCachedImage.test.ts` covering:
   - Immediate Frame-0 return from disk.
   - In-flight promise deduplication across simultaneous callers.
   - Conditional fetch with `If-None-Match`.
   - 304 vs 200 update flow with atomic rename.
   - Offline fallback handling.
3. Run full monorepo typecheck (`@expyrico/shared`, `@expyrico/api`, `@expyrico/admin`, `@expyrico/mobile`).
4. Execute mobile test suite and verify 100% pass rate.

## Success Criteria
- [ ] All unit tests pass with zero failures.
- [ ] Monorepo typecheck reports 0 errors.
- [ ] No regression in existing image display or photo upload flows.

## Risk Assessment
- **AsyncStorage Mocking in Jest**: Tests may need reliable mock for AsyncStorage and fetch.
  - *Mitigation*: Use standard `@react-native-async-storage/async-storage/jest/async-storage-mock` already configured in the repo.
