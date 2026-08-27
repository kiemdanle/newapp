---
phase: 4
title: "Verification"
status: pending
priority: P1
dependencies: ["phase-01-storagecore", "phase-02-revalidationengine", "phase-03-componentintegration"]
---

# Phase 4: Verification

## Overview
Perform comprehensive unit testing, SWR revalidation lifecycle simulation, offline fallback validation, LRU cache boundary testing (100 MB budget), and end-to-end typechecks across `@expyrico/mobile` and `@expyrico/shared`.

<!-- Updated: Validation Session 2026-08-27 - 100 MB LRU Bounds & SWR Revalidation Verification -->

## Requirements
- **Functional Verification**:
  - Unit tests for `ImageDiskCache`: get, set, delete, purgeUserPrivate, LRU 100 MB cap eviction.
  - SWR lifecycle simulation:
    1. Cold start cache miss -> fetches and stores image on disk.
    2. Warm start cache hit -> renders image immediately (<5ms).
    3. Stale cache revalidation with 304 Not Modified -> retains cached image, updates timestamp, 0 payload bytes.
    4. Modified image with 200 OK -> updates local cache and updates rendered URI.
    5. Network failure / offline state -> continues displaying cached image without error.
    6. Sign-out purge -> clears private images while preserving public catalog images.
- **Non-functional Verification**:
  - Zero TypeScript compiler errors (`tsc --noEmit`).
  - Mobile Jest test suite passing.

## Test Matrix

| Test Case | Scenario | Expected Outcome |
|---|---|---|
| **L1/L2 Cache Hit** | Request previously viewed image URI | Returns cached data URI immediately on Frame 0 |
| **SWR 304 Not Modified** | Server image unchanged | Revalidates in background with ETag, 0 bytes downloaded, cache timestamp refreshed |
| **SWR 200 Replacement** | Image updated on server | Replaces disk cache and updates component state seamlessly |
| **Offline Resilience** | Device network disconnected | Renders cached image gracefully with zero errors |
| **Account Privacy Purge** | User signs out | Private images deleted from storage; public images preserved |
| **LRU Size Capping** | Cache exceeds 100 MB budget | Oldest entries evicted automatically until under cap |

## Related Code Files
- Create: `apps/mobile/src/cache/__tests__/image-disk-cache.test.ts`
- Create: `apps/mobile/src/cache/__tests__/useCachedImage.test.ts`
- Run: `pnpm --filter @expyrico/mobile typecheck`
- Run: `pnpm --filter @expyrico/mobile test`

## Implementation Steps
1. Create `image-disk-cache.test.ts` covering:
   - Synchronous and asynchronous cache hits.
   - Storage persistence across reloads.
   - User-scoped private image purging.
   - LRU eviction order when reaching 100 MB size threshold.
2. Create `useCachedImage.test.ts` covering:
   - Immediate Frame-0 return from disk.
   - Conditional fetch with `If-None-Match`.
   - 304 vs 200 update flow.
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
