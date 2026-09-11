import { Alert } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import React from 'react';
import { screen } from '@testing-library/react-native';
import RecordDetail from '../../app/(app)/record/[id]';
import { renderWithTheme } from '../helpers/renderWithTheme';
import * as recordsApi from '../../src/api/records';
import * as productsApi from '../../src/api/products';
import type { User } from '@expyrico/shared';
import { useSessionStore } from '../../src/auth/session-store';

const mockUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
  emailVerified: true,
  firstName: 'Test',
  lastName: 'User',
  address: null,
  country: 'US',
  avatarUrl: null,
  hasPassword: true,
  role: 'user',
  status: 'active',
  themePreference: 'expyrico',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => true,
    }),
    useRoute: () => ({
      params: { id: 'test-record-1' },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../src/api/records', () => {
  const actual = jest.requireActual('../../src/api/records');
  return {
    ...actual,
    useRecord: jest.fn(),
    patchLocalRecord: jest.fn(),
    deleteLocalRecord: jest.fn(),
  };
});

jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(() => ({ data: null })),
  useCreateOrResumeDraft: () => ({ mutateAsync: jest.fn() }),
  usePatchDraft: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));

describe('RecordDetail Expiry Card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      user: mockUser,
      accessToken: 'mock-token',
      hydrated: true,
    });
  });

  it('displays "In X days" and formatted date when item is nearly expiring', () => {
    // 3 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const isoDate = targetDate.toISOString().slice(0, 10);

    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Greek Yogurt',
      category: 'Dairy',
      expiryDate: isoDate,
      quantity: 1,
      unit: 'tub',
      price: null,
      store: null,
      notes: null,
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    expect(screen.getByText('EXPIRY')).toBeTruthy();
    expect(screen.getByText('In 3 days')).toBeTruthy();
  });

  it('displays "In X days" instead of duplicated date when item is fresh (> 7 days)', () => {
    // 25 days from now
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 25);
    const isoDate = targetDate.toISOString().slice(0, 10);

    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Canned Beans',
      category: 'Pantry',
      expiryDate: isoDate,
      quantity: 3,
      unit: 'cans',
      price: null,
      store: null,
      notes: null,
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    expect(screen.getByText('EXPIRY')).toBeTruthy();
    expect(screen.getByText('In 25 days')).toBeTruthy();
  });

  it('renders parallel status action buttons "Mark as used" and "Mark as discarded"', () => {
    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Apples',
      category: 'Produce',
      expiryDate: '2026-10-01',
      quantity: 5,
      unit: 'pcs',
      price: null,
      store: null,
      notes: null,
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    expect(screen.getByTestId('record-mark-consumed')).toBeTruthy();
    expect(screen.getByText('Mark as used')).toBeTruthy();

    expect(screen.getByTestId('record-mark-discarded')).toBeTruthy();
    expect(screen.getByText('Mark as discarded')).toBeTruthy();
  });

  it('hides add-photo thumbnail button and blocks adding when record already has 5 photos', () => {
    const fivePhotos = [
      '/path/photo1.jpg',
      '/path/photo2.jpg',
      '/path/photo3.jpg',
      '/path/photo4.jpg',
      '/path/photo5.jpg',
    ];
    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Apples',
      category: 'Produce',
      expiryDate: '2026-10-01',
      quantity: 5,
      unit: 'pcs',
      price: null,
      store: null,
      notes: null,
      photoUrl: JSON.stringify(fivePhotos),
      localPhotos: fivePhotos,
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    // Add photo button in thumbnail strip is cleanly hidden when capacity reaches 5
    expect(screen.queryByTestId('gallery-thumb-add-btn')).toBeNull();

    // But Change cover button is available so user can still update/replace the cover photo
    const changeCoverBtn = screen.getByTestId('gallery-change-cover-btn');
    expect(changeCoverBtn).toBeTruthy();
  });

  it('allows deleting active photo with confirmation alert in RecordDetail', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Apples',
      category: 'Produce',
      expiryDate: '2026-10-01',
      quantity: 5,
      unit: 'pcs',
      price: null,
      store: null,
      notes: null,
      photoUrl: JSON.stringify(['/path/photo1.jpg', '/path/photo2.jpg']),
      localPhotos: ['/path/photo1.jpg', '/path/photo2.jpg'],
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    const deleteBtn = screen.getByTestId('gallery-delete-photo');
    expect(deleteBtn).toBeTruthy();

    fireEvent.press(deleteBtn);
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Photo',
      expect.stringContaining('Are you sure you want to remove this photo'),
      expect.any(Array),
    );

    // Confirm deletion
    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === 'Delete');
    confirmBtn?.onPress?.();

    expect(recordsApi.patchLocalRecord).toHaveBeenCalledWith('test-record-1', {
      localPhotos: ['/path/photo2.jpg'],
    });

    alertSpy.mockRestore();
  });

  it('renders Change cover button and triggers cover photo replacement prompt', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Apples',
      category: 'Produce',
      expiryDate: '2026-10-01',
      quantity: 5,
      unit: 'pcs',
      price: null,
      store: null,
      notes: null,
      localPhotos: ['/path/photo1.jpg', '/path/photo2.jpg'],
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    const changeCoverBtn = screen.getByTestId('gallery-change-cover-btn');
    expect(changeCoverBtn).toBeTruthy();
    expect(screen.getByText('Change cover')).toBeTruthy();

    fireEvent.press(changeCoverBtn);
    expect(alertSpy).toHaveBeenCalledWith(
      'Change Cover Photo',
      'Choose how you want to update this photo',
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('allows making non-cover photo the cover via Make cover button', () => {
    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Apples',
      category: 'Produce',
      expiryDate: '2026-10-01',
      quantity: 5,
      unit: 'pcs',
      price: null,
      store: null,
      notes: null,
      localPhotos: ['/path/photo1.jpg', '/path/photo2.jpg'],
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    // Tap thumbnail 2 to make it the active photo
    fireEvent.press(screen.getByTestId('giveaway-thumb-1'));

    // Make cover button appears for photo at index 1
    const makeCoverBtn = screen.getByTestId('gallery-set-cover-btn');
    expect(makeCoverBtn).toBeTruthy();
    expect(screen.getByText('Make cover')).toBeTruthy();

    fireEvent.press(makeCoverBtn);
    expect(recordsApi.patchLocalRecord).toHaveBeenCalledWith('test-record-1', {
      localPhotos: ['/path/photo2.jpg', '/path/photo1.jpg'],
    });
  });

  it('allows deleting catalog-only photo as item-scoped removal without mutating shared catalog media', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (recordsApi.useRecord as jest.Mock).mockReturnValue({
      id: 'test-record-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: 'catalog-prod-1',
      customName: 'Organic Milk',
      category: 'Dairy',
      expiryDate: '2026-10-01',
      quantity: 1,
      unit: 'bottle',
      price: null,
      store: null,
      notes: null,
      localPhotos: undefined, // No local customizations yet
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: null,
    });

    // Product has catalog photo
    (productsApi.useProduct as jest.Mock).mockReturnValue({
      data: {
        id: 'catalog-prod-1',
        name: 'Organic Milk',
        imageUrl: 'https://cdn.expyrico.app/catalog/milk.png',
        photos: [],
      },
    });

    renderWithTheme(<RecordDetail />, 'expyrico');

    const deleteBtn = screen.getByTestId('gallery-delete-photo');
    expect(deleteBtn).toBeTruthy();

    fireEvent.press(deleteBtn);
    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => void }>;
    const confirmBtn = buttons.find((b) => b.text === 'Delete');
    confirmBtn?.onPress?.();

    // Saves empty localPhotos for this item, preserving shared catalog product
    expect(recordsApi.patchLocalRecord).toHaveBeenCalledWith('test-record-1', {
      localPhotos: [],
      photoUrl: null,
    });
    alertSpy.mockRestore();
  });
});
