// apps/mobile/__tests__/GiveawayDetailScreen.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GiveawayDetailScreen from '../app/(app)/giveaway/[id]';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';
import type { Giveaway } from '@expyrico/shared';

const mockGiveaway: Giveaway = {
  id: 'g-100',
  giverUserId: 'user-1',
  title: 'Fresh Strawberries',
  description: 'Sweet local strawberries, unopened container',
  locationText: 'South Market St',
  country: 'VN',
  status: 'open',
  photoUrl: 'https://cdn.expyrico.app/giveaways/strawberries-1.webp',
  photoUrls: [
    'https://cdn.expyrico.app/giveaways/strawberries-1.webp',
    'https://cdn.expyrico.app/giveaways/strawberries-2.webp',
  ],
  claimCount: 3,
  claimExpiresAt: '2026-08-30T12:00:00.000Z',
  createdAt: '2026-08-26T08:00:00.000Z',
  updatedAt: '2026-08-26T08:00:00.000Z',
  giver: {
    id: 'user-1',
    firstName: 'Elena',
    avatarUrl: null,
    giverRatingAvg: 5.0,
    transactionCount: 8,
  },
};

const mockCancel = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../src/api/giveaways', () => ({
  useGiveaway: () => ({ data: mockGiveaway, isLoading: false, refetch: jest.fn() }),
  useCancelGiveaway: () => ({ mutateAsync: mockCancel, isPending: false }),
  useConfirmReceived: () => ({ mutate: jest.fn(), isPending: false }),
  useHandOffGiveaway: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateGiveaway: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useClaimGiveaway: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('../src/api/reputation', () => ({
  useReputation: () => ({
    data: { giverRatingAvg: 5.0, recipientRatingAvg: 4.8, transactionCount: 8 },
  }),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useRoute: () => ({ params: { id: 'g-100' } }),
    useNavigation: () => ({
      navigate: jest.fn(),
      push: jest.fn(),
      goBack: jest.fn(),
    }),
  };
});

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <NavigationContainer>{node}</NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe('GiveawayDetailScreen', () => {
  it('renders gallery, title card, bento stat cards, giver profile, details, and action toolbar', () => {
    const { getByText, getAllByText } = render(wrap(<GiveawayDetailScreen />));

    expect(getByText('GIVEAWAY')).toBeTruthy();
    expect(getByText('Fresh Strawberries')).toBeTruthy();
    expect(getAllByText(/South Market St/).length).toBeGreaterThanOrEqual(1);
    expect(getByText('1/2')).toBeTruthy(); // Shopee-style Gallery counter
    expect(getByText('STATUS')).toBeTruthy();
    expect(getByText('REQUESTS')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('Elena')).toBeTruthy();
    expect(getByText('Giveaway Information')).toBeTruthy();
    expect(getByText('Sweet local strawberries, unopened container')).toBeTruthy();
  });

  it('opens fullscreen photo gallery when hero photo is tapped', () => {
    const { getByLabelText, getByText, getAllByText } = render(wrap(<GiveawayDetailScreen />));

    const heroPhoto = getByLabelText('View photo 1 of 2 full screen');
    fireEvent.press(heroPhoto);

    expect(getAllByText('Fresh Strawberries').length).toBeGreaterThanOrEqual(1);
    expect(getByText('1 / 2')).toBeTruthy();
  });
});
