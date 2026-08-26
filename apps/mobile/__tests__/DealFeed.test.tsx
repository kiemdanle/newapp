// apps/mobile/__tests__/DealFeed.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealFeed } from '../src/features/deals/DealFeed';
import { ThemeProvider } from '../src/theme/ThemeProvider';

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

jest.mock('../src/api/deals', () => ({
  useDealFeed: () => mockFeedResult,
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

  it('triggers onNew when Post Deal button is pressed', () => {
    const onNew = jest.fn();

    const { getByLabelText } = render(
      wrap(
        <DealFeed
          currentUserId="user-2"
          onOpen={jest.fn()}
          onReport={jest.fn()}
          onNew={onNew}
        />,
      ),
    );

    fireEvent.press(getByLabelText('Post a deal'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});
