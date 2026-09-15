// apps/mobile/__tests__/DealFeed.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealFeed } from '../src/features/deals/DealFeed';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { useDealFeedStore } from '../src/store/dealFeedStore';

const mockDeal = {
  id: 'deal-1',
  userId: 'user-1',
  productId: 'prod-1',
  price: 4.99,
  currency: 'USD',
  storeName: 'Trader Joe',
  photoUrl: null,
  expiryDate: '2026-09-01',
  note: 'Clearance item',
  upvoteCount: 5,
  downvoteCount: 0,
  score: 0.8,
  status: 'visible' as const,
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
  myVote: null,
  product: { id: 'prod-1', name: 'Almond Butter', brand: 'TJ', imageUrl: null },
  author: { id: 'user-1', firstName: 'Alice', avatarUrl: null },
};

const mockFeedResult = {
  data: { pages: [{ items: [mockDeal], cursor: null }] },
  isLoading: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  fetchNextPage: jest.fn(),
  refetch: jest.fn(),
  isRefetching: false,
};
let mockCurrentFeedResult: any = mockFeedResult;

jest.mock('../src/api/deals', () => ({
  useDealFeed: () => mockCurrentFeedResult,
  useDealStores: () => ({ data: { items: [{ name: 'Trader Joe', count: 1 }] } }),
  useDealVote: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteDealVote: () => ({ mutate: jest.fn(), isPending: false }),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </ThemeProvider>
  );
}


describe('DealFeed', () => {
  beforeEach(() => {
    mockCurrentFeedResult = mockFeedResult;
    useDealFeedStore.setState({ hasItems: true });
  });
  it('renders deal feed with search bar, sorts, and deal items', () => {
    const onOpen = jest.fn();
    const onReport = jest.fn();
    const onNew = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      wrap(
        <DealFeed
          currentUserId="user-2"
          onOpen={onOpen}
          onReport={onReport}
          onNew={onNew}
        />,
      ),
    );

    expect(getByText('Deals')).toBeTruthy();
    expect(getByPlaceholderText('Search products, stores, brands…')).toBeTruthy();
    expect(getByText('Almond Butter')).toBeTruthy();
    expect(getByText('🔥 Top')).toBeTruthy();
  });

  it('renders "Post a deal" button under "No deals posted yet" card when feed is empty and triggers onNew', () => {
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
    const { getByText, getByTestId } = render(
      wrap(
        <DealFeed
          currentUserId="user-2"
          onOpen={jest.fn()}
          onReport={jest.fn()}
          onNew={onNew}
        />,
      ),
    );

    expect(getByText('No deals posted yet')).toBeTruthy();
    const postDealBtn = getByTestId('deal-create-empty-action');
    expect(postDealBtn).toBeTruthy();
    expect(getByText('Post a deal')).toBeTruthy();

    fireEvent.press(postDealBtn);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(useDealFeedStore.getState().hasItems).toBe(false);
  });

  it('updates dealFeedStore hasItems to true when deals exist', () => {
    render(
      wrap(
        <DealFeed
          currentUserId="user-2"
          onOpen={jest.fn()}
          onReport={jest.fn()}
          onNew={jest.fn()}
        />,
      ),
    );
    expect(useDealFeedStore.getState().hasItems).toBe(true);
  });
});
