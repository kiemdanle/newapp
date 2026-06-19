// apps/mobile/src/api/households.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Household, HouseholdCreate, HouseholdMember, HouseholdPatch, HouseholdMemberAdd } from '@expyrico/shared';
import { apiClient } from './client';
import { newIdempotencyKey } from '../lib/idempotency';
import { purgeHouseholdRecords } from '../db/sync';

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
