import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DealDetailScreen from '../app/(app)/deal/[id]';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

const mockDeal = {
  id: 'deal-detail-1',
  userId: 'user-1',
  productId: 'prod-1',
  price: 4.5,
  currency: 'USD',
  storeName: 'Costco',
  photoUrl: null,
  expiryDate: '2026-10-01',
  note: 'Bulk pack on sale',
  upvoteCount: 10,
  downvoteCount: 2,
  score: 0.8,
  status: 'visible' as const,
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
  myVote: null,
  product: { id: 'prod-1', name: 'Greek Yogurt', brand: 'Kirkland', imageUrl: null },
  author: { id: 'user-1', firstName: 'Bob', avatarUrl: null },
};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useRoute: () => ({ params: { id: 'deal-detail-1' } }),
    useNavigation: () => ({ push: jest.fn(), goBack: jest.fn() }),
  };
});

jest.mock('../src/api/deals', () => ({
  useDeal: () => ({ data: mockDeal, isLoading: false }),
  useDeleteDeal: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDealVote: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteDealVote: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('../src/auth/session-store', () => ({
  useSessionStore: (selector: any) => selector({ user: { id: 'user-other' } }),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NavigationContainer>
      <ThemeProvider>
        <QueryClientProvider client={qc}>{node}</QueryClientProvider>
      </ThemeProvider>
    </NavigationContainer>
  );
}

describe('DealDetailScreen', () => {
  it('renders product name, price, store, expiry and note', () => {
    const { getByText } = render(wrap(<DealDetailScreen />));
    expect(getByText('Greek Yogurt')).toBeTruthy();
    expect(getByText('Kirkland')).toBeTruthy();
    expect(getByText(/Costco/)).toBeTruthy();
    expect(getByText(/Bulk pack on sale/)).toBeTruthy();
    expect(getByText(/Expiration \/ Best-By Date/)).toBeTruthy();
  });

  it('renders share and report buttons for non-owner', () => {
    const { getByText } = render(wrap(<DealDetailScreen />));
    expect(getByText('Share this deal')).toBeTruthy();
    expect(getByText('Report deal')).toBeTruthy();
  });
});
