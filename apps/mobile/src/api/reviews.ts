import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type {
  Review,
  ReviewCreate,
  ReviewPatch,
} from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

export interface ProductReviewsQueryOptions {
  sort?: 'score' | 'new';
  limit?: number;
}

export interface CommunityReviewsQueryOptions {
  sort?: 'score' | 'new';
  limit?: number;
}

export interface ReviewListPage {
  items: Review[];
  cursor: string | null;
}

/**
 * Pure helper that merges infinite query pages and eliminates duplicate review items
 * using a Set over review.id to gracefully absorb live score shifts across page boundaries.
 */
export function deduplicateReviews(pages: { items?: Review[] }[] | undefined): Review[] {
  if (!pages || !Array.isArray(pages)) return [];
  const seen = new Set<string>();
  const result: Review[] = [];
  for (const page of pages) {
    if (!page || !Array.isArray(page.items)) continue;
    for (const item of page.items) {
      if (item && item.id && !seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }
  return result;
}

/**
 * Helper to identify whether a review was authored by the current user,
 * checking the server-derived `isOwnReview` flag first, with a fallback
 * to matching user UUIDs for backward/forward compatibility across server revisions.
 */
export function isUserOwnReview(
  review: Review | null | undefined,
  currentUserId?: string | null,
): boolean {
  if (!review) return false;
  if (review.isOwnReview) return true;
  if (currentUserId) {
    const rawUserId = (review as any).userId ?? (review as any).author?.id;
    return Boolean(rawUserId && rawUserId === currentUserId);
  }
  return false;
}

export function useProductReviews(
  productId: string | undefined,
  options?: ProductReviewsQueryOptions,
) {
  const sort = options?.sort ?? 'score';
  const limit = options?.limit ?? 20;

  return useInfiniteQuery<ReviewListPage>({
    queryKey: ['product-reviews', productId, sort],
    enabled: Boolean(productId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = `?sort=${encodeURIComponent(sort)}&limit=${limit}${
        pageParam ? `&cursor=${encodeURIComponent(pageParam as string)}` : ''
      }`;
      return apiClient.get<ReviewListPage>(`/products/${productId}/reviews${qs}`);
    },
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useMyProductReview(productId: string | undefined) {
  return useQuery<{ review: Review | null }>({
    queryKey: ['my-product-review', productId],
    enabled: Boolean(productId),
    queryFn: () => apiClient.get<{ review: Review | null }>(`/products/${productId}/my-review`),
    staleTime: 30_000,
  });
}

export function useCommunityReviews(options?: CommunityReviewsQueryOptions) {
  const sort = options?.sort ?? 'score';
  const limit = options?.limit ?? 20;

  return useInfiniteQuery<ReviewListPage>({
    queryKey: ['community-reviews', sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = `?sort=${encodeURIComponent(sort)}&limit=${limit}${
        pageParam ? `&cursor=${encodeURIComponent(pageParam as string)}` : ''
      }`;
      return apiClient.get<ReviewListPage>(`/reviews/community${qs}`);
    },
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useMyReviews(options?: { limit?: number }) {
  const limit = options?.limit ?? 20;

  return useInfiniteQuery<ReviewListPage>({
    queryKey: ['my-reviews'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const qs = `?limit=${limit}${
        pageParam ? `&cursor=${encodeURIComponent(pageParam as string)}` : ''
      }`;
      return apiClient.get<ReviewListPage>(`/me/reviews${qs}`);
    },
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: ReviewCreate }) =>
      apiClient.post<Review>(`/products/${productId}/reviews`, input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_data, { productId }) => {
      void qc.invalidateQueries({ queryKey: ['products', productId] });
      void qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
      void qc.invalidateQueries({ queryKey: ['my-product-review', productId] });
      void qc.invalidateQueries({ queryKey: ['my-reviews'] });
      void qc.invalidateQueries({ queryKey: ['community-reviews'] });
    },
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      reviewId,
      patch,
    }: {
      reviewId: string;
      productId: string;
      patch: ReviewPatch;
    }) => apiClient.patch<Review>(`/reviews/${reviewId}`, patch),
    onSuccess: (_data, { productId }) => {
      void qc.invalidateQueries({ queryKey: ['products', productId] });
      void qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
      void qc.invalidateQueries({ queryKey: ['my-product-review', productId] });
      void qc.invalidateQueries({ queryKey: ['my-reviews'] });
      void qc.invalidateQueries({ queryKey: ['community-reviews'] });
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; productId: string }) =>
      apiClient.delete<void>(`/reviews/${reviewId}`),
    onSuccess: (_data, { productId }) => {
      void qc.invalidateQueries({ queryKey: ['products', productId] });
      void qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
      void qc.invalidateQueries({ queryKey: ['my-product-review', productId] });
      void qc.invalidateQueries({ queryKey: ['my-reviews'] });
      void qc.invalidateQueries({ queryKey: ['community-reviews'] });
    },
  });
}

/** In-flight lock set to prevent rapid double-tap desync on the same review */
export const votingReviewIds = new Set<string>();

export interface VoteReviewHelpfulArgs {
  reviewId: string;
  currentVote: 'helpful' | 'not_helpful' | null | undefined;
}

export function useVoteReviewHelpful(productId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewId, currentVote }: VoteReviewHelpfulArgs) => {
      if (currentVote === 'helpful') {
        return apiClient.delete<void>(`/reviews/${reviewId}/helpful`);
      }
      return apiClient.post<void>(`/reviews/${reviewId}/helpful`, { helpful: true });
    },
    onMutate: async ({ reviewId, currentVote }) => {
      // If a vote for this review is already in flight, drop concurrent invocation
      if (votingReviewIds.has(reviewId)) {
        throw new Error('Vote already in flight');
      }
      votingReviewIds.add(reviewId);

      // Cancel outgoing refetches so they don't overwrite our optimistic update
      if (productId) {
        await qc.cancelQueries({ queryKey: ['product-reviews', productId] });
      }
      await qc.cancelQueries({ queryKey: ['community-reviews'] });

      // Helper to optimistically toggle review in paginated cache
      const updateReviewInPages = (oldData: InfiniteData<ReviewListPage> | undefined) => {
        if (!oldData) return oldData;
        const nextVote = currentVote === 'helpful' ? null : ('helpful' as const);
        const countDelta = currentVote === 'helpful' ? -1 : 1;

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              if (item.id !== reviewId) return item;
              return {
                ...item,
                myVote: nextVote,
                helpfulCount: Math.max(0, item.helpfulCount + countDelta),
              };
            }),
          })),
        };
      };

      // Snapshot previous data for rollback
      const previousProductReviews = productId
        ? qc.getQueryData<InfiniteData<ReviewListPage>>(['product-reviews', productId, 'score'])
        : undefined;
      const previousCommunityReviews = qc.getQueryData<InfiniteData<ReviewListPage>>([
        'community-reviews',
        'score',
      ]);

      // Optimistically update
      if (productId) {
        qc.setQueriesData<InfiniteData<ReviewListPage>>(
          { queryKey: ['product-reviews', productId] },
          updateReviewInPages,
        );
      }
      qc.setQueriesData<InfiniteData<ReviewListPage>>(
        { queryKey: ['community-reviews'] },
        updateReviewInPages,
      );

      return { previousProductReviews, previousCommunityReviews, reviewId };
    },
    onError: (_err, _vars, context) => {
      if (context) {
        if (productId && context.previousProductReviews) {
          qc.setQueryData(
            ['product-reviews', productId, 'score'],
            context.previousProductReviews,
          );
        }
        if (context.previousCommunityReviews) {
          qc.setQueryData(['community-reviews', 'score'], context.previousCommunityReviews);
        }
      }
    },
    onSettled: (_data, _err, vars) => {
      if (vars?.reviewId) {
        votingReviewIds.delete(vars.reviewId);
      }
      if (productId) {
        void qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
      }
      void qc.invalidateQueries({ queryKey: ['community-reviews'] });
    },
  });
}
