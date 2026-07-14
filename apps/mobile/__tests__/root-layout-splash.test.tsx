import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { hideAsync, preventAutoHideAsync } from '../tests/mocks/expo-splash-screen';

let mockResolveThemeHydration: (() => void) | undefined;
let mockResolveSessionHydration: (() => void) | undefined;
let mockRejectThemeHydration: ((error: Error) => void) | undefined;
let mockThemeStore: { setState: (state: { hydrated: boolean }) => void } | undefined;
let mockSessionStore: { setState: (state: { hydrated: boolean; accessToken: string | null }) => void } | undefined;

jest.mock('../global.css', () => ({}));

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: require('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
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
  mockThemeStore = useThemeStore;
  return {
    useThemeStore,
    initThemeStore: () =>
      new Promise<void>((resolve, reject) => {
        mockResolveThemeHydration = () => {
          useThemeStore.setState({ hydrated: true });
          resolve();
        };
        mockRejectThemeHydration = reject;
      }),
  };
});

jest.mock('../src/auth/session-store', () => {
  const { create } = jest.requireActual<typeof import('zustand')>('zustand');
  const useSessionStore = create<{ hydrated: boolean; accessToken: string | null }>(() => ({
    hydrated: false,
    accessToken: null,
  }));
  mockSessionStore = useSessionStore;
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
  beforeEach(() => {
    mockThemeStore?.setState({ hydrated: false });
    mockSessionStore?.setState({ hydrated: false, accessToken: null });
    hideAsync.mockClear();
    hideAsync.mockResolvedValue(undefined);
  });

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

  it('shows the boot error and hides the splash when hydration fails', async () => {
    const screen = render(<RootLayout />);

    await act(async () => {
      mockRejectThemeHydration?.(new Error('secure storage unavailable'));
    });

    expect(await screen.findByText('Unable to start Expyrico')).toBeTruthy();
    expect(hideAsync).toHaveBeenCalledTimes(1);
  });

  it('catches a native splash dismissal rejection', async () => {
    const error = new Error('native splash unavailable');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    hideAsync.mockRejectedValueOnce(error);

    render(<RootLayout />);

    await act(async () => {
      mockResolveThemeHydration?.();
      mockResolveSessionHydration?.();
    });

    await waitFor(() => expect(warn).toHaveBeenCalledWith('Failed to hide splash screen', error));
    warn.mockRestore();
  });

  it('catches a native splash retention rejection during module initialization', async () => {
    const error = new Error('native splash unavailable');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    jest.resetModules();
    jest.doMock('expo-splash-screen', () => ({
      preventAutoHideAsync: () => Promise.reject(error),
      hideAsync: jest.fn(),
    }));

    require('../app/_layout');
    await waitFor(() => expect(warn).toHaveBeenCalledWith('Failed to keep splash screen visible', error));

    warn.mockRestore();
  });
});
