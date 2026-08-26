// apps/mobile/src/api/giveaways.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Giveaway,
  GiveawayCreate,
  GiveawayPatch,
  Claim,
  GiveawayStatus,
  GiveawaySort,
} from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

type Page = { items: Giveaway[]; cursor: string | null };

export interface GiveawayFeedFilters {
  status?: GiveawayStatus | 'all';
  sort?: GiveawaySort;
  q?: string;
  location?: string;
  country?: string;
  hasPhoto?: boolean;
}

export function buildGiveawayQueryString(
  filters: GiveawayFeedFilters = {},
  cursor?: string,
): string {
  const parts: string[] = [];
  if (filters.status) parts.push(`status=${encodeURIComponent(filters.status)}`);
  if (filters.sort && filters.sort !== 'new') parts.push(`sort=${encodeURIComponent(filters.sort)}`);
  if (filters.q?.trim()) parts.push(`q=${encodeURIComponent(filters.q.trim())}`);
  if (filters.location?.trim()) parts.push(`location=${encodeURIComponent(filters.location.trim())}`);
  if (filters.country) parts.push(`country=${encodeURIComponent(filters.country)}`);
  if (filters.hasPhoto) parts.push('hasPhoto=true');
  if (cursor) parts.push(`cursor=${encodeURIComponent(cursor)}`);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export function useGiveawayFeed(filters: GiveawayFeedFilters | GiveawayStatus = 'open') {
  const normalizedFilters: GiveawayFeedFilters =
    typeof filters === 'string' ? { status: filters } : filters;

  return useInfiniteQuery<Page>({
    queryKey: ['giveaways', normalizedFilters],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Page>(
        `/giveaways${buildGiveawayQueryString(normalizedFilters, pageParam as string | undefined)}`,
      ),
    getNextPageParam: (last) => last.cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useGiveaway(id: string) {
  return useQuery({
    queryKey: ['giveaway', id],
    queryFn: () => apiClient.get<Giveaway>(`/giveaways/${id}`),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useCreateGiveaway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GiveawayCreate) =>
      apiClient.post<Giveaway>('/giveaways', input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['giveaways'] });
      void qc.refetchQueries({ queryKey: ['giveaways'] });
    },
  });
}

export async function uploadGiveawayPhoto(photo: {
  path: string;
  mime?: string;
  name?: string;
}): Promise<{ photoUrl: string; thumbUrl: string }> {
  const form = new FormData();
  form.append('file', {
    uri: photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`,
    type: photo.mime || 'image/jpeg',
    name: photo.name || 'giveaway-photo.jpg',
  } as unknown as Blob);

  return apiClient.request<{ photoUrl: string; thumbUrl: string }>({
    method: 'POST',
    path: '/giveaways/upload-photo',
    body: form,
  });
}

export function useUpdateGiveaway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: GiveawayPatch }) =>
      apiClient.patch<Giveaway>(`/giveaways/${id}`, patch),
    onSuccess: (_d, { id }) => {
      void qc.invalidateQueries({ queryKey: ['giveaways'] });
      void qc.invalidateQueries({ queryKey: ['giveaway', id] });
    },
  });
}

export function useCancelGiveaway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<void>(`/giveaways/${id}/cancel`),
    onSuccess: (_d, id) => {
      void qc.invalidateQueries({ queryKey: ['giveaways'] });
      void qc.invalidateQueries({ queryKey: ['giveaway', id] });
    },
  });
}
export function useGiveawayClaims(giveawayId: string) {
  return useQuery({
    queryKey: ['claims', giveawayId],
    queryFn: async () => {
      const res = await apiClient.get<{ items: Claim[] } | Claim[]>(`/giveaways/${giveawayId}/claims`);
      return Array.isArray(res) ? res : res.items ?? [];
    },
    enabled: !!giveawayId,
  });
}

export function useClaimGiveaway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ giveawayId, pickupNote }: { giveawayId: string; pickupNote?: string }) =>
      apiClient.post<Claim>(`/giveaways/${giveawayId}/claims`, { pickupNote }, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_d, { giveawayId }) => {
      void qc.invalidateQueries({ queryKey: ['giveaways'] });
      void qc.invalidateQueries({ queryKey: ['giveaway', giveawayId] });
      void qc.invalidateQueries({ queryKey: ['claims', giveawayId] });
    },
  });
}

export function useSelectClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ giveawayId, claimId }: { giveawayId: string; claimId: string }) =>
      apiClient.post<void>(`/giveaways/${giveawayId}/select`, { claimId }, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_d, { giveawayId }) => {
      void qc.invalidateQueries({ queryKey: ['giveaways'] });
      void qc.invalidateQueries({ queryKey: ['giveaway', giveawayId] });
      void qc.invalidateQueries({ queryKey: ['claims', giveawayId] });
    },
  });
}

export function useHandOffGiveaway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (giveawayId: string) =>
      apiClient.post<void>(`/giveaways/${giveawayId}/hand-off`, undefined, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_d, giveawayId) => {
      void qc.invalidateQueries({ queryKey: ['giveaways'] });
      void qc.invalidateQueries({ queryKey: ['giveaway', giveawayId] });
    },
  });
}

export function useConfirmReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (giveawayId: string) =>
      apiClient.post<void>(`/giveaways/${giveawayId}/confirm-received`, undefined, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_d, giveawayId) => {
      void qc.invalidateQueries({ queryKey: ['giveaways'] });
      void qc.invalidateQueries({ queryKey: ['giveaway', giveawayId] });
    },
  });
}

export function useRateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ giveawayId, stars, comment }: { giveawayId: string; stars: number; comment?: string }) =>
      apiClient.post<unknown>(`/giveaways/${giveawayId}/ratings`, { stars, comment }, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_d, { giveawayId }) => {
      void qc.invalidateQueries({ queryKey: ['giveaway', giveawayId] });
    },
  });
}
