// apps/mobile/src/api/giveaways.ts
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Giveaway, GiveawayCreate, GiveawayPatch, Claim, GiveawayStatus } from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';

type Page = { items: Giveaway[]; cursor: string | null };

export function useGiveawayFeed(status: GiveawayStatus = 'open') {
  return useInfiniteQuery<Page>({
    queryKey: ['giveaways', status],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Page>(`/giveaways?status=${status}${pageParam ? `&cursor=${pageParam}` : ''}`),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['giveaways'] }),
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
    queryFn: () => apiClient.get<Claim[]>(`/giveaways/${giveawayId}/claims`),
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
