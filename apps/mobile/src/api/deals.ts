// apps/mobile/src/api/deals.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Deal,
  DealCreate,
  DealExpiryStatus,
  DealPatch,
  DealSort,
  DealStoreFacet,
} from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

type Page = { items: Deal[]; cursor: string | null };

export interface DealFeedFilters {
  sort?: DealSort;
  q?: string;
  store?: string;
  minPrice?: number;
  maxPrice?: number;
  country?: string;
  expiryStatus?: DealExpiryStatus;
  productId?: string;
}

export function buildDealQueryString(filters: DealFeedFilters = {}, cursor?: string): string {
  const parts: string[] = [];
  if (filters.sort) parts.push(`sort=${encodeURIComponent(filters.sort)}`);
  if (filters.q?.trim()) parts.push(`q=${encodeURIComponent(filters.q.trim())}`);
  if (filters.store?.trim()) parts.push(`store=${encodeURIComponent(filters.store.trim())}`);
  if (filters.minPrice !== undefined && Number.isFinite(filters.minPrice)) {
    parts.push(`minPrice=${encodeURIComponent(String(filters.minPrice))}`);
  }
  if (filters.maxPrice !== undefined && Number.isFinite(filters.maxPrice)) {
    parts.push(`maxPrice=${encodeURIComponent(String(filters.maxPrice))}`);
  }
  if (filters.country?.trim()) parts.push(`country=${encodeURIComponent(filters.country.trim())}`);
  if (filters.expiryStatus && filters.expiryStatus !== 'all') {
    parts.push(`expiryStatus=${encodeURIComponent(filters.expiryStatus)}`);
  }
  if (filters.productId) parts.push(`productId=${encodeURIComponent(filters.productId)}`);
  if (cursor) parts.push(`cursor=${encodeURIComponent(cursor)}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function useDealFeed(filters: DealFeedFilters | DealSort = 'score') {
  const normalizedFilters: DealFeedFilters =
    typeof filters === 'string' ? { sort: filters } : filters;

  return useInfiniteQuery<Page>({
    queryKey: ['deals', normalizedFilters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Page>(
        `/deals${buildDealQueryString(normalizedFilters, pageParam as string | undefined)}`,
      ),
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useDealStores() {
  return useQuery<{ items: DealStoreFacet[] }>({
    queryKey: ['deal-stores'],
    queryFn: () => apiClient.get<{ items: DealStoreFacet[] }>('/deals/stores'),
    staleTime: 5 * 60 * 1000,
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

export async function uploadDealPhoto(photo: {
  path: string;
  mime?: string;
  name?: string;
}): Promise<{ photoUrl: string; thumbUrl: string }> {
  const form = new FormData();
  form.append('file', {
    uri: photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`,
    type: photo.mime || 'image/jpeg',
    name: photo.name || 'deal-photo.jpg',
  } as unknown as Blob);

  return apiClient.request<{ photoUrl: string; thumbUrl: string }>({
    method: 'POST',
    path: '/deals/upload-photo',
    body: form,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DealCreate) =>
      apiClient.post<Deal>('/deals', input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal-stores'] });
    },
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
      void qc.invalidateQueries({ queryKey: ['deal-stores'] });
    },
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/deals/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['deals'] });
      void qc.invalidateQueries({ queryKey: ['deal-stores'] });
    },
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
