import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import App from '../src/App';

let mockResolveThemeHydration: (() => void) | undefined;
let mockResolveSessionHydration: (() => void) | undefined;
let mockRejectThemeHydration: ((error: Error) => void) | undefined;
let mockThemeStore: { setState: (state: { hydrated: boolean }) => void } | undefined;
let mockSessionStore: { setState: (state: { hydrated: boolean; accessToken: string | null }) => void } | undefined;

jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: require('react-native').View,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
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

jest.mock('../src/navigation/RootNavigator', () => ({
  RootNavigator: () => null,
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  };
});

describe('App splash lifecycle', () => {
  beforeEach(() => {
    mockThemeStore?.setState({ hydrated: false });
    mockSessionStore?.setState({ hydrated: false, accessToken: null });
  });

  it('shows the splash overlay until theme and session hydration complete', async () => {
    const screen = render(<App />);

    expect(screen.getByTestId('splash-overlay')).toBeTruthy();

    await act(async () => {
      mockResolveThemeHydration?.();
      mockResolveSessionHydration?.();
    });

    await waitFor(() => expect(screen.queryByTestId('splash-overlay')).toBeNull());
  });

  it('shows the boot error when hydration fails', async () => {
    const screen = render(<App />);

    await act(async () => {
      mockRejectThemeHydration?.(new Error('secure storage unavailable'));
    });

    expect(await screen.findByText('Unable to start Expyrico')).toBeTruthy();
  });
});
