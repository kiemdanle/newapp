import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DealDetailScreen from '../../app/(app)/deal/[id]';
import { useDeal, useDeleteDeal } from '../../src/api/deals';
import { renderWithTheme } from '../helpers/renderWithTheme';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../src/api/deals', () => ({
  useDeal: jest.fn(),
  useDeleteDeal: jest.fn(),
}));

jest.mock('../../src/features/deals/useOptimisticDealVote', () => ({
  useOptimisticDealVote: jest.fn(() => ({
    mutate: jest.fn(),
  })),
}));

jest.mock('../../src/auth/session-store', () => ({
  useSessionStore: jest.fn((selector) =>
    selector({
      user: { id: 'user-123', country: 'US' },
    }),
  ),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

describe('DealDetailScreen Navigation and Error States', () => {
  const mockGoBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigation as jest.Mock).mockReturnValue({
      goBack: mockGoBack,
      push: jest.fn(),
      navigate: jest.fn(),
    });
    (useRoute as jest.Mock).mockReturnValue({
      params: { id: 'deal-1' },
    });
    (useDeleteDeal as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
    });
  });

  it('renders loading state when deal is loading', () => {
    (useDeal as jest.Mock).mockReturnValue({
      data: null,
      isLoading: true,
    });

    const { getByText } = renderWithTheme(<DealDetailScreen />, 'expyrico');
    expect(getByText('Loading deal details…')).toBeTruthy();
  });

  it('renders "Deal not found" with a "Go back" button when deal does not exist', () => {
    (useDeal as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
    });

    const { getByText } = renderWithTheme(<DealDetailScreen />, 'expyrico');
    expect(getByText('Deal not found')).toBeTruthy();
    expect(getByText('This deal may have expired or been removed.')).toBeTruthy();

    const goBackBtn = getByText('Go back');
    expect(goBackBtn).toBeTruthy();
    fireEvent.press(goBackBtn);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders full deal details and interactive buttons when deal is loaded', () => {
    (useDeal as jest.Mock).mockReturnValue({
      data: {
        id: 'deal-1',
        userId: 'user-other',
        price: 3.99,
        currency: 'USD',
        storeName: 'Trader Joe\'s',
        photoUrl: null,
        product: {
          id: 'prod-1',
          name: 'Organic Whole Milk',
          brand: 'Clover',
          imageUrl: null,
        },
        expiryDate: '2026-10-01',
        note: 'Buy one get one free',
        author: { firstName: 'Sarah' },
        upvoteCount: 5,
        downvoteCount: 1,
        myVote: 0,
      },
      isLoading: false,
    });

    const { getByText } = renderWithTheme(<DealDetailScreen />, 'expyrico');
    expect(getByText('Organic Whole Milk')).toBeTruthy();
    expect(getByText('Clover')).toBeTruthy();
    expect(getByText('🏪 Trader Joe\'s')).toBeTruthy();
    expect(getByText('Posted by Sarah')).toBeTruthy();
    expect(getByText('Share this deal')).toBeTruthy();
    expect(getByText('Report deal')).toBeTruthy();
  });
});
