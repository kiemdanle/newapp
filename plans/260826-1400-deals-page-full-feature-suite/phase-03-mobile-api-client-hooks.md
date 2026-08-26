---
phase: 3
title: "Mobile API Client & Hooks"
status: completed
priority: P1
dependencies: ["phase-01-shared-schemas-contracts", "phase-02-backend-api-search-filters"]
---

# Phase 3: Mobile API Client & Hooks

## Overview
Enhance the mobile client's TanStack React Query hooks in `apps/mobile/src/api/deals.ts` to support rich query parameters (search, filter, sort), store facet querying (`useDealStores`), optimistic voting invalidations, and robust cache management.

## Requirements

### Functional Requirements
- **`useDealFeed(filters: DealFeedFilters)`**:
  - Accept full filter object: `{ sort?: DealSort; q?: string; store?: string; minPrice?: number; maxPrice?: number; country?: string; expiryStatus?: DealExpiryStatus }`.
  - Serialize filters into stable TanStack Query keys `['deals', filters]`.
  - Infinite query fetching pages via `GET /deals?...` with cursor-based pagination.
  - Expose `refetch`, `isFetchingNextPage`, `hasNextPage`, `isLoading`, `isRefetching`.
- **`useDealStores()`**:
  - Fetch popular store names from `GET /deals/stores` with 5-minute stale time.
- **`useOptimisticDealVote(dealId: string)`**:
  - Perform instant optimistic UI updates on the deal score and user's vote status across both feed queries and single deal query.
  - Automatically rollback on network/server error.
- **Cache Invalidation & Management**:
  - On deal creation (`useCreateDeal`), deal update (`useUpdateDeal`), and deal deletion (`useDeleteDeal`), accurately invalidate active feed queries and the affected deal query.

### Non-Functional Requirements
- Stale time of 30 seconds for feed queries to prevent redundant network requests on tab switches while preserving freshness.
- Garbage collection time of 5 minutes.
- Error handling with user-facing error extraction.

## Architecture
```
apps/mobile/src/api/deals.ts
  ├── useDealFeed(filters: DealFeedFilters)
  │      └── useInfiniteQuery(['deals', filters], ...)
  ├── useDeal(id: string)
  │      └── useQuery(['deal', id], ...)
  ├── useDealStores()
  │      └── useQuery(['deal-stores'], ...)
  ├── useCreateDeal()
  │      └── useMutation (invalidates ['deals'], ['deal-stores'])
  ├── useUpdateDeal()
  │      └── useMutation (invalidates ['deals'], ['deal', id])
  ├── useDeleteDeal()
  │      └── useMutation (invalidates ['deals'], removes ['deal', id])
  └── useDealVote() / useDeleteDealVote()
         └── useMutation with optimistic cache updater
```

## Related Code Files
- Modify: `apps/mobile/src/api/deals.ts`
- Modify: `apps/mobile/src/features/deals/useOptimisticDealVote.ts`
- Test: `apps/mobile/__tests__/deals-api.test.ts` (new)

## Implementation Steps
1. **Define `DealFeedFilters` Interface in `apps/mobile/src/api/deals.ts`:**
   ```typescript
   export interface DealFeedFilters {
     sort?: DealSort;
     q?: string;
     store?: string;
     minPrice?: number;
     maxPrice?: number;
     country?: string;
     expiryStatus?: DealExpiryStatus;
   }
   ```
2. **Implement Parameterized `useDealFeed`:**
   - Build query string helper `buildDealQueryString(filters, cursor)`.
   - Update `queryKey: ['deals', filters]`.
3. **Implement `useDealStores` Hook:**
   - Call `apiClient.get<DealStoreFacet[]>('/deals/stores')`.
4. **Refactor `useOptimisticDealVote`:**
   - In `onMutate`: snapshot current queries matching `['deals']` and `['deal', dealId]`.
   - Update both cache locations optimistically with adjusted `upvoteCount`, `downvoteCount`, and `myVote`.
   - In `onError`: restore previous context snapshots.
   - In `onSettled`: invalidate affected queries.
5. **Add Automated Hook Tests in `apps/mobile/__tests__/deals-api.test.ts`:**
   - Test query key generation with various filter combinations.
   - Test query string serialization.

## Success Criteria
- [ ] `useDealFeed` correctly constructs query strings for all filter variations (`q`, `store`, `minPrice`, `maxPrice`, `expiryStatus`, `sort`).
- [ ] `useDealStores` successfully queries `/deals/stores`.
- [ ] Optimistic voting updates the UI immediately and reverts on error.
- [ ] Mutations invalidate active deal queries.

## Risk Assessment
- **Risk:** Filter object reference changes causing infinite re-fetching loops in React components.
- **Mitigation:** Use primitive values or memoized filter objects inside components before passing to `useDealFeed`.
