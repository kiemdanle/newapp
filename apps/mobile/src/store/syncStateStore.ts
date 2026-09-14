import { create } from 'zustand';

export interface SyncState {
  isSyncing: boolean;
  initialSyncCompleted: boolean;
  lastSyncError: string | null;
  beginInitialSync: () => void;
  setSyncStart: () => void;
  setSyncSuccess: () => void;
  setSyncError: (err: unknown) => void;
  reset: () => void;
}

let initialSyncTimer: NodeJS.Timeout | number | null = null;

export const useSyncStateStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  initialSyncCompleted: false,
  lastSyncError: null,

  beginInitialSync: () => {
    if (get().initialSyncCompleted || initialSyncTimer !== null) {
      return;
    }

    initialSyncTimer = setTimeout(() => {
      initialSyncTimer = null;
      if (!get().initialSyncCompleted) {
        const isCurrentlySyncing = get().isSyncing;
        set({
          initialSyncCompleted: true,
          // If the network request is still actively running, do not claim timeout/offline
          lastSyncError: isCurrentlySyncing ? null : 'timeout',
          isSyncing: isCurrentlySyncing,
        });
      }
    }, 4000);
  },

  setSyncStart: () => {
    set({ isSyncing: true, lastSyncError: null });
  },

  setSyncSuccess: () => {
    if (initialSyncTimer !== null) {
      clearTimeout(initialSyncTimer);
      initialSyncTimer = null;
    }
    set({
      isSyncing: false,
      initialSyncCompleted: true,
      lastSyncError: null,
    });
  },

  setSyncError: (err: unknown) => {
    if (initialSyncTimer !== null) {
      clearTimeout(initialSyncTimer);
      initialSyncTimer = null;
    }
    const message = err instanceof Error ? err.message : String(err);
    set({
      isSyncing: false,
      initialSyncCompleted: true,
      lastSyncError: message,
    });
  },

  reset: () => {
    if (initialSyncTimer !== null) {
      clearTimeout(initialSyncTimer);
      initialSyncTimer = null;
    }
    set({
      isSyncing: false,
      initialSyncCompleted: false,
      lastSyncError: null,
    });
  },
}));
