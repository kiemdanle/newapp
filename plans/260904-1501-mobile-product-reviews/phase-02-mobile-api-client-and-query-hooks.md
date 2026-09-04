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

<!-- Updated: Validation Session 1 - Aligned voting payload to ReviewHelpful ({ helpful: boolean }), added cache transition tests (null -> helpful, helpful -> null, DELETE rollback), and standardized sorting options to score/new -->

## Requirements

### Functional
- **Product Reviews Query (`useProductReviews`)**:
  - Fetches `GET /v1/products/:productId/reviews` with pagination (`cursor`, `limit`) and sorting (`sort`: `'score'` | `'new'`).
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
  - **Critical Invalidation**: Invalidation MUST target `['products', productId]` (the exact key used by `useProduct` in `apps/mobile/src/api/products.ts:42`), plus `['product-reviews', productId]`, `['my-reviews']`, and `['community-reviews']`. This guarantees that the product detail aggregate counters (`buyAgainCount`, `ratingCount`, `reviewCount`) update immediately.
- **Review Edit Mutation (`useUpdateReview`)**:
  - Executes `PATCH /v1/reviews/:reviewId` with `{ rating?, body? }`.
  - Invalidates `['products', productId]`, `['product-reviews', productId]`, `['my-reviews']`, and `['community-reviews']`.
- **Review Delete Mutation (`useDeleteReview`)**:
  - Executes `DELETE /v1/reviews/:reviewId`.
  - Invalidates `['products', productId]`, `['product-reviews', productId]`, and `['my-reviews']`.
- **Helpful Vote Mutation (`useVoteReviewHelpful`)**:
  - Validates and sends typed payload `ReviewHelpful` (`{ helpful: boolean }`) via `POST /v1/reviews/:reviewId/helpful` to add a vote, or calls `DELETE /v1/reviews/:reviewId/helpful` to remove a vote.
  - Performs optimistic cache updates on the active `['product-reviews', productId]` and `['community-reviews']` query caches:
    - **Transition 1 (`null -> helpful`)**: Tapping unvoted helpful button immediately marks `myVote = 'helpful'` and increments `helpfulCount += 1`.
    - **Transition 2 (`helpful -> null`)**: Tapping already-helpful button calls DELETE, immediately marks `myVote = null` and decrements `helpfulCount -= 1`.
    - **Error Rollback**: If network fails, reverts cache snapshot and displays toast error.

### Non-Functional
- Strictly typed using `@expyrico/shared` types: `Review`, `ReviewRating`, `ReviewSort`, `ReviewCreate`, `ReviewPatch`, `ReviewHelpful`.
- Error mapping: converts API error payloads into actionable errors (`409 REVIEW_ALREADY_EXISTS` -> "You have already reviewed this product", `422 REVIEW_HAS_NO_COMMENT` -> "Only reviews with comments can be voted helpful").

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
- Read: `packages/shared/src/schemas/review.ts` (`ReviewHelpful`, `ReviewCreate`, etc.)
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
     - Accepts `{ reviewId: string, currentVote: 'helpful' | null }`.
     - If `currentVote === 'helpful'`: calls `DELETE /reviews/${reviewId}/helpful`.
     - Else: calls `POST /reviews/${reviewId}/helpful` with `{ helpful: true }` (`ReviewHelpful`).
     - Optimistic mutation on `['product-reviews', productId]` and `['community-reviews']`.

4. **Unit Tests (`apps/mobile/tests/unit/api-reviews.test.ts`)**:
   - Assert exact query keys and parameters.
   - Assert `['products', productId]` invalidation on create/update/delete.
   - Assert optimistic transitions: `null -> helpful`, `helpful -> null`, and rollback on error.

## Success Criteria
- [ ] `apps/mobile/src/api/reviews.ts` exports all query and mutation hooks with full type safety.
- [ ] Voting payload uses `ReviewHelpful` (`{ helpful: boolean }`), not `ReviewVote`.
- [ ] Invalidation explicitly targets `['products', productId]`, refreshing `useProduct` aggregate counters.
- [ ] Optimistic voting updates the UI instantly with tested rollback handling.
- [ ] Unit tests pass 100%.

## Risk Assessment
- **Risk**: Optimistic voting cache mutation desynchronizes infinite query page structure.
- **Mitigation**: Pure immutable map over `pages[i].items` ensuring structure stability and deterministic rollback.
