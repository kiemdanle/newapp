import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { apiClient } from '../../src/api/client';
import { usePhotoLimits } from '../../src/utils/photo-limits';
import { DEFAULT_PHOTO_LIMITS } from '@expyrico/shared';

jest.mock('../../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('usePhotoLimits Hook', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('immediately returns default 5-photo limits on fresh offline launch without crashing', () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePhotoLimits(), { wrapper });
    expect(result.current).toEqual(DEFAULT_PHOTO_LIMITS);
  });

  it('fetches photo limits from API and caches in AsyncStorage', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      maxProductPhotos: 8,
      maxPantryItemPhotos: 12,
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePhotoLimits(), { wrapper });

    await waitFor(() => {
      expect(result.current.maxProductPhotos).toBe(8);
      expect(result.current.maxPantryItemPhotos).toBe(12);
    });

    expect(apiClient.get).toHaveBeenCalledWith('/settings/photo-limits');
    const cached = await AsyncStorage.getItem('pantry.photoLimits.v1');
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!)).toEqual({
      maxProductPhotos: 8,
      maxPantryItemPhotos: 12,
    });
  });

  it('falls back to cached AsyncStorage values when network fails', async () => {
    await AsyncStorage.setItem(
      'pantry.photoLimits.v1',
      JSON.stringify({ maxProductPhotos: 10, maxPantryItemPhotos: 15 }),
    );
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network offline'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePhotoLimits(), { wrapper });

    await waitFor(() => {
      expect(result.current.maxProductPhotos).toBe(10);
      expect(result.current.maxPantryItemPhotos).toBe(15);
    });
  });
});
