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
});
