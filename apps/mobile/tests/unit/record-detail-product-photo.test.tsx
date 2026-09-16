import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import RecordDetail from '../../app/(app)/record/[id]';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { useRecordWithStatus, uploadRecordPhoto, saveRecordPhotos } from '../../src/api/records';
import { useProduct } from '../../src/api/products';
import { choosePhotos } from '../../src/features/products/photo-picker-adapter';

jest.mock('../../src/api/records', () => ({
  ...jest.requireActual('../../src/api/records'),
  useRecordWithStatus: jest.fn(),
  uploadRecordPhoto: jest.fn(),
  saveRecordPhotos: jest.fn(),
}));
jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(),
}));
jest.mock('../../src/api/households', () => ({ useMyHouseholds: () => ({ data: { items: [] } }) }));
jest.mock('../../src/api/giveaways', () => ({ useActiveGiveawaysForRecord: () => ({ data: [] }) }));
jest.mock('../../src/features/products/photo-picker-adapter', () => ({
  ...jest.requireActual('../../src/features/products/photo-picker-adapter'),
  choosePhotos: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { id: 'item-no-photo' } }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
}));

describe('RecordDetail Product Catalog Photo Fallback & Non-Deletable Invariant', () => {
  const sampleProduct = {
    id: 'prod-milk',
    name: 'Vinamilk Milk',
    imageUrl: 'https://cdn.expyrico.app/products/vinamilk-milk.jpg',
    photos: [
      { id: 'p1', displayUrl: 'https://cdn.expyrico.app/products/vinamilk-milk.jpg', thumbnailUrl: 'https://cdn.expyrico.app/products/vinamilk-milk-thumb.jpg' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRecordWithStatus as jest.Mock).mockReturnValue({
      isResolved: true,
      isLoading: false,
      isError: false,
      record: {
        id: 'item-no-photo',
        serverId: 'srv-1',
        clientId: 'client-1',
        productId: 'prod-milk',
        customName: 'Fresh Milk',
        expiryDate: '2026-12-31',
        quantity: 2,
        unit: 'pack',
        photoUrl: null,
        localPhotos: [], // User has no custom photos attached
        status: 'active',
        notifyAt: [],
        householdId: null,
      },
    });
    (useProduct as jest.Mock).mockReturnValue({
      data: sampleProduct,
      isLoading: false,
      isError: false,
    });
    (choosePhotos as jest.Mock).mockResolvedValue([{ path: 'file:///data/user/photo.jpg', mime: 'image/jpeg' }]);
    (uploadRecordPhoto as jest.Mock).mockResolvedValue({
      photoUrl: 'https://cdn.expyrico.app/records/uploaded.webp',
      thumbUrl: 'https://cdn.expyrico.app/records/uploaded-thumb.webp',
    });
    (saveRecordPhotos as jest.Mock).mockResolvedValue(undefined);
  });

  it('displays catalog product photo when item has no photos, disallows deletion, and shows Product badges', () => {
    renderWithTheme(<RecordDetail />, 'expyrico');

    // 1. Hero displays the product photo
    expect(screen.getByTestId('giveaway-hero-image-0')).toBeTruthy();

    // 2. Delete button is NOT present (cannot delete product catalog photo)
    expect(screen.queryByTestId('gallery-delete-photo')).toBeNull();

    // 3. Product photo badge and tag are displayed
    expect(screen.getByTestId('gallery-product-source-badge')).toBeTruthy();
    expect(screen.getByText('Product photo')).toBeTruthy();
    expect(screen.getByTestId('gallery-product-tag')).toBeTruthy();
    expect(screen.getByText('Product')).toBeTruthy();

    // 4. User can add more photos via thumbnail + Add button or floating button
    expect(screen.getByTestId('gallery-thumb-add-btn')).toBeTruthy();
    expect(screen.getByText('Add photo')).toBeTruthy();
  });

  it('allows user to add a custom photo to the item when viewing the product photo fallback', async () => {
    renderWithTheme(<RecordDetail />, 'expyrico');

    // Tap + Add button in thumbnail row
    fireEvent.press(screen.getByTestId('gallery-thumb-add-btn'));

    // Modal opens offering photo picker options
    expect(screen.getByText('Choose from Gallery')).toBeTruthy();
    expect(screen.getByText('Take Photo')).toBeTruthy();

    // Select Choose from Gallery
    await fireEvent.press(screen.getByText('Choose from Gallery'));
    expect(choosePhotos).toHaveBeenCalled();
  });

  it('post-save composition: preserves custom photos at slot 0 (deletable) and appends product catalog photo at slot 1 (non-deletable)', () => {
    (useRecordWithStatus as jest.Mock).mockReturnValue({
      isResolved: true,
      isLoading: false,
      isError: false,
      record: {
        id: 'item-with-custom-and-product',
        serverId: 'srv-2',
        clientId: 'client-2',
        productId: 'prod-milk',
        customName: 'Fresh Milk',
        expiryDate: '2026-12-31',
        quantity: 1,
        unit: 'pack',
        photoUrl: 'https://cdn.expyrico.app/records/custom-cover.webp',
        localPhotos: ['https://cdn.expyrico.app/records/custom-cover.webp'],
        status: 'active',
        notifyAt: [],
        householdId: null,
      },
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    // Both photos are present in the gallery: Slot 0 custom, Slot 1 product
    expect(screen.getByTestId('giveaway-thumb-0')).toBeTruthy();
    expect(screen.getByTestId('giveaway-thumb-1')).toBeTruthy();

    // Slot 0 (custom photo) is active by default and IS deletable
    expect(screen.getByTestId('gallery-delete-photo')).toBeTruthy();

    // Switch to Slot 1 (product photo)
    fireEvent.press(screen.getByTestId('giveaway-thumb-1'));

    // Slot 1 (catalog photo) is NOT deletable
    expect(screen.queryByTestId('gallery-delete-photo')).toBeNull();
    expect(screen.getByTestId('gallery-product-source-badge')).toBeTruthy();
  });
});
