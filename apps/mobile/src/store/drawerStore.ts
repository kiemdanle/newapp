import { create } from 'zustand';
import type { TabsParamList } from '../navigation/TabsNavigator';

export type TabName = keyof TabsParamList;

export interface DrawerState {
  isOpen: boolean;
  activeTab: TabName;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setActiveTab: (tab: TabName) => void;
  reset: () => void;
}

const initialState = {
  isOpen: false,
  activeTab: 'Home' as TabName,
};

export const useDrawerStore = create<DrawerState>((set) => ({
  ...initialState,
  openDrawer: () => set({ isOpen: true }),
  closeDrawer: () => set({ isOpen: false }),
  toggleDrawer: () => set((state) => ({ isOpen: !state.isOpen })),
  setActiveTab: (activeTab) => set({ activeTab }),
  reset: () => set(initialState),
}));
