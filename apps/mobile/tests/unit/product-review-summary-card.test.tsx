import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ProductReviewSummaryCard } from '../../src/features/reviews/ProductReviewSummaryCard';
import type { Product } from '@expyrico/shared';

const mockProduct: Product = {
  id: 'prod-123',
  name: 'Nescafe Red Cup Instant Coffee',
  description: null,
  brand: 'NESCAFE',
  category: 'Dairy',
  barcode: '8850128030029',
  status: 'active',
  source: 'user',
  sourceId: null,
  qrPayload: null,
  defaultShelfLifeDays: 365,
  imageUrl: null,
  isCommunityEligible: true,
  version: 1,
  photos: [],
  buyAgainCount: 18,
  buyAgainOnSaleCount: 4,
  wontBuyCount: 2,
  ratingCount: 24, // 18 + 4 = 22 / 24 = 92%
  reviewCount: 10,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};


describe('ProductReviewSummaryCard', () => {
  it('renders simple and attractive inline sentiment row with score and count', () => {
    const handleViewReviews = jest.fn();

    const { getByText, getByTestId } = render(
      <ProductReviewSummaryCard
        productId={mockProduct.id}
        product={mockProduct}
        onPressViewReviews={handleViewReviews}
      />,
    );

    // 22 / 24 = 92%
    expect(getByText('92%')).toBeTruthy();
    expect(getByText('recommend')).toBeTruthy();
    expect(getByText('24 ratings')).toBeTruthy();

    const card = getByTestId('product-review-summary-card');
    fireEvent.press(card);
    expect(handleViewReviews).toHaveBeenCalledTimes(1);
  });

  it('renders clean unrated pill when product has 0 ratings', () => {
    const unratedProduct: Product = {
      ...mockProduct,
      buyAgainCount: 0,
      buyAgainOnSaleCount: 0,
      wontBuyCount: 0,
      ratingCount: 0,
      reviewCount: 0,
    };

    const handleWriteReview = jest.fn();
    const { getByText, getByTestId } = render(
      <ProductReviewSummaryCard
        productId={unratedProduct.id}
        product={unratedProduct}
        onPressWriteReview={handleWriteReview}
      />,
    );

    expect(getByText('Rate this item')).toBeTruthy();
    expect(getByText('Be the first to review')).toBeTruthy();

    const card = getByTestId('product-review-summary-card');
    fireEvent.press(card);
    expect(handleWriteReview).toHaveBeenCalledTimes(1);
  });

  it('returns null when productId is null/undefined', () => {
    const { toJSON } = render(
      <ProductReviewSummaryCard
        productId={null}
        product={null}
      />,
    );

    expect(toJSON()).toBeNull();
  });
});
