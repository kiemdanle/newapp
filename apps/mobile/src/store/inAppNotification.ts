import { create } from 'zustand';
import type { InAppNotification } from '../components/InAppNotificationBanner';

interface InAppNotificationState {
  current: InAppNotification | null;
  show: (notification: InAppNotification) => void;
  dismiss: () => void;
}

export const useInAppNotificationStore = create<InAppNotificationState>((set) => ({
  current: null,
  show: (current) => set({ current }),
  dismiss: () => set({ current: null }),
}));
