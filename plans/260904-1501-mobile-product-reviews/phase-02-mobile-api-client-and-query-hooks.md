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
Implement the mobile data layer in `apps/mobile/src/api/reviews.ts` using `@tanstack/react-query` v5 and the shared review contract. Provides declarative React hooks for loading product reviews, community reviews, personal review history, review submission/editing, deletion, and helpfulness voting with precise cache invalidation across both review queries and product detail aggregate counters (`['products', productId]`).

## Requirements

### Functional
- **Product Reviews Query (`useProductReviews`)**:
  - Fetches `GET /v1/products/:productId/reviews` with pagination (`cursor`, `limit`) and sorting (`sort`: `'score'` | `'new'` | `'rating'`).
  - Supports TanStack Query `useInfiniteQuery` for smooth paginated scrolling.
  - Query key: `['product-reviews', productId, options?.sort ?? 'score']`.
  - Fallback client: gracefully falls back to `fallbackQueryClient` if rendered outside a `QueryClientProvider`.
- **Community Reviews Feed Query (`useCommunityReviews`)**:
  - Fetches `GET /v1/reviews/community` with pagination (`cursor`, `limit`) and sorting (`sort`: `'score'` | `'new'`).
  - Query key: `['community-reviews', options?.sort ?? 'score']`.
- **Personal Reviews Query (`useMyReviews`)**:
  - Fetches `GET /v1/me/reviews` for the logged-in user.
  - Query key: `['my-reviews']`.
- **Review Submission Mutation (`useCreateReview`)**:
  - Executes `POST /v1/products/:productId/reviews` with `{ rating, body }`.
  - **Critical Invalidation**: Invalidation MUST target `['products', productId]` (the exact key used by `useProduct` in `apps/mobile/src/api/products.ts:42`), plus `['product-reviews', productId]`, `['my-reviews']`, and `['community-reviews']`. This guarantees that the product detail aggregate counters (`buyAgainCount`, `reviewCount`) update immediately.
- **Review Edit Mutation (`useUpdateReview`)**:
  - Executes `PATCH /v1/reviews/:reviewId` with `{ rating?, body? }`.
  - Invalidates `['products', productId]`, `['product-reviews', productId]`, `['my-reviews']`, and `['community-reviews']`.
- **Review Delete Mutation (`useDeleteReview`)**:
  - Executes `DELETE /v1/reviews/:reviewId`.
  - Invalidates `['products', productId]`, `['product-reviews', productId]`, and `['my-reviews']`.
- **Helpful Vote Mutation (`useVoteReviewHelpful`)**:
  - Calls `POST /v1/reviews/:reviewId/helpful` with `{ helpful: boolean }` or `DELETE /v1/reviews/:reviewId/helpful`.
  - Performs optimistic cache updates on the active `['product-reviews', productId]` and `['community-reviews']` query caches so the helpful count increments immediately with zero latency.

### Non-Functional
- Strictly typed using `@expyrico/shared` types: `Review`, `ReviewRating`, `ReviewSort`, `ReviewCreate`, `ReviewPatch`, `ReviewVote`.
- Error mapping: converts API error payloads into actionable errors (`409 REVIEW_ALREADY_EXISTS` -> "You have already reviewed this product", `422 REVIEW_HAS_NO_COMMENT` -> "Only reviews with comments can be voted helpful").

## Architecture & Interfaces

```typescript
// apps/mobile/src/api/reviews.ts

export interface ProductReviewsQueryOptions {
  sort?: ReviewSort; // 'score' | 'new' | 'rating'
  limit?: number;
}

export interface CommunityReviewsQueryOptions {
  sort?: 'score' | 'new';
  limit?: number;
}

export function useProductReviews(productId: string | undefined, options?: ProductReviewsQueryOptions);
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
   - Import `useQuery`, `useInfiniteQuery`, `useMutation`, `useQueryClient`, `QueryClient`, `QueryClientContext` from `@tanstack/react-query`.
   - Import `apiClient` from `./client`.
   - Setup fallback query client singleton.

2. **Implement Query Hooks**:
   - `useProductReviews(productId, options)`:
     - Calls `GET /products/${productId}/reviews`.
     - Supports infinite pagination with `cursor`.
   - `useCommunityReviews(options)`:
     - Calls `GET /reviews/community`.
     - Supports infinite pagination with `cursor`.
   - `useMyReviews(options)`:
     - Calls `GET /me/reviews`.

3. **Implement Mutation Hooks with Cache Invalidation**:
   - `useCreateReview()`:
     - Invalidation targets:
       - `queryClient.invalidateQueries({ queryKey: ['products', productId] })`
       - `queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] })`
       - `queryClient.invalidateQueries({ queryKey: ['my-reviews'] })`
       - `queryClient.invalidateQueries({ queryKey: ['community-reviews'] })`
   - `useUpdateReview()`:
     - Same 4 query invalidations.
   - `useDeleteReview()`:
     - Same query invalidations.
   - `useVoteReviewHelpful(productId)`:
     - Optimistic mutation on `['product-reviews', productId]` and `['community-reviews']`.

4. **Unit Tests (`apps/mobile/tests/unit/api-reviews.test.ts`)**:
   - Assert exact query keys and parameters.
   - Assert `['products', productId]` invalidation on create/update/delete.
   - Assert optimistic vote count updates and error rollback.

## Success Criteria
- [ ] `apps/mobile/src/api/reviews.ts` exports all query and mutation hooks with full type safety.
- [ ] Invalidation explicitly targets `['products', productId]`, refreshing `useProduct` aggregate counters.
- [ ] Optimistic voting updates the UI instantly without network waiting.
- [ ] Unit tests pass 100%.

## Risk Assessment
- **Risk**: Stale product aggregate rating after review submission due to query key mismatch (`['product', id]` vs `['products', id]`).
- **Mitigation**: Verified against `apps/mobile/src/api/products.ts:42`: authoritative key is `['products', id]`. Tested in unit test suite.
