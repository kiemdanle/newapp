import { create } from 'zustand';

interface PendingInvitationState {
  activeInvitationToken: string | null;
  setActiveInvitationToken: (token: string | null) => void;
}

export const usePendingInvitationStore = create<PendingInvitationState>((set) => ({
  activeInvitationToken: null,
  setActiveInvitationToken: (token) => set({ activeInvitationToken: token }),
}));

export function capturePendingHouseholdInvitationToken(token: string): void {
  usePendingInvitationStore.getState().setActiveInvitationToken(token);
}
