import { create } from 'zustand';

interface SelectionModeState {
  isSelectionMode: boolean;
  setSelectionMode: (active: boolean) => void;
}

export const useSelectionModeStore = create<SelectionModeState>((set) => ({
  isSelectionMode: false,
  setSelectionMode: (isSelectionMode) => set({ isSelectionMode }),
}));
