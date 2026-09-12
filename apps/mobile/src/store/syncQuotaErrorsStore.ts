import { create } from 'zustand';

interface SyncQuotaErrorsState {
  errorClientIds: Set<string>;
  addError: (clientId: string) => void;
  removeError: (clientId: string) => void;
  clearErrors: () => void;
  hasError: (clientId: string) => boolean;
}

export const useSyncQuotaErrorsStore = create<SyncQuotaErrorsState>((set, get) => ({
  errorClientIds: new Set<string>(),
  addError: (clientId: string) =>
    set((state) => {
      const next = new Set(state.errorClientIds);
      next.add(clientId);
      return { errorClientIds: next };
    }),
  removeError: (clientId: string) =>
    set((state) => {
      if (!state.errorClientIds.has(clientId)) return state;
      const next = new Set(state.errorClientIds);
      next.delete(clientId);
      return { errorClientIds: next };
    }),
  clearErrors: () => set({ errorClientIds: new Set<string>() }),
  hasError: (clientId: string) => get().errorClientIds.has(clientId),
}));

export const syncQuotaErrorsStore = {
  add: (clientId: string) => useSyncQuotaErrorsStore.getState().addError(clientId),
  remove: (clientId: string) => useSyncQuotaErrorsStore.getState().removeError(clientId),
  clear: () => useSyncQuotaErrorsStore.getState().clearErrors(),
  has: (clientId: string) => useSyncQuotaErrorsStore.getState().hasError(clientId),
  getAll: () => useSyncQuotaErrorsStore.getState().errorClientIds,
};
