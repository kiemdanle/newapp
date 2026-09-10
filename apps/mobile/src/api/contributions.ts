import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { UserContributionsResponse } from '@expyrico/shared';
import { apiClient } from './client';

export const CONTRIBUTIONS_QUERY_KEY = ['me', 'contributions'] as const;

function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function useUserContributions(options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  return useQuery<UserContributionsResponse>({
    queryKey: [...CONTRIBUTIONS_QUERY_KEY, limit, offset],
    queryFn: async () => {
      const qs = buildQueryString({ limit, offset });
      return await apiClient.get<UserContributionsResponse>(`/me/contributions${qs}`);
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
      const qs = buildQueryString({
        offset: pageParam as number,
        limit,
        status: status !== 'all' ? status : undefined,
        q: q.trim() || undefined,
        sort: sort !== 'newest' ? sort : undefined,
      });
      return await apiClient.get<UserContributionsResponse>(`/me/contributions${qs}`);
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore ? (lastPage.nextOffset ?? undefined) : undefined),
    staleTime: 30_000,
  });
}
