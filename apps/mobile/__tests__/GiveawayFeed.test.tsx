import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GiveawayFeed } from '../src/features/giveaways/GiveawayFeed';
import { useSessionStore } from '../src/auth/session-store';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useGiveawayFeedStore } from '../src/store/giveawayFeedStore';

const mockGiveaway = {
  id: 'giveaway-1',
  userId: 'user-1',
  title: 'Tomato Soup',
  description: 'Extra canned soup',
  status: 'open' as const,
  locationText: 'Downtown',
  photoUrl: null,
  quantity: 2,
  unit: 'cans',
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
  giver: { id: 'user-1', firstName: 'Bob', giverRatingAvg: 4.8 },
};
const mockFeedResult = {
  data: { pages: [{ items: [mockGiveaway], cursor: null }] },
  isLoading: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: jest.fn(),
  refetch: jest.fn(),
  isRefetching: false,
};
let mockCurrentFeedResult: any = mockFeedResult;

jest.mock('../src/api/giveaways', () => ({
  useGiveawayFeed: () => mockCurrentFeedResult,
  useUpdateGiveaway: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useCancelGiveaway: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </ThemeProvider>
  );
}


describe('GiveawayFeed', () => {
  beforeEach(() => {
    mockCurrentFeedResult = mockFeedResult;
    useGiveawayFeedStore.setState({ hasItems: true });
  });
  it('renders giveaways title and items', () => {
    const onOpen = jest.fn();
    const onNew = jest.fn();

    const { getByText } = render(
      wrap(<GiveawayFeed onOpen={onOpen} onNew={onNew} />),
    );

    expect(getByText('Giveaways')).toBeTruthy();
    expect(getByText('Tomato Soup')).toBeTruthy();
  });

  it('renders active filter chip when status filter is applied and allows clearing', () => {
    const { getByLabelText, getByText, queryByText } = render(
      wrap(<GiveawayFeed onOpen={jest.fn()} onNew={jest.fn()} />),
    );

    // Open filter modal
    fireEvent.press(getByLabelText('Open filters'));

    // Select Reserved status and Apply
    fireEvent.press(getByText('Reserved'));
    fireEvent.press(getByText('Apply Filters'));

    // Expect active filter chip to be displayed
    expect(getByText('🏷️ Status: Reserved ✕')).toBeTruthy();

    // Tap the chip to remove the filter
    fireEvent.press(getByText('🏷️ Status: Reserved ✕'));
    expect(queryByText('🏷️ Status: Reserved ✕')).toBeNull();
  });

  it('renders "Create giveaway" button under "No giveaways yet" card when feed is empty, removing "+ Share the first item"', () => {
    mockCurrentFeedResult = {
      data: { pages: [{ items: [], cursor: null }] },
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      refetch: jest.fn(),
      isRefetching: false,
    };
    const onNew = jest.fn();
    const { getByText, queryByText, getByTestId } = render(
      wrap(<GiveawayFeed onOpen={jest.fn()} onNew={onNew} />),
    );

    // Verifies "+ Share the first item" is removed
    expect(queryByText('+ Share the first item')).toBeNull();

    // Verifies "No giveaways yet" empty card is displayed
    expect(getByText('No giveaways yet')).toBeTruthy();

    // Verifies "Create giveaway" button is rendered under the empty state card
    const createBtn = getByTestId('giveaway-create-empty-action');
    expect(createBtn).toBeTruthy();
    expect(getByText('Create giveaway')).toBeTruthy();

    fireEvent.press(createBtn);
    expect(onNew).toHaveBeenCalled();

    // Verifies store updated hasItems to false
    expect(useGiveawayFeedStore.getState().hasItems).toBe(false);
  });

  it('updates giveawayFeedStore hasItems to true when items exist', () => {
    render(wrap(<GiveawayFeed onOpen={jest.fn()} onNew={jest.fn()} />));
    expect(useGiveawayFeedStore.getState().hasItems).toBe(true);
  });
});
