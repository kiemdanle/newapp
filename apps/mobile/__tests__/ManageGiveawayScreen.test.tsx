import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ManageGiveawayScreen from '../app/(app)/giveaway/[id]/manage';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

const mockGiveaway = {
  id: 'giveaway-1',
  giverUserId: 'user-1',
  title: 'Pasta Pack',
  locationText: 'Downtown',
  status: 'open' as const,
  selectedRecipientId: null,
  photoUrl: null,
};

const mockClaims = [
  {
    id: 'claim-1',
    giveawayId: 'giveaway-1',
    claimerUserId: 'user-2',
    pickupNote: 'Can pick up today at 5pm',
    status: 'requested' as const,
    createdAt: '2026-08-26T00:00:00.000Z',
    claimer: { id: 'user-2', firstName: 'Sarah', recipientRatingAvg: 5.0, transactionCount: 3 },
  },
];

const mockSelectClaim = jest.fn().mockResolvedValue({ id: 'claim-1' });

jest.mock('../src/api/giveaways', () => ({
  useGiveaway: () => ({ data: mockGiveaway, isLoading: false }),
  useGiveawayClaims: () => ({ data: mockClaims, isLoading: false, refetch: jest.fn() }),
  useSelectClaim: () => ({ mutateAsync: mockSelectClaim, isPending: false }),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
    useRoute: () => ({ params: { id: 'giveaway-1' } }),
  };
});

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NavigationContainer>
      <QueryClientProvider client={qc}>
        <ThemeProvider>{node}</ThemeProvider>
      </QueryClientProvider>
    </NavigationContainer>
  );
}

describe('ManageGiveawayScreen', () => {
  beforeEach(() => {
    mockSelectClaim.mockClear();
  });

  it('renders giveaway summary and claim requests', () => {
    const { getByText } = render(wrap(<ManageGiveawayScreen />));

    expect(getByText('Pasta Pack')).toBeTruthy();
    expect(getByText('📍 Downtown')).toBeTruthy();
    expect(getByText('Sarah')).toBeTruthy();
    expect(getByText('"Can pick up today at 5pm"')).toBeTruthy();
    expect(getByText('Select Recipient')).toBeTruthy();
  });

  it('allows giver to select recipient', async () => {
    const { getByText } = render(wrap(<ManageGiveawayScreen />));

    fireEvent.press(getByText('Select Recipient'));

    await waitFor(() => {
      expect(mockSelectClaim).toHaveBeenCalledWith({
        giveawayId: 'giveaway-1',
        claimId: 'claim-1',
      });
    });
  });
});
