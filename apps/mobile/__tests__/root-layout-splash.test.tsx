import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { hideAsync, preventAutoHideAsync } from '../tests/mocks/expo-splash-screen';

let mockResolveThemeHydration: (() => void) | undefined;
let mockResolveSessionHydration: (() => void) | undefined;

jest.mock('../global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: require('react-native').View,
}));
jest.mock('expo-linking', () => ({
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  parse: jest.fn(),
}));
jest.mock('expo-router', () => ({
  Slot: () => null,
  useRouter: () => ({ replace: jest.fn() }),
  useSegments: () => [],
}));

jest.mock('../src/theme/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../src/theme/store', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const useThemeStore = create<{ hydrated: boolean }>(() => ({ hydrated: false }));
  return {
    useThemeStore,
    initThemeStore: () =>
      new Promise<void>((resolve) => {
        mockResolveThemeHydration = () => {
          useThemeStore.setState({ hydrated: true });
          resolve();
        };
      }),
  };
});

jest.mock('../src/auth/session-store', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const useSessionStore = create<{ hydrated: boolean; accessToken: string | null }>(() => ({
    hydrated: false,
    accessToken: null,
  }));
  return {
    useSessionStore,
    hydrateSession: () =>
      new Promise<void>((resolve) => {
        mockResolveSessionHydration = () => {
          useSessionStore.setState({ hydrated: true });
          resolve();
        };
      }),
  };
});

jest.mock('../src/auth/wire-client', () => ({ wireApiClient: jest.fn() }));
jest.mock('../src/db/triggers', () => ({ startSyncTriggers: jest.fn(), stopSyncTriggers: jest.fn() }));
jest.mock('../src/referral/pendingReferralStore', () => ({ capturePendingReferralCode: jest.fn() }));

import RootLayout from '../app/_layout';

describe('<RootLayout /> splash lifecycle', () => {
  it('keeps the native splash until theme and session hydration complete', async () => {
    render(<RootLayout />);

    expect(preventAutoHideAsync).toHaveBeenCalledTimes(1);
    expect(hideAsync).not.toHaveBeenCalled();

    await act(async () => {
      mockResolveThemeHydration?.();
      mockResolveSessionHydration?.();
    });

    await waitFor(() => expect(hideAsync).toHaveBeenCalledTimes(1));
  });
});
