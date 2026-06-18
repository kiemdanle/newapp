import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { runSync } from './sync';

const FIVE_MIN_MS = 5 * 60 * 1000;

let started = false;
let interval: ReturnType<typeof setInterval> | null = null;
let lastNetState = true;

export function startSyncTriggers(): void {
  if (started) return;
  started = true;

  AppState.addEventListener('change', (s: AppStateStatus) => {
    if (s === 'active') void runSync();
  });

  NetInfo.addEventListener((state) => {
    const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    if (isOnline && !lastNetState) void runSync();
    lastNetState = isOnline;
  });

  interval = setInterval(() => {
    if (AppState.currentState === 'active') void runSync();
  }, FIVE_MIN_MS);

  // Initial sync on startup
  void runSync();
}

export function stopSyncTriggers(): void {
  if (interval) clearInterval(interval);
  interval = null;
  started = false;
}

/**
 * Call after every local write to schedule a quick sync.
 */
export function triggerSyncSoon(): void {
  void runSync();
}
