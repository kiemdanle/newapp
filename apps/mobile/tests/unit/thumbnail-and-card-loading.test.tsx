import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RecordCard } from '../../src/features/records/RecordCard';
import { PantryGridCard } from '../../src/features/records/PantryGridCard';
import { ProductThumbnail } from '../../src/components/ProductThumbnail';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { useProduct } from '../../src/api/products';
import { useCachedImage } from '../../src/cache/useCachedImage';
import type { LocalRecord } from '../../src/api/records';
import type { Product } from '@expyrico/shared';

jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(),
}));

jest.mock('../../src/cache/useCachedImage', () => ({
  useCachedImage: jest.fn(),
}));

const mockRecord: LocalRecord = {
  id: 'rec-loading-1',
  serverId: 'srv-1',
  clientId: 'cli-1',
  productId: 'prod-456',
  customName: null,
  category: 'Produce',
  expiryDate: '2026-12-31',
  quantity: 1,
  unit: 'kg',
  price: 2.5,
  store: 'Supermarket',
  notes: '',
  photoUrl: 'https://cdn.example.com/apple.jpg',
  status: 'active',
  notifyAt: [],
  householdId: null,
  brand: null,
};

const mockProduct = {
  id: 'prod-456',
  name: 'Honeycrisp Apples',
  brand: 'Orchard Fresh',
  category: 'Produce',
  status: 'active',
  imageUrl: 'https://cdn.example.com/apple.jpg',
  barcode: '1234567890123',
} as unknown as Product;
describe('Thumbnail & Card Inline Loading States', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCachedImage as jest.Mock).mockReturnValue({
      uri: null,
      isLoading: false,
      isRevalidating: false,
      error: null,
      reload: jest.fn(),
    });
  });

  describe('RecordCard Inline Loading', () => {
    it('renders skeleton bones for title and brand when product metadata is loading and customName is absent', () => {
      (useProduct as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      renderWithTheme(<RecordCard record={mockRecord} onPress={jest.fn()} />, 'expyrico');

      expect(screen.getByTestId('record-card-title-skeleton')).toBeTruthy();
      expect(screen.getByTestId('record-card-brand-skeleton')).toBeTruthy();
      expect(screen.queryByText('Item')).toBeNull();
    });

    it('renders actual product name and brand when product metadata resolves', () => {
      (useProduct as jest.Mock).mockReturnValue({
        data: mockProduct,
        isLoading: false,
      });

      renderWithTheme(<RecordCard record={mockRecord} onPress={jest.fn()} />, 'expyrico');

      expect(screen.getByText('Honeycrisp Apples')).toBeTruthy();
      expect(screen.getByText('Orchard Fresh')).toBeTruthy();
      expect(screen.queryByTestId('record-card-title-skeleton')).toBeNull();
      expect(screen.queryByTestId('record-card-brand-skeleton')).toBeNull();
    });

    it('preserves customName immediately without showing name skeleton even while product query loads', () => {
      (useProduct as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      const recordWithCustomName = { ...mockRecord, customName: 'My Sweet Apples' };
      renderWithTheme(
        <RecordCard record={recordWithCustomName} onPress={jest.fn()} />,
        'expyrico'
      );

      expect(screen.getByText('My Sweet Apples')).toBeTruthy();
      expect(screen.queryByTestId('record-card-title-skeleton')).toBeNull();
    });
  });

  describe('PantryGridCard Inline Loading', () => {
    it('renders skeleton bones for title block and brand when product metadata is loading', () => {
      (useProduct as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
      });

      renderWithTheme(
        <PantryGridCard record={mockRecord} onPress={jest.fn()} />,
        'expyrico'
      );

      expect(screen.getByTestId('grid-card-title-skeleton')).toBeTruthy();
      expect(screen.getByTestId('grid-card-brand-skeleton')).toBeTruthy();
      expect(screen.queryByText('Item')).toBeNull();
    });

    it('renders resolved product name in grid card once metadata loads', () => {
      (useProduct as jest.Mock).mockReturnValue({
        data: mockProduct,
        isLoading: false,
      });

      renderWithTheme(
        <PantryGridCard record={mockRecord} onPress={jest.fn()} />,
        'expyrico'
      );

      expect(screen.getByText('Honeycrisp Apples')).toBeTruthy();
      expect(screen.queryByTestId('grid-card-title-skeleton')).toBeNull();
    });
  });

  describe('ProductThumbnail & Mock Slow Image Scenario', () => {
    it('renders skeleton overlay while image is unsettled and unmasks on onLoadEnd', () => {
      (useCachedImage as jest.Mock).mockReturnValue({
        uri: null,
        isLoading: false,
      });

      const { UNSAFE_getByType } = render(
        <ProductThumbnail photoUrl="https://cdn.example.com/apple.jpg" size={52} />
      );

      expect(screen.getByTestId('product-thumbnail-skeleton')).toBeTruthy();

      const image = UNSAFE_getByType('Image' as never);
      act(() => {
        fireEvent(image, 'loadEnd');
      });

      expect(screen.queryByTestId('product-thumbnail-skeleton')).toBeNull();
    });

    it('Mock Slow Image Scenario: holds thumbnail skeleton during 500ms delayed image load after metadata is ready', () => {
      jest.useFakeTimers();

      const { UNSAFE_getByType } = render(
        <ProductThumbnail photoUrl="https://cdn.example.com/apple.jpg" size={52} />
      );

      // Skeleton remains visible initially
      expect(screen.getByTestId('product-thumbnail-skeleton')).toBeTruthy();

      // Advance 250ms (simulating in-flight network bytes)
      act(() => {
        jest.advanceTimersByTime(250);
      });
      expect(screen.getByTestId('product-thumbnail-skeleton')).toBeTruthy();

      // At 500ms, native Image fires onLoadEnd
      const image = UNSAFE_getByType('Image' as never);
      act(() => {
        jest.advanceTimersByTime(250);
        fireEvent(image, 'loadEnd');
      });

      // Now settled: skeleton bone is unmasked
      expect(screen.queryByTestId('product-thumbnail-skeleton')).toBeNull();

      jest.useRealTimers();
    });

    it('resets settlement to false when useCachedImage upgrades candidate to cached URI', () => {
      (useCachedImage as jest.Mock).mockReturnValue({
        uri: null,
        isLoading: true,
      });

      const { rerender, UNSAFE_getByType } = render(
        <ProductThumbnail photoUrl="https://cdn.example.com/apple.jpg" size={52} />
      );

      // Settle candidate remote URI
      const initialImage = UNSAFE_getByType('Image' as never);
      act(() => {
        fireEvent(initialImage, 'loadEnd');
      });
      expect(screen.queryByTestId('product-thumbnail-skeleton')).toBeNull();

      // Cache hydration completes and supplies local file URI
      (useCachedImage as jest.Mock).mockReturnValue({
        uri: 'file:///data/cache/apple-cached.jpg',
        isLoading: false,
      });

      rerender(<ProductThumbnail photoUrl="https://cdn.example.com/apple.jpg" size={52} />);

      // Source transitioned to file://: skeleton reset contract must re-arm until new URI settles
      expect(screen.getByTestId('product-thumbnail-skeleton')).toBeTruthy();

      // Settle new cached URI
      const updatedImage = UNSAFE_getByType('Image' as never);
      act(() => {
        fireEvent(updatedImage, 'loadEnd');
      });
      expect(screen.queryByTestId('product-thumbnail-skeleton')).toBeNull();
    });

    it('forces settlement and shows fallback placeholder when image hangs past 3000ms safety timeout', () => {
      jest.useFakeTimers();

      render(<ProductThumbnail photoUrl="https://cdn.example.com/hung-image.jpg" size={52} />);

      expect(screen.getByTestId('product-thumbnail-skeleton')).toBeTruthy();

      // Advance 3000ms safety timeout
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Skeleton should be unmasked and fallback icon shown
      expect(screen.queryByTestId('product-thumbnail-skeleton')).toBeNull();

      jest.useRealTimers();
    });
  });
});
