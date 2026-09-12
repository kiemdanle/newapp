import { renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { apiClient } from '../../src/api/client';
import { usePantryLimits, PANTRY_LIMITS_STORAGE_KEY } from '../../src/utils/pantry-limits';
import { DEFAULT_PANTRY_LIMITS } from '@expyrico/shared';

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

describe('usePantryLimits Hook', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('immediately returns default 50-item limit on fresh offline launch without crashing', () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePantryLimits(), { wrapper });
    expect(result.current).toEqual(DEFAULT_PANTRY_LIMITS);
  });

  it('fetches pantry limits from API and caches in AsyncStorage', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      defaultUserPantryLimit: 150,
      tierLimits: { free: 50, pro: 500 },
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePantryLimits(), { wrapper });

    await waitFor(() => {
      expect(result.current.defaultUserPantryLimit).toBe(150);
    });

    expect(apiClient.get).toHaveBeenCalledWith('/settings/pantry-limits');
    const cached = await AsyncStorage.getItem(PANTRY_LIMITS_STORAGE_KEY);
    expect(cached).not.toBeNull();
    expect(JSON.parse(cached!)).toEqual({
      defaultUserPantryLimit: 150,
      tierLimits: { free: 50, pro: 500 },
    });
  });

  it('falls back to cached AsyncStorage values when network fails', async () => {
    await AsyncStorage.setItem(
      PANTRY_LIMITS_STORAGE_KEY,
      JSON.stringify({ defaultUserPantryLimit: 250, tierLimits: { free: 50, pro: 500 } }),
    );
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network offline'));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePantryLimits(), { wrapper });

    await waitFor(() => {
      expect(result.current.defaultUserPantryLimit).toBe(250);
    });
  });
});
