import { useContext } from 'react';
import { useQuery, QueryClientContext, QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PANTRY_LIMITS, type PantryLimitsSettings } from '@expyrico/shared';
import { apiClient } from '../api/client';

export const PANTRY_LIMITS_STORAGE_KEY = 'pantry.limits.v1';

let fallbackClient: QueryClient | null = null;
function getFallbackQueryClient(): QueryClient {
  if (!fallbackClient) fallbackClient = new QueryClient();
  return fallbackClient;
}

export function usePantryLimits(): PantryLimitsSettings {
  const contextClient = useContext(QueryClientContext);
  const client = contextClient ?? getFallbackQueryClient();

  const { data } = useQuery(
    {
      queryKey: ['settings', 'pantry-limits'],
      queryFn: async () => {
        try {
          const res = await apiClient.get<PantryLimitsSettings>('/settings/pantry-limits');
          if (res?.defaultUserPantryLimit) {
            void AsyncStorage.setItem(PANTRY_LIMITS_STORAGE_KEY, JSON.stringify(res));
            return res;
          }
        } catch {
          // Fall back to AsyncStorage cache
        }
        try {
          const cached = await AsyncStorage.getItem(PANTRY_LIMITS_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as PantryLimitsSettings;
            if (parsed.defaultUserPantryLimit) return parsed;
          }
        } catch {}
        return { ...DEFAULT_PANTRY_LIMITS };
      },
      staleTime: 5 * 60 * 1000,
    },
    client,
  );

  return data ?? { ...DEFAULT_PANTRY_LIMITS };
}
