import { create } from 'zustand';
import { useConnectionStore } from './connectionStore';

export interface ConnectionGuardState {
  isModalVisible: boolean;
  actionName: string;
  pendingCallback: (() => void) | null;

  /**
   * Execute an action requiring server validation.
   * If server connection is ready, immediately executes `onProceed()` and returns true.
   * If connection is offline/unreachable, opens the ConnectionNoticeModal and returns false.
   */
  requireServerConnection: (actionName: string, onProceed: () => void) => boolean;

  /**
   * Called when user successfully reconnects or retries inside the modal.
   * If connection is restored, runs the pending callback and closes modal.
   */
  executePendingAction: () => void;

  /**
   * Dismiss the modal (e.g. user taps "Keep Browsing" or "Cancel").
   */
  closeModal: () => void;
}

export const useConnectionGuardStore = create<ConnectionGuardState>((set, get) => ({
  isModalVisible: false,
  actionName: '',
  pendingCallback: null,

  requireServerConnection: (actionName: string, onProceed: () => void): boolean => {
    const status = useConnectionStore.getState().status;
    if (status === 'ready') {
      return true;
    }

    set({
      isModalVisible: true,
      actionName,
      pendingCallback: onProceed,
    });
    return false;
  },

  executePendingAction: () => {
    const { pendingCallback } = get();
    set({ isModalVisible: false, actionName: '', pendingCallback: null });
    if (pendingCallback) {
      pendingCallback();
    }
  },

  closeModal: () => {
    set({ isModalVisible: false, actionName: '', pendingCallback: null });
  },
}));
