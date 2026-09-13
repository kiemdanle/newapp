import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  deduplicateReviews,
  useProductReviews,
  useMyProductReview,
  useCommunityReviews,
  useMyReviews,
  useCreateReview,
  useUpdateReview,
  useDeleteReview,
  useVoteReviewHelpful,
  votingReviewIds,
} from '../../src/api/reviews';
import { apiClient } from '../../src/api/client';
import type { Review } from '@expyrico/shared';

jest.mock('../../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

const mockReview1: Review = {
  id: 'rev-1',
  productId: 'prod-1',
  rating: 'buy_again',
  body: 'Great taste!',
  helpfulCount: 5,
  notHelpfulCount: 0,
  score: 0.9,
  status: 'visible',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  isOwnReview: false,
  myVote: null,
};

const mockReview2: Review = {
  id: 'rev-2',
  productId: 'prod-1',
  rating: 'buy_again_on_sale',
  body: 'Good value on discount',
  helpfulCount: 2,
  notHelpfulCount: 0,
  score: 0.7,
  status: 'visible',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  isOwnReview: false,
  myVote: null,
};

describe('Mobile Reviews API & Query Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    votingReviewIds.clear();
  });

  describe('deduplicateReviews pure helper', () => {
    it('returns empty array when pages is undefined or empty', () => {
      expect(deduplicateReviews(undefined)).toEqual([]);
      expect(deduplicateReviews([])).toEqual([]);
    });

    it('removes duplicate reviews across pages and preserves unique order', () => {
      const page1 = { items: [mockReview1, mockReview2] };
      // Simulate live score drift causing mockReview2 to appear on page 2 as well
      const mockReview3: Review = { ...mockReview1, id: 'rev-3' };
      const page2 = { items: [mockReview2, mockReview3] };

      const result = deduplicateReviews([page1, page2]);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual(['rev-1', 'rev-2', 'rev-3']);
    });
  });

  describe('Query Hooks', () => {
    it('useProductReviews queries endpoint with sort and pagination', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        items: [mockReview1],
        cursor: 'cur-1',
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useProductReviews('prod-1', { sort: 'new', limit: 10 }),
        { wrapper },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/products/prod-1/reviews?sort=new&limit=10'),
      );
      expect(result.current.data?.pages[0]?.items).toHaveLength(1);
    });

    it('useMyProductReview fetches authoritative own review', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ review: mockReview1 });
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useMyProductReview('prod-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith('/products/prod-1/my-review');
      expect(result.current.data?.review?.id).toBe('rev-1');
    });

    it('useCommunityReviews queries community reviews feed', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        items: [mockReview1, mockReview2],
        cursor: null,
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useCommunityReviews({ sort: 'score' }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/reviews/community?sort=score'),
      );
    });

    it('useMyReviews queries user personal reviews', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        items: [mockReview1],
        cursor: null,
      });
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useMyReviews({ limit: 15 }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/me/reviews?limit=15'),
      );
    });
  });

  describe('Mutation Hooks and Invalidation', () => {
    it('useCreateReview calls POST and invalidates product and review caches', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockReview1);
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateReview(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          productId: 'prod-1',
          input: { rating: 'buy_again', body: 'Awesome' },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/products/prod-1/reviews',
        { rating: 'buy_again', body: 'Awesome' },
        expect.objectContaining({ headers: expect.any(Object) }),
      );

      // Verify exact cache invalidation including products key
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'prod-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['product-reviews', 'prod-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['my-product-review', 'prod-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['my-reviews'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['community-reviews'] });
    });

    it('useUpdateReview calls PATCH and invalidates product and review caches', async () => {
      (apiClient.patch as jest.Mock).mockResolvedValueOnce(mockReview1);
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateReview(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          reviewId: 'rev-1',
          productId: 'prod-1',
          patch: { rating: 'buy_again_on_sale', body: null },
        });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/reviews/rev-1',
        { rating: 'buy_again_on_sale', body: null },
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'prod-1'] });
    });

    it('useDeleteReview calls DELETE and invalidates caches', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValueOnce(undefined);
      const { queryClient, wrapper } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteReview(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          reviewId: 'rev-1',
          productId: 'prod-1',
        });
      });

      expect(apiClient.delete).toHaveBeenCalledWith('/reviews/rev-1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products', 'prod-1'] });
    });

    it('useVoteReviewHelpful optimistic toggle and in-flight lock', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce(undefined);
      const { queryClient, wrapper } = createWrapper();

      // Seed queryClient with mock data
      queryClient.setQueryData(['product-reviews', 'prod-1', 'score'], {
        pages: [{ items: [mockReview1], cursor: null }],
        pageParams: [undefined],
      });

      const { result } = renderHook(() => useVoteReviewHelpful('prod-1'), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          reviewId: 'rev-1',
          currentVote: null,
        });
      });

      // API POST should have been called with helpful: true
      expect(apiClient.post).toHaveBeenCalledWith('/reviews/rev-1/helpful', { helpful: true });

      // After settlement, lock set is cleared
      expect(votingReviewIds.has('rev-1')).toBe(false);
    });

    it('useVoteReviewHelpful drops concurrent double-tap while in flight', async () => {
      let resolvePost: () => void = () => {};
      (apiClient.post as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolvePost = resolve;
          }),
      );
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useVoteReviewHelpful('prod-1'), { wrapper });

      // Start first vote
      let p1: Promise<void>;
      act(() => {
        p1 = result.current.mutateAsync({ reviewId: 'rev-1', currentVote: null });
      });

      // While first vote is pending, votingReviewIds contains 'rev-1'
      expect(votingReviewIds.has('rev-1')).toBe(true);

      // Attempt second click on same review
      await expect(
        result.current.mutateAsync({ reviewId: 'rev-1', currentVote: null }),
      ).rejects.toThrow('Vote already in flight');

      // Resolve first
      await act(async () => {
        resolvePost();
        await p1;
      });

      expect(votingReviewIds.has('rev-1')).toBe(false);
    });
  });
});
