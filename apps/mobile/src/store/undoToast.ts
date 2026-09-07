// apps/mobile/src/store/undoToast.ts
import { create } from 'zustand';

export interface UndoToastAction {
  id: string;
  recordId: string;
  parentId?: string | null;
  isSplit?: boolean;
  quantity?: number;
  unit?: string;
  itemName: string;
  status: 'consumed' | 'discarded';
  discardReason?: string | null;
}

export type ToastTimerHandle = any;

interface UndoToastState {
  current: UndoToastAction | null;
  timerId: ToastTimerHandle;
  show: (action: Omit<UndoToastAction, 'id'>) => void;
  dismiss: () => void;
}

export const useUndoToastStore = create<UndoToastState>((set, get) => ({
  current: null,
  timerId: null,
  show: (action) => {
    clearTimeout(get().timerId);

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timerId = setTimeout(() => {
      set({ current: null, timerId: null });
    }, 6000);

    set({
      current: { ...action, id },
      timerId,
    });
  },
  dismiss: () => {
    clearTimeout(get().timerId);
    set({ current: null, timerId: null });
  },
}));
