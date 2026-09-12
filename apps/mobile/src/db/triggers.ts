import { AppState, type AppStateStatus } from 'react-native';
import { runSync } from './sync';
import { useConnectionStore } from '../store/connectionStore';
import type { ConnectionStatus } from '../services/network/connection-service';

const FIVE_MIN_MS = 5 * 60 * 1000;
const RECONNECT_COOLDOWN_MS = 3000;

let started = false;
let interval: NodeJS.Timeout | number | null = null;
let unsubscribeConnection: (() => void) | null = null;
let prevConnectionStatus: ConnectionStatus = 'checking';
let lastSyncAt = 0;

export function startSyncTriggers(): void {
  if (started) return;
  started = true;

  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') {
      const currentStatus = useConnectionStore.getState().status;
      if (currentStatus === 'ready') {
        void runSync();
      }
    }
  });

  // Subscribe to connection state transitions: when transitioning to 'ready',
  // reconcile local WatermelonDB records.
  prevConnectionStatus = useConnectionStore.getState().status;
  unsubscribeConnection = useConnectionStore.subscribe((state) => {
    const currentStatus = state.status;
    if (currentStatus === 'ready' && prevConnectionStatus !== 'ready') {
      const now = Date.now();
      if (now - lastSyncAt > RECONNECT_COOLDOWN_MS) {
        lastSyncAt = now;
        void runSync();
      }
    }
    prevConnectionStatus = currentStatus;
  });

  interval = setInterval(() => {
    if (AppState.currentState === 'active' && useConnectionStore.getState().status === 'ready') {
      void runSync();
    }
  }, FIVE_MIN_MS);

  // Initial sync on startup if connection is already verified
  if (useConnectionStore.getState().status === 'ready') {
    void runSync();
  }
}

export function stopSyncTriggers(): void {
  clearInterval(interval as unknown as number);
  interval = null;
  if (unsubscribeConnection) {
    unsubscribeConnection();
    unsubscribeConnection = null;
  }
  started = false;
  lastSyncAt = 0;
  prevConnectionStatus = 'checking';
}

/**
 * Call after every local write to schedule a quick sync.
 */
export function triggerSyncSoon(): void {
  void runSync();
}
