import { useContext } from 'react';
import { useQuery, QueryClientContext, QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PHOTO_LIMITS, type PhotoLimitsSettings } from '@expyrico/shared';
import { apiClient } from '../api/client';

const PHOTO_LIMITS_STORAGE_KEY = 'pantry.photoLimits.v1';

let fallbackClient: QueryClient | null = null;
function getFallbackQueryClient(): QueryClient {
  if (!fallbackClient) fallbackClient = new QueryClient();
  return fallbackClient;
}

export function usePhotoLimits(): PhotoLimitsSettings {
  const contextClient = useContext(QueryClientContext);
  const client = contextClient ?? getFallbackQueryClient();

  const { data } = useQuery(
    {
      queryKey: ['settings', 'photo-limits'],
      queryFn: async () => {
        try {
          const res = await apiClient.get<PhotoLimitsSettings>('/settings/photo-limits');
          if (res?.maxProductPhotos && res?.maxPantryItemPhotos) {
            void AsyncStorage.setItem(PHOTO_LIMITS_STORAGE_KEY, JSON.stringify(res));
            return res;
          }
        } catch {
          // Fall back to AsyncStorage cache
        }
        try {
          const cached = await AsyncStorage.getItem(PHOTO_LIMITS_STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as PhotoLimitsSettings;
            if (parsed.maxProductPhotos && parsed.maxPantryItemPhotos) return parsed;
          }
        } catch {}
        return { ...DEFAULT_PHOTO_LIMITS };
      },
      staleTime: 5 * 60 * 1000,
    },
    client,
  );

  return data ?? { ...DEFAULT_PHOTO_LIMITS };
}
