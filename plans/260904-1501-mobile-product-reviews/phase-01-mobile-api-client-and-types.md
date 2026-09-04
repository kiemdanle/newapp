---
phase: 1
title: "Mobile API Client, Query Hooks, and Shared Types"
status: pending
priority: P1
effort: "3-4h"
dependencies: []
---

# Phase 1: Mobile API Client, Query Hooks, and Shared Types

## Overview
Implement the complete, typed data-fetching and mutation layer in `apps/mobile/src/api/reviews.ts` using `@tanstack/react-query` v5 and the `@expyrico/shared` review contract. Provides declarative React hooks for loading product reviews, listing personal reviews, submitting new reviews, updating existing reviews, deleting reviews, and toggling helpfulness votes with query cache invalidation and optimistic updates.

## Requirements

### Functional
- **Product Reviews Query (`useProductReviews`)**:
  - Fetches `GET /v1/products/:productId/reviews` with pagination (`cursor`, `limit`) and sorting (`sort`: `'score'` | `'new'` | `'rating'`).
  - Supports TanStack Query `useInfiniteQuery` for smooth paginated scrolling.
  - Safely falls back to `fallbackQueryClient` if rendered outside a `QueryClientProvider` (maintaining unit test isolation).
- **Personal Reviews Query (`useMyReviews`)**:
  - Fetches `GET /v1/me/reviews` for the logged-in user.
- **Review Submission Mutation (`useCreateReview`)**:
  - Executes `POST /v1/products/:productId/reviews` with `{ rating, body }`.
  - On success, invalidates query keys: `['product-reviews', productId]`, `['my-reviews']`, and `['product', productId]`.
- **Review Edit Mutation (`useUpdateReview`)**:
  - Executes `PATCH /v1/reviews/:reviewId` with `{ rating?, body? }`.
  - Invalidates matching product review queries.
- **Review Delete Mutation (`useDeleteReview`)**:
  - Executes `DELETE /v1/reviews/:reviewId`.
- **Helpful Vote Mutation (`useVoteReviewHelpful`)**:
  - Calls `POST /v1/reviews/:reviewId/helpful` with `{ helpful: boolean }` or `DELETE /v1/reviews/:reviewId/helpful`.
  - Performs optimistic cache updates on the active `['product-reviews', productId]` infinite query data so the helpful count increments immediately with no UI flicker.

### Non-Functional
- Strictly typed using `@expyrico/shared` types: `Review`, `ReviewRating`, `ReviewSort`, `ReviewCreate`, `ReviewPatch`, `ReviewVote`.
- Error resilience: converts API errors into user-friendly localized messages (`409 REVIEW_ALREADY_EXISTS` -> "You have already reviewed this product", `422 REVIEW_HAS_NO_COMMENT` -> "Only reviews with comments can be voted helpful").

## Architecture & Interfaces

```typescript
// apps/mobile/src/api/reviews.ts

export interface ProductReviewsQueryOptions {
  sort?: ReviewSort; // 'score' | 'new' | 'rating'
  limit?: number;
}

export function useProductReviews(productId: string | undefined, options?: ProductReviewsQueryOptions);
export function useMyReviews(options?: { limit?: number });
export function useCreateReview();
export function useUpdateReview();
export function useDeleteReview();
export function useVoteReviewHelpful(productId: string);
```

## Related Code Files
- Create: `apps/mobile/src/api/reviews.ts`
- Read: `packages/shared/src/schemas/review.ts`
- Read: `apps/mobile/src/api/client.ts`
- Test: `apps/mobile/tests/unit/api-reviews.test.ts`

## Implementation Steps

1. **Scaffold `apps/mobile/src/api/reviews.ts`**:
   - Import `useQuery`, `useInfiniteQuery`, `useMutation`, `useQueryClient`, `QueryClient`, `QueryClientContext` from `@tanstack/react-query`.
   - Import `apiClient` from `./client`.
   - Import `Review`, `ReviewListQuery`, `ReviewCreate`, `ReviewPatch`, `ReviewRating`, `ReviewSort` from `@expyrico/shared`.
   - Setup fallback query client singleton for resilient test renders.

2. **Implement Query Hooks**:
   - `useProductReviews(productId, { sort = 'score', limit = 20 })`:
     - Calls `apiClient.get<{ items: Review[], cursor: string | null }>(/products/${productId}/reviews?sort=${sort}&limit=${limit}&cursor=${pageParam})`.
     - Returns infinite query results with `getNextPageParam: (lastPage) => lastPage.cursor ?? undefined`.
   - `useMyReviews({ limit = 20 })`:
     - Calls `apiClient.get<{ items: Review[], cursor: string | null }>(/me/reviews?limit=${limit}&cursor=${pageParam})`.

3. **Implement Mutation Hooks with Invalidation & Optimistic Updates**:
   - `useCreateReview()`:
     - `mutationFn: ({ productId, input }: { productId: string, input: ReviewCreate }) => apiClient.post<Review>(/products/${productId}/reviews, input)`.
     - `onSuccess`: invalidates queries.
   - `useUpdateReview()`:
     - `mutationFn: ({ reviewId, input }: { reviewId: string, input: ReviewPatch }) => apiClient.patch<Review>(/reviews/${reviewId}, input)`.
   - `useDeleteReview()`:
     - `mutationFn: (reviewId: string) => apiClient.delete(/reviews/${reviewId})`.
   - `useVoteReviewHelpful(productId: string)`:
     - Implements `onMutate` to snapshot previous cache, optimistically toggle `myVote` and update `helpfulCount`, with `onError` rollback.

4. **Unit Tests (`apps/mobile/tests/unit/api-reviews.test.ts`)**:
   - Verify hook query params formatting.
   - Verify mutation payloads and cache invalidation calls.

## Success Criteria
- [ ] `apps/mobile/src/api/reviews.ts` exports all 6 hooks with full type safety.
- [ ] Query keys follow project conventions (`['product-reviews', productId, ...]` and `['my-reviews', ...]`).
- [ ] Optimistic updates correctly increment and decrement `helpfulCount`.
- [ ] Unit tests pass with 100% assertion coverage.

## Risk Assessment
- **Risk**: Query cache corruption during infinite query pagination when an optimistic vote updates one page.
- **Mitigation**: Use `queryClient.setQueryData` iterating over `data.pages` map to update the exact review item by ID without restructuring page boundaries.
