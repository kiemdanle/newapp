import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  evaluateConnection,
  type ConnectionStatus,
  type ConnectionEvaluationResult,
} from '../services/network/connection-service';

export interface ConnectionState {
  status: ConnectionStatus;
  clientOnline: boolean;
  serverReady: boolean;
  isRetrying: boolean;
  lastCheckedAt: number | null;
  errorDetail: string | null;
  initialized: boolean;

  // Actions
  checkConnection: () => Promise<ConnectionEvaluationResult>;
  retry: () => Promise<ConnectionEvaluationResult>;
  setStatus: (status: ConnectionStatus) => void;
  reset: () => void;
}

let unsubscribeNetInfo: (() => void) | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let lastNetOnline: boolean | null = null;

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  status: 'checking',
  clientOnline: false,
  serverReady: false,
  isRetrying: false,
  lastCheckedAt: null,
  errorDetail: null,
  initialized: false,

  setStatus: (status: ConnectionStatus) => set({ status }),

  checkConnection: async () => {
    const result = await evaluateConnection();
    set({
      status: result.status,
      clientOnline: result.clientOnline,
      serverReady: result.serverReady,
      errorDetail: result.errorDetail ?? null,
      lastCheckedAt: Date.now(),
      initialized: true,
    });
    return result;
  },

  retry: async () => {
    if (get().isRetrying) {
      return {
        status: get().status,
        clientOnline: get().clientOnline,
        serverReady: get().serverReady,
        errorDetail: get().errorDetail ?? undefined,
      };
    }
    set({ isRetrying: true });
    try {
      const result = await evaluateConnection();
      set({
        status: result.status,
        clientOnline: result.clientOnline,
        serverReady: result.serverReady,
        errorDetail: result.errorDetail ?? null,
        lastCheckedAt: Date.now(),
        initialized: true,
      });
      return result;
    } finally {
      set({ isRetrying: false });
    }
  },

  reset: () => {
    set({
      status: 'checking',
      clientOnline: false,
      serverReady: false,
      isRetrying: false,
      lastCheckedAt: null,
      errorDetail: null,
      initialized: false,
    });
  },
}));

/**
 * Initialize event-driven network monitoring:
 * - Listens for NetInfo changes: if device was offline and turns online, re-check connection.
 * - Listens for AppState changes: when foregrounded (`active`), re-check connection.
 * Returns teardown cleanup function.
 */
export function initConnectionMonitoring(): () => void {
  // Teardown any existing subscriptions first
  teardownConnectionMonitoring();

  // NetInfo event subscription (pure event-driven)
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    // If state transitions from offline to online, or on initial state capture
    if (lastNetOnline === false && isOnline) {
      void useConnectionStore.getState().checkConnection();
    } else if (lastNetOnline === true && !isOnline) {
      // Immediate optimistic update to offline
      useConnectionStore.setState({
        status: 'offline',
        clientOnline: false,
        serverReady: false,
        errorDetail: 'No active internet connection',
        lastCheckedAt: Date.now(),
      });
    }
    lastNetOnline = isOnline;
  });

  // AppState foreground event subscription
  const handleAppStateChange = (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      void useConnectionStore.getState().checkConnection();
    }
  };
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  // Initial check on mount
  void useConnectionStore.getState().checkConnection();

  return teardownConnectionMonitoring;
}

export function teardownConnectionMonitoring(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  lastNetOnline = null;
}
