// apps/mobile/src/api/reputation.ts
import { useQuery } from '@tanstack/react-query';
import type { Reputation } from '@expyrico/shared';
import { apiClient } from './client';

export function useReputation(userId: string | undefined) {
  return useQuery({
    queryKey: ['reputation', userId],
    queryFn: () => apiClient.get<Reputation>(`/users/${userId}/reputation`),
    enabled: !!userId,
  });
}
