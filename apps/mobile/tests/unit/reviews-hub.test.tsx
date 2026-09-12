import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ReviewsHubScreen from '../../src/features/reviews/ReviewsHubScreen';
import { useMyReviews, useCommunityReviews } from '../../src/api/reviews';
import { useProduct } from '../../src/api/products';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { Review } from '@expyrico/shared';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(() => ({ data: undefined })),
}));

jest.mock('../../src/api/reviews', () => ({
  useMyReviews: jest.fn(),
  useCommunityReviews: jest.fn(),
  useVoteReviewHelpful: jest.fn(() => ({ mutate: jest.fn() })),
  deduplicateReviews: jest.fn((pages) => (pages ? pages.flatMap((p: any) => p.items) : [])),
}));

const mockPersonalReview: Review = {
  id: 'rev-mine-1',
  productId: 'prod-101',
  stars: 5,
  rating: 'buy_again',
  body: 'My favourite coffee beans',
  helpfulCount: 4,
  notHelpfulCount: 0,
  score: 0.85,
  status: 'visible',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  isOwnReview: true,
  product: {
    id: 'prod-101',
    name: 'Espresso Roast Whole Bean',
    brand: 'StarRoast',
    imageUrl: null,
  },
};

describe('ReviewsHubScreen', () => {
  const mockNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useRoute as jest.Mock).mockReturnValue({ params: {} });
    (useCommunityReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });
    (useMyReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });
  });

  it('renders Community tab by default with Community Picks', () => {
    const { getByText } = render(<ReviewsHubScreen />);

    expect(getByText('Reviews & Recommendations')).toBeTruthy();
    expect(getByText('Community')).toBeTruthy();
    expect(getByText(/My Reviews/)).toBeTruthy();
    expect(getByText('Community Picks')).toBeTruthy();
    expect(getByText('Top helpful')).toBeTruthy();
    expect(getByText('Newest')).toBeTruthy();
  });
  it('navigates to ProductReviews screen when pressing Read all reviews in community group', () => {
    (useCommunityReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockPersonalReview] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText } = render(<ReviewsHubScreen />);

    expect(getByText(/Read all reviews \(1\)/)).toBeTruthy();
    fireEvent.press(getByText(/Read all reviews \(1\)/));

    expect(mockNavigate).toHaveBeenCalledWith('ProductReviews', { id: 'prod-101' });
  });


  it('switches to My Reviews tab on press and renders personal review cards', () => {
    (useMyReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockPersonalReview] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText } = render(<ReviewsHubScreen />);
    fireEvent.press(getByText(/My Reviews/));

    expect(getByText('Espresso Roast Whole Bean')).toBeTruthy();
    expect(getByText('StarRoast')).toBeTruthy();
    expect(getByText('5.0')).toBeTruthy();
    expect(getByText('My favourite coffee beans')).toBeTruthy();
    expect(getByText('Edit review')).toBeTruthy();
    expect(getByText('View product')).toBeTruthy();
  });

  it('navigates to ProductReview screen on Edit review press', () => {
    (useMyReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockPersonalReview] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText } = render(<ReviewsHubScreen />);
    fireEvent.press(getByText(/My Reviews/));
    fireEvent.press(getByText('Edit review'));

    expect(mockNavigate).toHaveBeenCalledWith('ProductReview', {
      id: 'prod-101',
      review: mockPersonalReview,
    });
  });

  it('navigates to Product screen on View product press', () => {
    (useMyReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockPersonalReview] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText } = render(<ReviewsHubScreen />);
    fireEvent.press(getByText(/My Reviews/));
    fireEvent.press(getByText('View product'));

    expect(mockNavigate).toHaveBeenCalledWith('Product', { id: 'prod-101' });
  });

  it('renders empty state when user has no reviews on My Reviews tab', () => {
    (useMyReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText } = render(<ReviewsHubScreen />);
    fireEvent.press(getByText(/My Reviews/));

    expect(getByText('No reviews yet')).toBeTruthy();
    expect(
      getByText(/Share your thoughts on products you have used/),
    ).toBeTruthy();
    expect(getByText('Scan a product to review')).toBeTruthy();
  });
  it('preserves authoritative server product tallies when community group contains a partial review subset', () => {
    (useProduct as jest.Mock).mockReturnValue({
      data: {
        id: 'prod-101',
        name: 'Espresso Roast Whole Bean',
        brand: 'StarRoast',
        ratingCount: 100,
        buyAgainCount: 80,
        buyAgainOnSaleCount: 10,
        wontBuyCount: 10,
      },
    });

    (useCommunityReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockPersonalReview] }] },
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
      hasNextPage: true,
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
    });

    const { getByText } = render(<ReviewsHubScreen />);

    expect(getByText(/100 ratings/)).toBeTruthy();
    expect(getByText(/88% score/)).toBeTruthy();
    expect(getByText('4.4')).toBeTruthy();
  });
});
