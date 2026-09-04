// apps/mobile/src/api/households.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Household,
  HouseholdCreate,
  HouseholdMember,
  HouseholdPatch,
  HouseholdMemberAdd,
  HouseholdJoin,
  HouseholdInvitation,
  HouseholdInvitationPreview,
} from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';
import { purgeHouseholdRecords, runSync } from '../db/sync';

interface HouseholdMembersResponse { items: HouseholdMember[] }
interface HouseholdListResponse { items: Household[] }

export function useMyHouseholds() {
  return useQuery({
    queryKey: ['households'],
    queryFn: () => apiClient.get<HouseholdListResponse>('/households/mine'),
    staleTime: 30_000,
  });
}

export function useHousehold(id: string | undefined) {
  return useQuery({
    queryKey: ['household', id],
    queryFn: () => apiClient.get<Household>(`/households/${id}`),
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useHouseholdMembers(householdId: string | undefined) {
  return useQuery({
    queryKey: ['householdMembers', householdId],
    queryFn: () =>
      apiClient.get<HouseholdMembersResponse>(`/households/${householdId}/members`),
    staleTime: 30_000,
    enabled: !!householdId,
  });
}

export function useCreateHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HouseholdCreate) =>
      apiClient.post<Household>('/households', input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['households'] }),
  });
}

export function useRenameHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: HouseholdPatch }) =>
      apiClient.patch<Household>(`/households/${id}`, input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_data, vars) =>
      void qc.invalidateQueries({ queryKey: ['household', vars.id] }),
  });
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ householdId, input }: { householdId: string; input: HouseholdMemberAdd }) =>
      apiClient.post<HouseholdMember>(`/households/${householdId}/members`, input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_data, vars) =>
      void qc.invalidateQueries({ queryKey: ['householdMembers', vars.householdId] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ householdId, userId }: { householdId: string; userId: string }) =>
      apiClient.delete(`/households/${householdId}/members/${userId}`),
    onSuccess: async (_data, vars) => {
      // Purge the removed member's household records from local WatermelonDB.
      await purgeHouseholdRecords([vars.householdId]);
      void qc.invalidateQueries({ queryKey: ['householdMembers', vars.householdId] });
      void qc.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

export function useDissolveHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/households/${id}`),
    onSuccess: async (_data, id) => {
      await purgeHouseholdRecords([id]);
      void qc.invalidateQueries({ queryKey: ['households'] });
      void qc.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

export function useRegenerateInviteCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string) =>
      apiClient.post<Household>(`/households/${householdId}/regenerate-invite-code`, {}, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: (_data, householdId) => {
      void qc.invalidateQueries({ queryKey: ['household', householdId] });
      void qc.invalidateQueries({ queryKey: ['households'] });
    },
  });
}

export function useJoinHousehold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HouseholdJoin) =>
      apiClient.post<Household>('/households/join', input, {
        headers: { 'idempotency-key': newIdempotencyKey() },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['households'] });
      void qc.invalidateQueries({ queryKey: ['records'] });
    },
  });
}

export function useHouseholdInvitePreview(code: string | undefined) {
  return useQuery({
    queryKey: ['householdInvitePreview', code],
    queryFn: () =>
      apiClient.get<{ id: string; name: string; ownerName: string; memberCount: number }>(
        `/households/invite/${code}`,
      ),
    enabled: !!code && code.length >= 4,
  });
}

export function useMyPendingInvitations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['households', 'invitations', 'mine'],
    queryFn: () =>
      apiClient.get<{ items: HouseholdInvitation[] }>('/households/invitations/mine'),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useHouseholdInvitationPreview(token: string | undefined) {
  return useQuery({
    queryKey: ['households', 'invitation-preview', token],
    queryFn: () =>
      apiClient.get<HouseholdInvitationPreview>(`/households/invitations/${token}`),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
}

export function useAcceptHouseholdInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<{ householdId: string; status: string }>(
        `/households/invitations/${token}/accept`,
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['households'] });
      await qc.invalidateQueries({ queryKey: ['households', 'invitations'] });
      void runSync();
    },
  });
}

export function useDeclineHouseholdInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiClient.post<{ status: string }>(`/households/invitations/${token}/decline`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['households', 'invitations'] });
    },
  });
}

export function useCreateHouseholdInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ householdId, email }: { householdId: string; email: string }) =>
      apiClient.post<{ invitation: HouseholdInvitation }>(
        `/households/${householdId}/invitations`,
        { email },
      ),
    onSuccess: async (_, { householdId }) => {
      await qc.invalidateQueries({ queryKey: ['households', householdId, 'invitations'] });
    },
  });
}

export function useHouseholdInvitations(householdId: string | undefined) {
  return useQuery({
    queryKey: ['households', householdId, 'invitations'],
    queryFn: () =>
      apiClient.get<{ items: HouseholdInvitation[] }>(
        `/households/${householdId}/invitations`,
      ),
    enabled: Boolean(householdId),
    staleTime: 30_000,
  });
}

export function useRevokeHouseholdInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      householdId,
      invitationId,
    }: {
      householdId: string;
      invitationId: string;
    }) => apiClient.delete(`/households/${householdId}/invitations/${invitationId}`),
    onSuccess: async (_, { householdId }) => {
      await qc.invalidateQueries({ queryKey: ['households', householdId, 'invitations'] });
    },
  });
}
