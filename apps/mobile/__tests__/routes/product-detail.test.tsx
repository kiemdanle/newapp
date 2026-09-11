import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import ProductDetail from '../../app/(app)/product/[id]';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { createQueryClient } from '../../src/api/query-client';
import { navigation, __setRouteParams } from '../../tests/mocks/react-navigation';
import { queueFetch, jsonResponse } from '../../tests/mocks/fetch';
import { useSessionStore } from '../../src/auth/session-store';
import { __reset } from '../../tests/mocks/react-native-keychain';

// This screen's OCR entry point pulls in native camera/ML-kit modules with
// no bearing on the "Suggest an edit" affordance this file actually tests —
// mocked at the component boundary, matching this repo's established
// pattern for a heavy subtree the test in question never needs to render.
jest.mock('../../src/features/expiry/OcrCamera', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    OcrCamera: ({ onCancel, onParsed }: { onCancel: () => void; onParsed: (iso: string) => void }) => (
      <View testID="mock-ocr-camera">
        <Pressable testID="mock-ocr-cancel" onPress={onCancel}>
          <Text>Cancel OCR</Text>
        </Pressable>
        <Pressable testID="mock-ocr-parse" onPress={() => onParsed('2026-11-20')}>
          <Text>Parse OCR</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock('../../src/features/push/registerPushToken', () => ({
  ensurePushTokenRegistered: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/api/records', () => ({
  createLocalRecord: jest.fn().mockResolvedValue('local-id-1'),
  useActiveRecords: () => [],
}));
jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));
jest.mock('../../src/store/pantryScope', () => ({
  usePantryScope: () => ({ scope: 'personal', householdId: null, setScope: jest.fn() }),
}));
import { useMyProductReview, useMyReviews } from '../../src/api/reviews';

jest.mock('../../src/api/reviews', () => ({
  useMyProductReview: jest.fn(() => ({ data: { review: null } })),
  useMyReviews: jest.fn(() => ({ data: { pages: [] } })),
  useProductReviews: jest.fn(() => ({ data: { pages: [] } })),
  useVoteReviewHelpful: jest.fn(() => ({ mutate: jest.fn() })),
  deduplicateReviews: jest.fn((pages) => (pages ? pages.flatMap((p: any) => p.items) : [])),
  isUserOwnReview: jest.fn(() => false),
}));

function wrap(node: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>{node}</ThemeProvider>
    </QueryClientProvider>
  );
}

const PRODUCT = {
  id: 'p1',
  barcode: '123',
  qrPayload: null,
  name: 'Frozen peas',
  description: null,
  brand: null,
  category: null,
  imageUrl: null,
  defaultShelfLifeDays: null,
  source: 'user',
  sourceId: null,
  isCommunityEligible: true,
  buyAgainCount: 0,
  buyAgainOnSaleCount: 0,
  wontBuyCount: 0,
  ratingCount: 0,
  reviewCount: 0,
  status: 'active',
  version: 3,
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  topReviews: [],
};

describe('<ProductDetail /> — Suggest an edit', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: { id: 'user-1' } as never, accessToken: 'a', refreshToken: 'r', hydrated: true, pendingAuth: null });
    __setRouteParams({ id: 'p1' });
  });

  it('shows "Suggest an edit" for an active product and navigates to the edit screen', async () => {
    queueFetch(jsonResponse(PRODUCT));
    const { findByTestId } = render(wrap(<ProductDetail />));

    const button = await findByTestId('product-suggest-edit');
    fireEvent.press(button);

    expect(navigation.navigate).toHaveBeenCalledWith('ProductEdit', { id: 'p1' });
  });

  it('hides "Suggest an edit" for a non-active product', async () => {
    queueFetch(jsonResponse({ ...PRODUCT, status: 'pending' }));
    const { findByTestId, queryByTestId } = render(wrap(<ProductDetail />));

    await findByTestId('add-record-save');
    expect(queryByTestId('product-suggest-edit')).toBeNull();
  });

  it('renders stars row right below product name when product has a review', async () => {
    (useMyProductReview as jest.Mock).mockReturnValue({
      data: {
        review: {
          id: 'rev-1',
          productId: 'p1',
          rating: 'buy_again_on_sale',
          body: 'Great taste',
          status: 'visible',
          isOwnReview: true,
        },
      },
    });

    queueFetch(jsonResponse(PRODUCT));
    const { findByTestId, getByText } = render(wrap(<ProductDetail />));

    const starsRow = await findByTestId('product-header-stars');
    expect(starsRow).toBeTruthy();
    expect(getByText('3.0')).toBeTruthy();
    expect(getByText('Your review')).toBeTruthy();

    fireEvent.press(starsRow);
    expect(navigation.navigate).toHaveBeenCalledWith('ProductReviews', { id: 'p1' });
  });

  it('handles route-ID != canonical-product-ID aliasing gracefully', async () => {
    __setRouteParams({ id: 'alias-route-id' });
    const canonicalProduct = { ...PRODUCT, id: 'canonical-p1' };
    queueFetch(jsonResponse(canonicalProduct));

    (useMyProductReview as jest.Mock).mockImplementation((targetId) => {
      if (targetId === 'canonical-p1') {
        return {
          data: {
            review: {
              id: 'rev-1',
              productId: 'canonical-p1',
              rating: 'buy_again',
              status: 'visible',
              isOwnReview: true,
            },
          },
        };
      }
      return { data: { review: null } };
    });

    const { findByTestId, getByText } = render(wrap(<ProductDetail />));

    const starsRow = await findByTestId('product-header-stars');
    expect(starsRow).toBeTruthy();
    expect(getByText('5.0')).toBeTruthy();

    fireEvent.press(starsRow);
    expect(navigation.navigate).toHaveBeenCalledWith('ProductReviews', { id: 'canonical-p1' });
  });

  it('falls back to useMyReviews when useMyProductReview is null or 404', async () => {
    (useMyProductReview as jest.Mock).mockReturnValue({ data: { review: null } });
    (useMyReviews as jest.Mock).mockReturnValue({
      data: {
        pages: [
          {
            items: [
              {
                id: 'rev-dan-1',
                productId: 'p1',
                rating: 'buy_again_on_sale',
                body: 'Very good',
                status: 'visible',
                isOwnReview: true,
              },
            ],
          },
        ],
      },
    });

    queueFetch(jsonResponse(PRODUCT));
    const { findByTestId, getByText } = render(wrap(<ProductDetail />));

    const starsRow = await findByTestId('product-header-stars');
    expect(starsRow).toBeTruthy();
    expect(getByText('3.0')).toBeTruthy();
    expect(getByText('Your review')).toBeTruthy();

    fireEvent.press(starsRow);
    expect(navigation.navigate).toHaveBeenCalledWith('ProductReviews', { id: 'p1' });
  });
  it('preserves AddRecordForm state when OCR camera is opened and canceled, and automatically prefills scanned date when parsed', async () => {
    queueFetch(jsonResponse(PRODUCT));
    const { findByTestId, getByTestId, queryByTestId } = render(wrap(<ProductDetail />));

    // Fill in notes in AddRecordForm
    const notesInput = await findByTestId('add-record-notes');
    fireEvent.changeText(notesInput, 'Fresh batch from market');
    expect(notesInput.props.value).toBe('Fresh batch from market');

    // Open OCR camera
    const scanDateBtn = getByTestId('add-record-ocr');
    fireEvent.press(scanDateBtn);

    // OCR Camera is visible in modal
    expect(getByTestId('mock-ocr-camera')).toBeTruthy();

    // Cancel OCR
    fireEvent.press(getByTestId('mock-ocr-cancel'));

    // OCR camera is gone, AddRecordForm was NOT unmounted and retained notes
    expect(queryByTestId('mock-ocr-camera')).toBeNull();
    expect(getByTestId('add-record-notes').props.value).toBe('Fresh batch from market');

    // Now open again and parse date
    fireEvent.press(scanDateBtn);
    expect(getByTestId('mock-ocr-camera')).toBeTruthy();
    fireEvent.press(getByTestId('mock-ocr-parse'));

    // Modal is closed, date is prefilled in AddRecordForm, notes are still preserved
    expect(queryByTestId('mock-ocr-camera')).toBeNull();
    expect(getByTestId('add-record-expiry-input').props.value).toBe('2026-11-20');
    expect(getByTestId('add-record-notes').props.value).toBe('Fresh batch from market');
  });
});
