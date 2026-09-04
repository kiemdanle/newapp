import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TabsNavigator } from '../../src/navigation/TabsNavigator';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useSelectionModeStore } from '../../src/store/selectionModeStore';

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
}));

function renderTabs() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NavigationContainer>
          <TabsNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('TabsNavigator with Vertical Menu and Centered Action Button', () => {
  beforeEach(() => {
    useSelectionModeStore.setState({ isSelectionMode: false });
  });

  it('hides both the center action button and the menu button when selection mode is active', () => {
    const { queryByTestId } = renderTabs();

    expect(queryByTestId('home-scan-action')).toBeTruthy();
    expect(queryByTestId('bottom-nav-menu-button')).toBeTruthy();

    act(() => {
      useSelectionModeStore.setState({ isSelectionMode: true });
    });

    expect(queryByTestId('home-scan-action')).toBeNull();
    expect(queryByTestId('bottom-nav-menu-button')).toBeNull();
  });

  it('renders the Home scan action button and right-aligned menu button on initial load', () => {
    const { getByTestId, getByText } = renderTabs();

    expect(getByTestId('home-scan-action')).toBeTruthy();
    expect(getByText('Scan an item')).toBeTruthy();
    expect(getByTestId('bottom-nav-menu-button')).toBeTruthy();
  });

  it('opens vertical menu with all tabs when menu button is pressed', () => {
    const { getByTestId, getByText } = renderTabs();

    const menuButton = getByTestId('bottom-nav-menu-button');
    fireEvent.press(menuButton);

    expect(getByTestId('nav-Home')).toBeTruthy();
    expect(getByTestId('nav-Giveaways')).toBeTruthy();
    expect(getByTestId('nav-Deals')).toBeTruthy();
    expect(getByTestId('nav-Profile')).toBeTruthy();
    expect(getByTestId('bottom-nav-backdrop')).toBeTruthy();
  });

  it('closes vertical menu when backdrop is tapped', () => {
    const { getByTestId, queryByTestId } = renderTabs();

    const menuButton = getByTestId('bottom-nav-menu-button');
    fireEvent.press(menuButton);

    expect(getByTestId('bottom-nav-backdrop')).toBeTruthy();

    fireEvent.press(getByTestId('bottom-nav-backdrop'));
    expect(queryByTestId('bottom-nav-backdrop')).toBeNull();
  });

  it('switches to Deals tab and updates center action button to Post a deal', () => {
    const { getByTestId, getByText, queryByTestId } = renderTabs();

    // Open menu
    fireEvent.press(getByTestId('bottom-nav-menu-button'));

    // Navigate to Deals
    fireEvent.press(getByTestId('nav-Deals'));

    // Menu closes
    expect(queryByTestId('bottom-nav-backdrop')).toBeNull();

    // Center action button updates to Deals action
    expect(getByTestId('deal-new-action')).toBeTruthy();
    expect(getByText('Post a deal')).toBeTruthy();
  });

  it('switches to Giveaways tab and updates center action button to Create giveaway', () => {
    const { getByTestId, getByText } = renderTabs();

    // Open menu
    fireEvent.press(getByTestId('bottom-nav-menu-button'));

    // Navigate to Giveaways
    fireEvent.press(getByTestId('nav-Giveaways'));

    // Center action button updates to Giveaways action
    expect(getByTestId('giveaway-new-action')).toBeTruthy();
    expect(getByText('Create giveaway')).toBeTruthy();
  });

  it('switches to Profile tab and leaves center action button empty', () => {
    const { getByTestId, queryByTestId } = renderTabs();

    // Open menu
    fireEvent.press(getByTestId('bottom-nav-menu-button'));

    // Navigate to Profile
    fireEvent.press(getByTestId('nav-Profile'));

    // No center action on profile
    expect(queryByTestId('home-scan-action')).toBeNull();
    expect(queryByTestId('deal-new-action')).toBeNull();
    expect(queryByTestId('giveaway-new-action')).toBeNull();
    expect(getByTestId('bottom-nav-menu-button')).toBeTruthy();
  });
});
