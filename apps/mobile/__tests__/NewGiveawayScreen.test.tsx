import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewGiveawayScreen from '../app/(app)/giveaway/new';
import { useSessionStore } from '../src/auth/session-store';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';
import { takePhoto, choosePhotos } from '../src/features/products/photo-picker-adapter';

const mockCreateGiveaway = jest.fn().mockResolvedValue({ id: 'giveaway-1' });
const mockUploadGiveawayPhoto = jest.fn().mockResolvedValue({
  photoUrl: 'https://cdn.expyrico.app/public/giveaways/u1/p1/display.webp',
  thumbUrl: 'https://cdn.expyrico.app/public/giveaways/u1/p1/thumb.webp',
});

jest.mock('../src/api/giveaways', () => ({
  useCreateGiveaway: () => ({ mutateAsync: mockCreateGiveaway, isPending: false }),
  uploadGiveawayPhoto: (...args: unknown[]) => mockUploadGiveawayPhoto(...args),
}));

jest.mock('../src/features/products/photo-picker-adapter', () => ({
  takePhoto: jest.fn(),
  choosePhotos: jest.fn(),
}));

const mockPantryRecords = [
  {
    id: 'pantry-rec-1',
    serverId: 'server-rec-1',
    clientId: 'client-rec-1',
    productId: 'product-1',
    customName: 'Organic Brown Rice',
    category: 'Grains',
    expiryDate: '2026-11-30',
    quantity: 3,
    unit: 'bags',
    price: 4.5,
    store: 'Trader Joe',
    notes: 'Stored in sealed container',
    photoUrl: 'https://cdn.expyrico.app/records/rice.webp',
    status: 'active',
    notifyAt: [],
    householdId: null,
  },
];

jest.mock('../src/api/records', () => ({
  useActiveRecords: () => mockPantryRecords,
  useAllActiveRecords: () => mockPantryRecords,
}));

jest.mock('../src/api/products', () => ({
  useProduct: () => ({ data: { id: 'product-1', name: 'Brown Rice', brand: 'Lundberg' } }),
}));

const mockTakePhoto = takePhoto as jest.MockedFunction<typeof takePhoto>;
const mockChoosePhotos = choosePhotos as jest.MockedFunction<typeof choosePhotos>;

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NavigationContainer>
      <QueryClientProvider client={qc}>
        <ThemeProvider>{node}</ThemeProvider>
      </QueryClientProvider>
    </NavigationContainer>
  );
}

describe('NewGiveawayScreen', () => {
  beforeEach(() => {
    mockCreateGiveaway.mockClear();
    mockUploadGiveawayPhoto.mockClear();
    mockTakePhoto.mockReset();
    mockChoosePhotos.mockReset();
  });

  it('renders form fields and photo action buttons', () => {
    const { getByText, getByPlaceholderText, getByLabelText } = render(
      wrap(<NewGiveawayScreen />),
    );

    expect(getByText('Share an Item')).toBeTruthy();
    expect(getByLabelText('Giveaway title')).toBeTruthy();
    expect(getByLabelText('Pickup location')).toBeTruthy();
    expect(getByText('Camera')).toBeTruthy();
    expect(getByText('Gallery')).toBeTruthy();
  });

  it('adds photos via camera and gallery and displays cover badge', async () => {
    mockTakePhoto.mockResolvedValueOnce({
      path: '/tmp/photo1.jpg',
      width: 800,
      height: 600,
      mime: 'image/jpeg',
      size: 1000,
    });
    mockChoosePhotos.mockResolvedValueOnce([
      { path: '/tmp/photo2.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 1000 },
    ]);

    const { getByText, getByLabelText } = render(wrap(<NewGiveawayScreen />));

    fireEvent.press(getByText('Camera'));
    await waitFor(() => expect(mockTakePhoto).toHaveBeenCalledTimes(1));

    fireEvent.press(getByText('Gallery'));
    await waitFor(() => expect(mockChoosePhotos).toHaveBeenCalledTimes(1));

    expect(getByText('Cover')).toBeTruthy();
    expect(getByLabelText('Remove photo 1')).toBeTruthy();
  });

  it('submits giveaway with uploaded photo URL', async () => {
    mockTakePhoto.mockResolvedValueOnce({
      path: '/tmp/photo1.jpg',
      width: 800,
      height: 600,
      mime: 'image/jpeg',
      size: 1000,
    });

    const { getByText, getByLabelText } = render(wrap(<NewGiveawayScreen />));

    fireEvent.changeText(getByLabelText('Giveaway title'), 'Canned Beans Pack');
    fireEvent.changeText(getByLabelText('Pickup location'), 'West End Community Center');

    fireEvent.press(getByText('Camera'));
    await waitFor(() => expect(getByText('Cover')).toBeTruthy());

    fireEvent.press(getByText('Post Giveaway'));

    await waitFor(() => {
      expect(mockUploadGiveawayPhoto).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/tmp/photo1.jpg' }),
      );
      expect(mockCreateGiveaway).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Canned Beans Pack',
          locationText: 'West End Community Center',
          photoUrl: 'https://cdn.expyrico.app/public/giveaways/u1/p1/display.webp',
        }),
      );
    });
  });

  it('auto-fills location when user profile has a saved address', () => {
    useSessionStore.setState({
      user: {
        id: 'u-1',
        email: 'dan@example.com',
        emailVerified: true,
        firstName: 'Dan',
        lastName: 'Le',
        address: 'District 1, Ho Chi Minh City',
        country: 'VN',
        avatarUrl: null,
        hasPassword: true,
        role: 'user',
        status: 'active',
        themePreference: 'expyrico',
        createdAt: '2026-08-26T00:00:00.000Z',
        updatedAt: '2026-08-26T00:00:00.000Z',
      },
    });

    const { getByDisplayValue, getByText } = render(wrap(<NewGiveawayScreen />));

    expect(getByDisplayValue('District 1, Ho Chi Minh City')).toBeTruthy();
    expect(getByText('✓ Filled from profile')).toBeTruthy();
  });

  it('auto-fills details when selecting an item from pantry and caps quantity stepper at stock', async () => {
    const { getByTestId, getByText, getByDisplayValue, getByLabelText } = render(wrap(<NewGiveawayScreen />));
    // Open pantry modal
    fireEvent.press(getByTestId('select-from-pantry-btn'));

    // Select pantry item
    await waitFor(() => expect(getByTestId('pantry-select-item-pantry-rec-1')).toBeTruthy());
    fireEvent.press(getByTestId('pantry-select-item-pantry-rec-1'));

    // Title, notes, expiry, and quantity should be auto-filled
    expect(getByDisplayValue('Lundberg Organic Brown Rice')).toBeTruthy();
    expect(getByDisplayValue('Stored in sealed container')).toBeTruthy();
    expect(getByTestId('giveaway-qty-value')).toBeTruthy();
    expect(getByTestId('linked-pantry-badge')).toBeTruthy();
    expect(getByText('Lundberg Organic Brown Rice')).toBeTruthy();
    // Test quantity stepper
    const incBtn = getByTestId('qty-increment-btn');
    const decBtn = getByTestId('qty-decrement-btn');

    // Initial quantity is 1
    expect(getByText('1')).toBeTruthy();

    // Increment to 2
    fireEvent.press(incBtn);
    expect(getByText('2')).toBeTruthy();

    // Increment to 3 (max stock)
    fireEvent.press(incBtn);
    expect(getByText('3')).toBeTruthy();

    // Cannot exceed 3
    fireEvent.press(incBtn);
    expect(getByText('3')).toBeTruthy();

    // Decrement back to 2
    fireEvent.press(decBtn);
    expect(getByText('2')).toBeTruthy();

    // Submit giveaway with pantry link
    fireEvent.changeText(getByTestId('giveaway-unit-input'), 'bags');
    fireEvent.changeText(getByLabelText('Pickup location'), 'Downtown Hub');
    fireEvent.press(getByText('Post Giveaway'));

    await waitFor(() => {
      expect(mockCreateGiveaway).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Lundberg Organic Brown Rice',
          description: 'Stored in sealed container',
          locationText: 'Downtown Hub',
          expiryDate: '2026-11-30',
          quantity: 2,
          unit: 'bags',
          recordId: 'server-rec-1',
          productId: 'product-1',
        }),
      );
    });
  });

  it('allows unlinking a selected pantry item', async () => {
    const { getByTestId, queryByTestId } = render(wrap(<NewGiveawayScreen />));

    fireEvent.press(getByTestId('select-from-pantry-btn'));
    await waitFor(() => expect(getByTestId('pantry-select-item-pantry-rec-1')).toBeTruthy());
    fireEvent.press(getByTestId('pantry-select-item-pantry-rec-1'));

    expect(getByTestId('linked-pantry-badge')).toBeTruthy();

    fireEvent.press(getByTestId('unlink-pantry-btn'));
    expect(queryByTestId('linked-pantry-badge')).toBeNull();
  });

  it('allows snapping multiple photos at once in the camera modal and adding all to giveaway', async () => {
    const { getByText, getByTestId, findByTestId } = render(wrap(<NewGiveawayScreen />));

    // Open camera modal
    fireEvent.press(getByText('Camera'));

    // Modal is open
    expect(await findByTestId('multi-photo-camera-modal')).toBeTruthy();
    expect(getByTestId('multi-camera-shutter')).toBeTruthy();

    // Snap 3 photos sequentially
    fireEvent.press(getByTestId('multi-camera-shutter'));
    fireEvent.press(getByTestId('multi-camera-shutter'));
    fireEvent.press(getByTestId('multi-camera-shutter'));

    expect(getByText('3/5')).toBeTruthy();
    expect(getByText('Done (3)')).toBeTruthy();

    // Tap Done: all 3 photos are added to the giveaway form
    fireEvent.press(getByTestId('multi-camera-done'));

    expect(getByText('Photos (3/5)')).toBeTruthy();
  });
});
