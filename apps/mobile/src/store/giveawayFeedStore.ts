import { create } from 'zustand';

interface GiveawayFeedState {
  hasItems: boolean;
  setHasItems: (hasItems: boolean) => void;
}

export const useGiveawayFeedStore = create<GiveawayFeedState>((set) => ({
  hasItems: true,
  setHasItems: (hasItems: boolean) => set({ hasItems }),
}));
