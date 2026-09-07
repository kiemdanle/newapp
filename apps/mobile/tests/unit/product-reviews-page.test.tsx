import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProductReviewsScreen from '../../app/(app)/product/[id]/reviews';
import { useProduct } from '../../src/api/products';
import {
  useMyProductReview,
  useProductReviews,
  useVoteReviewHelpful,
} from '../../src/api/reviews';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { Product, Review } from '@expyrico/shared';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(),
}));

jest.mock('../../src/api/reviews', () => ({
  useMyProductReview: jest.fn(),
  useProductReviews: jest.fn(),
  useVoteReviewHelpful: jest.fn(() => ({ mutate: jest.fn() })),
  deduplicateReviews: jest.fn((pages) => (pages ? pages.flatMap((p: any) => p.items) : [])),
  isUserOwnReview: jest.fn((r) => Boolean(r?.isOwnReview)),
}));

const mockProductStale: Product = {
  id: 'prod-101',
  name: 'Vinamilk Sữa chua ít đường',
  description: null,
  brand: 'Vinamilk',
  category: null,
  barcode: '893467312345',
  status: 'active',
  source: 'user',
  sourceId: null,
  qrPayload: null,
  defaultShelfLifeDays: 45,
  imageUrl: null,
  isCommunityEligible: true,
  version: 1,
  photos: [],
  // Stale server tallies: 1 buy_again (5.0) from previous review creation
  buyAgainCount: 1,
  buyAgainOnSaleCount: 0,
  wontBuyCount: 0,
  ratingCount: 1,
  reviewCount: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

// Actual updated review from user: buy_again_on_sale (3 stars)
const mockUpdatedReview: Review = {
  id: 'rev-dan-1',
  productId: 'prod-101',
  rating: 'buy_again_on_sale',
  body: 'Vẻy delicious and gôd for health',
  helpfulCount: 2,
  notHelpfulCount: 0,
  score: 0.75,
  status: 'visible',
  createdAt: '2026-09-01T01:00:00.000Z',
  updatedAt: '2026-09-01T02:00:00.000Z',
  isOwnReview: true,
  author: { firstName: 'Dan', avatarUrl: null },
  myVote: null,
};

describe('ProductReviewsScreen (Dedicated Reviews Page)', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useRoute as jest.Mock).mockReturnValue({
      params: { id: 'prod-101' },
    });
  });

  it('corrects stale server tally and displays 3.0 stars and 60% score when review was edited to buy_again_on_sale', () => {
    (useProduct as jest.Mock).mockReturnValue({
      data: mockProductStale,
      isLoading: false,
    });

    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: mockUpdatedReview },
    });

    // Final page reached: exactly 1 review loaded, matching product.ratingCount = 1
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockUpdatedReview] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText, queryByText } = render(<ProductReviewsScreen />);

    // Screen title
    expect(getByText('Product Reviews')).toBeTruthy();
    expect(getByText('Vinamilk Sữa chua ít đường')).toBeTruthy();

    // Must show 3.0 and 60% score, NOT 5.0 or 100%
    expect(getByText('3.0')).toBeTruthy();
    expect(getByText('60% score')).toBeTruthy();
    expect(queryByText('5.0')).toBeNull();
    expect(queryByText('100% score')).toBeNull();

    // Breakdown pills
    expect(getByText('Buy again')).toBeTruthy();
    expect(getByText('On sale')).toBeTruthy();
    expect(getByText("Won't buy")).toBeTruthy();

    // Review item
    expect(getByText('Vẻy delicious and gôd for health')).toBeTruthy();
    expect(getByText('Your review')).toBeTruthy();
  });

  it('navigates to ProductReview edit screen on Edit your review CTA press', () => {
    (useProduct as jest.Mock).mockReturnValue({
      data: mockProductStale,
      isLoading: false,
    });
    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: mockUpdatedReview },
    });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockUpdatedReview] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText } = render(<ProductReviewsScreen />);

    fireEvent.press(getByText('Edit your review'));

    expect(mockNavigate).toHaveBeenCalledWith('ProductReview', {
      id: 'prod-101',
      review: mockUpdatedReview,
    });
  });

  it('navigates back when back button is pressed', () => {
    (useProduct as jest.Mock).mockReturnValue({
      data: mockProductStale,
      isLoading: false,
    });
    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: mockUpdatedReview },
    });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByLabelText } = render(<ProductReviewsScreen />);

    fireEvent.press(getByLabelText('Go back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
