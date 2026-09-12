import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProductReview from '../../app/(app)/product/[id]/review';
import { useProduct } from '../../src/api/products';
import {
  useMyProductReview,
  useCreateReview,
  useUpdateReview,
} from '../../src/api/reviews';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { Review } from '@expyrico/shared';
import { useConnectionStore } from '../../src/store/connectionStore';
jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(),
}));

jest.mock('../../src/api/reviews', () => ({
  useMyProductReview: jest.fn(),
  useProductReviews: jest.fn(() => ({ data: { pages: [] } })),
  useCreateReview: jest.fn(),
  useUpdateReview: jest.fn(),
  deduplicateReviews: jest.fn(() => []),
  isUserOwnReview: jest.fn((r) => Boolean(r?.isOwnReview)),
}));

describe('ProductReview Screen', () => {
  const mockGoBack = jest.fn();
  const mockCreateMutateAsync = jest.fn();
  const mockUpdateMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useConnectionStore.setState({ status: 'ready', clientOnline: true, serverReady: true, initialized: true });
    (useNavigation as jest.Mock).mockReturnValue({ goBack: mockGoBack });
    (useRoute as jest.Mock).mockReturnValue({ params: { id: 'prod-123' } });
    (useProduct as jest.Mock).mockReturnValue({
      data: { id: 'prod-123', name: 'Oat Milk Organic', brand: 'Oatly' },
      isLoading: false,
    });
    (useCreateReview as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    });
    (useUpdateReview as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    });
  });

  it('renders in create mode when user has no existing review', () => {
    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: null },
      isLoading: false,
    });

    const { getByText } = render(<ProductReview />);

    expect(getByText('Write a review')).toBeTruthy();
    expect(getByText('Oat Milk Organic')).toBeTruthy();
    expect(getByText('Oatly')).toBeTruthy();
    expect(getByText('Rate this product')).toBeTruthy();
    expect(getByText('Tap a star to rate')).toBeTruthy();
    expect(getByText('Submit review')).toBeTruthy();
  });

  it('shows error if submitted without selecting a recommendation', async () => {
    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: null },
      isLoading: false,
    });

    const { getByTestId, getByText } = render(<ProductReview />);
    const submitBtn = getByTestId('review-submit');

    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText('Please select a star rating.')).toBeTruthy();
    });
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });

  it('submits a new review with selected rating and body', async () => {
    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: null },
      isLoading: false,
    });
    mockCreateMutateAsync.mockResolvedValueOnce({
      id: 'rev-new',
      status: 'visible',
    });

    const { getByText, getByPlaceholderText, getByTestId } = render(<ProductReview />);

    // Select 5 stars
    fireEvent.press(getByTestId('rating-star-5'));
    // Type review comment
    const input = getByPlaceholderText('Share what you liked, taste, packaging, value...');
    fireEvent.changeText(input, 'Super smooth and pairs well with coffee!');

    // Submit
    fireEvent.press(getByTestId('review-submit'));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        productId: 'prod-123',
        input: {
          stars: 5,
          body: 'Super smooth and pairs well with coffee!',
        },
      });
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('pre-populates existing review in edit mode', () => {
    const existingReview: Review = {
      id: 'rev-existing',
      productId: 'prod-123',
      stars: 3,
      rating: 'buy_again_on_sale',
      body: 'Only when on promo',
      helpfulCount: 3,
      notHelpfulCount: 0,
      score: 0.8,
      status: 'visible',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      isOwnReview: true,
    };

    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: existingReview },
      isLoading: false,
    });

    const { getByText, getByDisplayValue } = render(<ProductReview />);

    expect(getByText('Edit your review')).toBeTruthy();
    expect(getByDisplayValue('Only when on promo')).toBeTruthy();
    expect(getByText('Update review')).toBeTruthy();
  });

  it('sends body: null in edit mode when existing comment is cleared', async () => {
    const existingReview: Review = {
      id: 'rev-existing',
      productId: 'prod-123',
      stars: 5,
      rating: 'buy_again',
      body: 'Old comment that will be cleared',
      helpfulCount: 0,
      notHelpfulCount: 0,
      score: 0.5,
      status: 'visible',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      isOwnReview: true,
    };

    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: existingReview },
      isLoading: false,
    });
    mockUpdateMutateAsync.mockResolvedValueOnce({
      id: 'rev-existing',
      status: 'visible',
    });

    const { getByDisplayValue, getByTestId } = render(<ProductReview />);

    // Clear comment text
    const input = getByDisplayValue('Old comment that will be cleared');
    fireEvent.changeText(input, '   '); // Empty whitespace

    // Submit update
    fireEvent.press(getByTestId('review-submit'));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        reviewId: 'rev-existing',
        productId: 'prod-123',
        patch: {
          stars: 5,
          body: null, // explicit null
        },
      });
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('shows moderation pending screen when review status is hidden', async () => {
    (useMyProductReview as jest.Mock).mockReturnValue({
      data: { review: null },
      isLoading: false,
    });
    mockCreateMutateAsync.mockResolvedValueOnce({
      id: 'rev-hidden',
      status: 'hidden',
    });

    const { getByText, getByTestId } = render(<ProductReview />);

    fireEvent.press(getByTestId('rating-star-5'));
    fireEvent.press(getByTestId('review-submit'));

    await waitFor(() => {
      expect(getByText('Review Pending Moderation')).toBeTruthy();
      expect(getByText('Back to Product')).toBeTruthy();
    });
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
