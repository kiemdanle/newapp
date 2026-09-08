import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TabsNavigator } from '../../src/navigation/TabsNavigator';
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
}));

import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useSelectionModeStore } from '../../src/store/selectionModeStore';
import { useDrawerStore } from '../../src/store/drawerStore';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 47, right: 0, bottom: 34, left: 0 })),
}));

// Mock DB sync
jest.mock('../../src/db/sync', () => ({
  runSync: jest.fn(),
  subscribeToSyncEvents: jest.fn(() => () => {}),
}));

// Mock records
jest.mock('../../src/api/records', () => ({
  useActiveRecords: () => [],
  usePantryHistoryRecords: () => [],
  patchLocalRecord: jest.fn(),
  deleteLocalRecord: jest.fn(),
}));

// Mock deals
jest.mock('../../src/api/deals', () => ({
  useDealFeed: () => ({
    data: { pages: [{ items: [], cursor: null }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useDealStores: () => ({ data: { items: [] } }),
}));

// Mock giveaways
jest.mock('../../src/api/giveaways', () => ({
  useGiveawayFeed: () => ({
    data: { pages: [{ items: [], cursor: null }] },
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useUpdateGiveaway: () => ({ mutateAsync: jest.fn() }),
  useCancelGiveaway: () => ({ mutateAsync: jest.fn() }),
}));

// Mock products
jest.mock('../../src/api/products', () => ({
  useProductDrafts: () => ({ data: { pages: [] } }),
  useProduct: () => ({ data: null, isLoading: false }),
}));

// Mock reviews
jest.mock('../../src/api/reviews', () => ({
  useMyReviews: () => ({
    data: { pages: [{ items: [] }] },
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isFetchingNextPage: false,
  }),
  useCommunityReviews: () => ({
    data: { pages: [{ items: [] }] },
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
    hasNextPage: false,
    fetchNextPage: jest.fn(),
    isFetchingNextPage: false,
  }),
  useVoteReviewHelpful: () => ({ mutate: jest.fn() }),
  deduplicateReviews: (pages: any) => (pages ? pages.flatMap((p: any) => p.items) : []),
}));

const Stack = createNativeStackNavigator();

let activeQueryClient: QueryClient | null = null;

function renderTabs() {
  activeQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={activeQueryClient}>
      <ThemeProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Tabs" component={TabsNavigator} />
          </Stack.Navigator>
        </NavigationContainer>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  activeQueryClient?.clear();
  activeQueryClient = null;
});

describe('TabsNavigator with Sliding Drawer and Centered Action Button', () => {
  beforeEach(() => {
    act(() => {
      useSelectionModeStore.setState({ isSelectionMode: false });
      useDrawerStore.getState().reset();
    });
  });

  it('hides both the center action button and the top-left hamburger menu button when selection mode is active', () => {
    const { queryByTestId } = renderTabs();

    expect(queryByTestId('home-scan-action')).toBeTruthy();
    expect(queryByTestId('top-nav-menu-button')).toBeTruthy();

    act(() => {
      useSelectionModeStore.setState({ isSelectionMode: true });
    });

    expect(queryByTestId('home-scan-action')).toBeNull();
    expect(queryByTestId('top-nav-menu-button')).toBeNull();
  });

  it('renders the Home scan action button and top-left hamburger menu button on initial load', () => {
    const { getByTestId, getByText } = renderTabs();

    expect(getByTestId('home-scan-action')).toBeTruthy();
    expect(getByText('Scan an item')).toBeTruthy();
    expect(getByTestId('top-nav-menu-button')).toBeTruthy();
  });

  it('opens sliding drawer with all tabs when hamburger button is pressed', () => {
    const { getByTestId } = renderTabs();

    const menuButton = getByTestId('top-nav-menu-button');
    act(() => {
      fireEvent.press(menuButton);
    });

    expect(useDrawerStore.getState().isOpen).toBe(true);
    expect(getByTestId('nav-Home')).toBeTruthy();
    expect(getByTestId('nav-Giveaways')).toBeTruthy();
    expect(getByTestId('nav-Deals')).toBeTruthy();
    expect(getByTestId('nav-Reviews')).toBeTruthy();
    expect(getByTestId('nav-Profile')).toBeTruthy();
    expect(getByTestId('drawer-backdrop')).toBeTruthy();
  });

  it('closes sliding drawer when backdrop is tapped', () => {
    const { getByTestId, getByLabelText } = renderTabs();

    const menuButton = getByTestId('top-nav-menu-button');
    act(() => {
      fireEvent.press(menuButton);
    });

    expect(getByTestId('drawer-backdrop')).toBeTruthy();

    const backdropButton = getByLabelText('Dismiss menu backdrop');
    act(() => {
      fireEvent.press(backdropButton);
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
  });

  it('switches to Deals tab and updates center action button to Post a deal', () => {
    const { getByTestId, getByText } = renderTabs();

    // Open drawer
    act(() => {
      fireEvent.press(getByTestId('top-nav-menu-button'));
    });

    // Navigate to Deals
    act(() => {
      fireEvent.press(getByTestId('nav-Deals'));
    });

    // Drawer closes
    expect(useDrawerStore.getState().isOpen).toBe(false);

    // Center action button updates to Deals action
    expect(getByTestId('deal-new-action')).toBeTruthy();
    expect(getByText('Post a deal')).toBeTruthy();
  });

  it('switches to Reviews tab and updates center action button to Scan to review', () => {
    const { getByTestId, getByText } = renderTabs();

    act(() => {
      fireEvent.press(getByTestId('top-nav-menu-button'));
    });
    act(() => {
      fireEvent.press(getByTestId('nav-Reviews'));
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
    expect(getByTestId('reviews-scan-action')).toBeTruthy();
    expect(getByText('Scan to review')).toBeTruthy();
  });

  it('switches to Giveaways tab and updates center action button to Create giveaway', () => {
    const { getByTestId, getByText } = renderTabs();

    // Open drawer
    act(() => {
      fireEvent.press(getByTestId('top-nav-menu-button'));
    });

    // Navigate to Giveaways
    act(() => {
      fireEvent.press(getByTestId('nav-Giveaways'));
    });

    // Center action button updates to Giveaways action
    expect(getByTestId('giveaway-new-action')).toBeTruthy();
    expect(getByText('Create giveaway')).toBeTruthy();
  });

  it('switches to Profile tab and leaves center action button empty', () => {
    const { getByTestId, queryByTestId } = renderTabs();

    // Open drawer
    act(() => {
      fireEvent.press(getByTestId('top-nav-menu-button'));
    });

    // Navigate to Profile
    act(() => {
      fireEvent.press(getByTestId('nav-Profile'));
    });

    // No center action on profile
    expect(queryByTestId('home-scan-action')).toBeNull();
    expect(queryByTestId('deal-new-action')).toBeNull();
    expect(queryByTestId('giveaway-new-action')).toBeNull();
    expect(getByTestId('profile-hamburger-button')).toBeTruthy();
  });
});
