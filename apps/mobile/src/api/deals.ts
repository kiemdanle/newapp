// apps/mobile/src/api/deals.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Deal, DealCreate, DealPatch, DealSort } from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

type Page = { items: Deal[]; cursor: string | null };

export function useDealFeed(sort: DealSort = 'score') {
  return useInfiniteQuery<Page>({
    queryKey: ['deals', sort],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Page>(`/deals?sort=${sort}${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useDeal(id: string) {
  return useQuery({
    queryKey: ['deal', id],
    queryFn: () => apiClient.get<Deal>(`/deals/${id}`),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DealCreate) =>
      apiClient.post<Deal>('/deals', input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DealPatch }) =>
      apiClient.patch<Deal>(`/deals/${id}`, patch),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal', id] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/deals/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useDealVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, value }: { dealId: string; value: -1 | 1 }) =>
      apiClient.post<void>(
        `/deals/${dealId}/vote`,
        { value },
        { headers: { 'idempotency-key': newIdempotencyKey() } },
      ),
    onSuccess: (_d, { dealId }) => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal', dealId] });
    },
  });
}

export function useDeleteDealVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dealId: string) => apiClient.delete<void>(`/deals/${dealId}/vote`),
    onSuccess: (_d, dealId) => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal', dealId] });
    },
  });
}
