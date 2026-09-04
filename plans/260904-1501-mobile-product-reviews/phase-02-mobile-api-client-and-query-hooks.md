---
phase: 2
title: "Mobile API Client, Query Hooks, and Cache Invalidation"
status: pending
priority: P1
effort: "3-4h"
dependencies: [1]
---

# Phase 2: Mobile API Client, Query Hooks, and Cache Invalidation

## Overview
Implement the mobile data layer in `apps/mobile/src/api/reviews.ts` using `@tanstack/react-query` v5 and the shared review contract. Provides declarative React hooks for loading product reviews, community reviews, personal review history, author's own review on a product, review submission/editing, deletion, and helpfulness voting with client-side review ID deduplication, full query cancellation, in-flight mutexing to prevent double-tap desync, and precise cache invalidation across both review queries and product detail aggregate counters (`['products', productId]`).

<!-- Updated: Red Team Review Round 7 - Added concrete in-flight voting mutex (votingReviewIds), cancelQueries onMutate, onSettled reconciliation, client-side deduplicateReviews helper, and thumbs-up only voting -->

## Requirements

### Functional
- **Product Reviews Query (`useProductReviews`)**:
  - Fetches `GET /v1/products/:productId/reviews` with pagination (`cursor`, `limit`) and sorting (`sort`: `'score'` | `'new'`).
  - Supports TanStack Query `useInfiniteQuery` for smooth paginated scrolling.
  - Query key: `['product-reviews', productId, options?.sort ?? 'score']`.
- **Client-Side Review ID Deduplication**:
  - Export a pure helper `deduplicateReviews(pages: { items: Review[] }[]): Review[]` using `Set<string>` over `review.id`.
  - Ensures that when a review's Wilson score mutates from live votes and shifts across cursor boundaries, the mobile feed gracefully skips duplicate cards without visual layout jumps.
- **Author's Own Review Query (`useMyProductReview`)**:
  - Fetches `GET /v1/products/:productId/my-review` for the logged-in user.
  - Returns `Review | null` authoritatively without depending on community feed pages.
  - Query key: `['my-product-review', productId]`.
- **Community Reviews Feed Query (`useCommunityReviews`)**:
  - Fetches `GET /v1/reviews/community` with pagination (`cursor`, `limit`) and sorting (`sort`: `'score'` | `'new'`).
  - Query key: `['community-reviews', options?.sort ?? 'score']`.
- **Personal Reviews Query (`useMyReviews`)**:
  - Fetches `GET /v1/me/reviews` with cursor pagination using `useInfiniteQuery`.
  - Query key: `['my-reviews']`.
- **Review Submission Mutation (`useCreateReview`)**:
  - Executes `POST /v1/products/:productId/reviews` with `{ rating, body }`.
  - **Critical Invalidation**: Invalidation MUST target `['products', productId]` (the exact key used by `useProduct` in `apps/mobile/src/api/products.ts:42`), plus `['product-reviews', productId]`, `['my-product-review', productId]`, `['my-reviews']`, and `['community-reviews']`.
- **Review Edit Mutation (`useUpdateReview`)**:
  - Executes `PATCH /v1/reviews/:reviewId` with `{ rating?, body? }` (supports explicit `body: null` to clear comment).
  - Invalidates `['products', productId]`, `['product-reviews', productId]`, `['my-product-review', productId]`, `['my-reviews']`, and `['community-reviews']`.
- **Review Delete Mutation (`useDeleteReview`)**:
  - Executes `DELETE /v1/reviews/:reviewId`.
  - Invalidates `['products', productId]`, `['product-reviews', productId]`, `['my-product-review', productId]`, and `['my-reviews']`.
- **Helpful Vote Mutation (`useVoteReviewHelpful`) with Concurrency Protection**:
  - **In-Flight Lock**: Maintains a local set of in-flight review IDs (`votingReviewIds: Set<string>`); subsequent clicks on the same review while a vote mutation is pending are dropped immediately.
  - **Query Cancellation**: Inside `onMutate`:
    ```typescript
    await queryClient.cancelQueries({ queryKey: ['product-reviews', productId] });
    await queryClient.cancelQueries({ queryKey: ['community-reviews'] });
    ```
  - **Optimistic Snapshot & Toggle**:
    - Snapshots previous query data for both keys.
    - If `currentVote === 'helpful'`: calls `DELETE /reviews/${reviewId}/helpful`, toggles `myVote` to `null` and `helpfulCount = Math.max(0, helpfulCount - 1)`.
    - If `currentVote !== 'helpful'`: calls `POST /reviews/${reviewId}/helpful` with `{ helpful: true }`, toggles `myVote` to `'helpful'` and `helpfulCount += 1`.
  - **Rollback on Error**: Reverts snapshot on network failure and presents toast error.
  - **Settled Reconciliation**: On `onSettled`, invalidates `['product-reviews', productId]` and `['community-reviews']` to reconcile with server authoritative state.

### Non-Functional
- Strictly typed using `@expyrico/shared` types: `Review`, `ReviewRating`, `ReviewSort`, `ReviewCreate`, `ReviewPatch`, `ReviewHelpful`.
- Uses project's standard `QueryClientProvider` without artificial fallback singletons, ensuring production cache consistency.

## Architecture & Interfaces

```typescript
// apps/mobile/src/api/reviews.ts

export interface ProductReviewsQueryOptions {
  sort?: 'score' | 'new';
  limit?: number;
}

export interface CommunityReviewsQueryOptions {
  sort?: 'score' | 'new';
  limit?: number;
}

export function deduplicateReviews(pages: { items: Review[] }[]): Review[];
export function useProductReviews(productId: string | undefined, options?: ProductReviewsQueryOptions);
export function useMyProductReview(productId: string | undefined);
export function useCommunityReviews(options?: CommunityReviewsQueryOptions);
export function useMyReviews(options?: { limit?: number });
export function useCreateReview();
export function useUpdateReview();
export function useDeleteReview();
export function useVoteReviewHelpful(productId?: string);
```

## Related Code Files
- Create: `apps/mobile/src/api/reviews.ts`
- Read: `apps/mobile/src/api/products.ts` (query key `['products', id]`)
- Read: `packages/shared/src/schemas/review.ts`
- Read: `apps/mobile/src/api/client.ts`
- Test: `apps/mobile/tests/unit/api-reviews.test.ts`

## Implementation Steps

1. **Scaffold `apps/mobile/src/api/reviews.ts`**:
   - Import `useQuery`, `useInfiniteQuery`, `useMutation`, `useQueryClient` from `@tanstack/react-query`.
   - Import `apiClient` from `./client`.
   - Implement `deduplicateReviews` helper.

2. **Implement Query Hooks**:
   - `useProductReviews(productId, options)`: Infinite query on `GET /products/${productId}/reviews`.
   - `useMyProductReview(productId)`: Query on `GET /products/${productId}/my-review`.
   - `useCommunityReviews(options)`: Infinite query on `GET /reviews/community`.
   - `useMyReviews(options)`: Infinite query on `GET /me/reviews`.

3. **Implement Mutation Hooks with Cache Invalidation & In-Flight Lock**:
   - Invalidate `['products', productId]` and review query keys on create/update/delete.
   - `useVoteReviewHelpful(productId)`:
     - Guarantees single-tap execution via `votingReviewIds` lock.
     - Calls `cancelQueries` before snapshotting.
     - Performs optimistic toggle (`null -> helpful` via POST, `helpful -> null` via DELETE).
     - Calls `invalidateQueries` in `onSettled` for reconciliation.

4. **Unit Tests (`apps/mobile/tests/unit/api-reviews.test.ts`)**:
   - Assert exact query keys and parameters.
   - Assert `deduplicateReviews` correctly collapses duplicate items across pages.
   - Assert in-flight lock drops rapid double clicks on the same review.
   - Assert `cancelQueries` called before optimistic state mutation.
   - Assert `['products', productId]` invalidation on create/update/delete.
   - Assert optimistic transitions: `null -> helpful`, `helpful -> null`, and rollback on error.

## Success Criteria
- [ ] `apps/mobile/src/api/reviews.ts` exports all query and mutation hooks with full type safety.
- [ ] In-flight lock and `cancelQueries` prevent double-tap optimistic desync.
- [ ] `deduplicateReviews` eliminates duplicate items across infinite query pages.
- [ ] `useMyProductReview` returns authoritative user review state.
- [ ] Voting uses thumbs-up only (`ReviewHelpful` with `{ helpful: true }` and `DELETE`).
- [ ] Invalidation explicitly targets `['products', productId]`, refreshing `useProduct` aggregate counters.
- [ ] Optimistic voting updates the UI instantly with tested rollback handling.
- [ ] Unit tests pass 100%.
