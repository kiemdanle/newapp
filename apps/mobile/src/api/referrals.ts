import { useQuery } from '@tanstack/react-query';
import type { ReferralSummary } from '@expyrico/shared';
import { apiClient } from './client';

export function useReferralSummary() {
  return useQuery<ReferralSummary>({
    queryKey: ['referral', 'me'],
    queryFn: () => apiClient.get('/me/referral'),
    staleTime: 30_000,
  });
}
