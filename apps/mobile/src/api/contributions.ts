import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { UserContributionsResponse } from '@expyrico/shared';
import { apiClient } from './client';

export const CONTRIBUTIONS_QUERY_KEY = ['me', 'contributions'] as const;

export function useUserContributions(options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return useQuery<UserContributionsResponse>({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, limit, offset],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (options?.limit !== undefined) qs.set('limit', String(options.limit));
      if (options?.offset !== undefined) qs.set('offset', String(options.offset));
      const queryString = qs.toString() ? `?${qs.toString()}` : '';
      return await apiClient.get<UserContributionsResponse>(`/me/contributions${queryString}`);
    },
    staleTime: 30_000,
  });
}

export function useUserContributionsInfinite(options?: {
  status?: 'all' | 'active' | 'pending' | 'changes_required';
  q?: string;
  sort?: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
  limit?: number;
}) {
  const status = options?.status ?? 'all';
  const q = options?.q?.trim() ?? '';
  const sort = options?.sort ?? 'newest';
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));

  return useInfiniteQuery<UserContributionsResponse>({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, 'infinite', status, q, sort, limit],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const qs = new URLSearchParams();
      qs.set('offset', String(pageParam));
      qs.set('limit', String(limit));
      if (status !== 'all') qs.set('status', status);
      if (q) qs.set('q', q);
      if (sort !== 'newest') qs.set('sort', sort);
      return await apiClient.get<UserContributionsResponse>(`/me/contributions?${qs.toString()}`);
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? (lastPage.nextOffset ?? undefined) : undefined),
    staleTime: 30_000,
  });
}
