import { create } from 'zustand';

interface DealFeedState {
  hasItems: boolean;
  setHasItems: (hasItems: boolean) => void;
}

export const useDealFeedStore = create<DealFeedState>((set) => ({
  hasItems: true,
  setHasItems: (hasItems: boolean) => set({ hasItems }),
}));
