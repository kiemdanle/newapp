import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProductReviewsSection } from '../../src/features/reviews/ProductReviewsSection';
import {
  useProductReviews,
  useMyProductReview,
  useVoteReviewHelpful,
} from '../../src/api/reviews';
import { useNavigation } from '@react-navigation/native';
import type { Product, Review } from '@expyrico/shared';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('../../src/api/reviews', () => ({
  useProductReviews: jest.fn(),
  useMyProductReview: jest.fn(),
  useVoteReviewHelpful: jest.fn(),
  deduplicateReviews: jest.fn((pages) => (pages ? pages.flatMap((p: any) => p.items) : [])),
  isUserOwnReview: jest.fn((r) => Boolean(r?.isOwnReview)),
}));
jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(() => ({ data: undefined })),
}));

const mockProduct: Product = {
  id: 'prod-1',
  name: 'Organic Almond Butter',
  description: null,
  brand: 'NutsCo',
  category: null,
  barcode: '123456789012',
  status: 'active',
  source: 'user',
  sourceId: null,
  qrPayload: null,
  defaultShelfLifeDays: 90,
  imageUrl: null,
  isCommunityEligible: true,
  version: 1,
  photos: [],
  buyAgainCount: 18,
  buyAgainOnSaleCount: 4,
  wontBuyCount: 2,
  averageRating: 4.3,
  ratingCount: 24, // 18 + 4 + 2 = 24
  reviewCount: 14, // 14 written reviews
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const mockReviewCommunity: Review = {
  id: 'rev-comm',
  productId: 'prod-1',
  stars: 5,
  rating: 'buy_again',
  body: 'Creamy and not overly oily. Loved it!',
  helpfulCount: 5,
  notHelpfulCount: 0,
  score: 0.9,
  status: 'visible',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  isOwnReview: false,
  author: { firstName: 'Sarah', avatarUrl: null },
  myVote: null,
};

const mockReviewOwn: Review = {
  id: 'rev-own',
  productId: 'prod-1',
  stars: 5,
  rating: 'buy_again',
  body: 'Mine',
  helpfulCount: 0,
  notHelpfulCount: 0,
  score: 0.2,
  status: 'visible',
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  isOwnReview: true,
  author: { firstName: 'Me', avatarUrl: null },
  myVote: null,
};

describe('ProductReviewsSection', () => {
  const mockNavigate = jest.fn();
  const mockVoteMutate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
    (useVoteReviewHelpful as jest.Mock).mockReturnValue({
      mutate: mockVoteMutate,
      isPending: false,
    });
  });

  it('renders empty state when product has 0 ratings', () => {
    const emptyProduct: Product = {
      ...mockProduct,
      buyAgainCount: 0,
      buyAgainOnSaleCount: 0,
      wontBuyCount: 0,
      ratingCount: 0,
      reviewCount: 0,
    };
    (useMyProductReview as jest.Mock).mockReturnValue({ data: { review: null } });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [] }] },
      isLoading: false,
    });

    const { getByText } = render(<ProductReviewsSection product={emptyProduct} />);

    expect(getByText('No reviews yet')).toBeTruthy();
    expect(getByText('Be the first to share your experience with this item.')).toBeTruthy();
    expect(getByText('Write a review')).toBeTruthy();
  });

  it('calculates average star rating and review totals', () => {
    (useMyProductReview as jest.Mock).mockReturnValue({ data: { review: null } });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockReviewCommunity] }] },
      isLoading: false,
    });

    const { getByText } = render(<ProductReviewsSection product={mockProduct} />);

    expect(getByText('4.3')).toBeTruthy();
    expect(getByText('out of 5 stars')).toBeTruthy();
    expect(getByText('24 ratings (14 written reviews)')).toBeTruthy();
  });

  it('renders reviews list with star rating and author details', () => {
    (useMyProductReview as jest.Mock).mockReturnValue({ data: { review: null } });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockReviewCommunity] }] },
      isLoading: false,
    });
    const view = render(<ProductReviewsSection product={mockProduct} />);
    const { getByText } = view;
    expect(getByText('Sarah')).toBeTruthy();
    expect(getByText('Creamy and not overly oily. Loved it!')).toBeTruthy();
    expect(getByText('5.0')).toBeTruthy();
    expect(getByText('Helpful (5)')).toBeTruthy();
  });
  it('hides helpful vote button when review is author own review', () => {
    (useMyProductReview as jest.Mock).mockReturnValue({ data: { review: mockReviewOwn } });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockReviewOwn] }] },
      isLoading: false,
    });

    const { getByText, queryByText } = render(
      <ProductReviewsSection product={mockProduct} />,
    );

    expect(getByText('Your review')).toBeTruthy();
    expect(queryByText(/Helpful \(/)).toBeNull();
    // Edit CTA
    expect(getByText('Edit your review')).toBeTruthy();
  });

  it('navigates to ProductReview screen on review CTA press', () => {
    (useMyProductReview as jest.Mock).mockReturnValue({ data: { review: null } });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [] }] },
      isLoading: false,
    });

    const { getByTestId } = render(<ProductReviewsSection product={mockProduct} />);
    fireEvent.press(getByTestId('product-review-cta'));

    expect(mockNavigate).toHaveBeenCalledWith('ProductReview', { id: 'prod-1' });
  });

  it('triggers helpful vote mutation on helpful button press', () => {
    (useMyProductReview as jest.Mock).mockReturnValue({ data: { review: null } });
    (useProductReviews as jest.Mock).mockReturnValue({
      data: { pages: [{ items: [mockReviewCommunity] }] },
      isLoading: false,
    });

    const { getByText } = render(<ProductReviewsSection product={mockProduct} />);
    fireEvent.press(getByText('Helpful (5)'));

    expect(mockVoteMutate).toHaveBeenCalledWith({
      reviewId: 'rev-comm',
      currentVote: null,
    });
  });
});
