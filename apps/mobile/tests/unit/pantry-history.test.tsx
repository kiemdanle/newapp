// apps/mobile/tests/unit/pantry-history.test.tsx
import React from 'react';
import { fireEvent, act } from '@testing-library/react-native';
import PantryHistoryScreen from '../../app/(app)/pantry/history';
import {
  usePantryHistoryRecords,
  restoreLocalRecord,
  type LocalRecord,
} from '../../src/api/records';
import { renderWithTheme } from '../helpers/renderWithTheme';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
    }),
  };
});

jest.mock('../../src/api/records', () => ({
  usePantryHistoryRecords: jest.fn(),
  restoreLocalRecord: jest.fn().mockResolvedValue({
    restoredRecordId: 'rec-1',
    wasReassignedToPersonal: false,
    mergedBackToParent: false,
  }),
}));

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({
    data: { items: [{ id: 'hh-1', name: 'Apartment 4B' }] },
  }),
}));

jest.mock('../../src/api/products', () => ({
  useProduct: () => ({ data: null }),
}));

const mockRecords: LocalRecord[] = [
  {
    id: 'rec-used-1',
    serverId: 's-1',
    clientId: 'c-1',
    productId: null,
    customName: 'Almond Milk',
    category: 'Dairy',
    expiryDate: '2026-09-02',
    quantity: 1,
    unit: 'carton',
    price: 3.99,
    store: 'Trader Joe',
    notes: null,
    photoUrl: null,
    status: 'consumed',
    notifyAt: [],
    householdId: 'hh-1',
    userId: 'u-1',
    consumedAt: '2026-09-01T12:00:00.000Z',
    discardedAt: null,
    discardReason: null,
  },
  {
    id: 'rec-discarded-1',
    serverId: 's-2',
    clientId: 'c-2',
    productId: null,
    customName: 'Spinach',
    category: 'Produce',
    expiryDate: '2026-08-30',
    quantity: 1,
    unit: 'bag',
    price: 2.5,
    store: 'Safeway',
    notes: null,
    photoUrl: null,
    status: 'discarded',
    notifyAt: [],
    householdId: 'hh-1',
    userId: 'u-1',
    consumedAt: null,
    discardedAt: '2026-09-02T10:00:00.000Z',
    discardReason: 'spoiled',
  },
];

describe('PantryHistoryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePantryHistoryRecords as jest.Mock).mockImplementation((filter?: string) => {
      if (filter === 'consumed') {
        return mockRecords.filter((r) => r.status === 'consumed');
      }
      if (filter === 'discarded') {
        return mockRecords.filter((r) => r.status === 'discarded');
      }
      return mockRecords;
    });
  });

  it('renders history screen with header and KPI stats', () => {
    const { getByText, getAllByText, getByTestId } = renderWithTheme(<PantryHistoryScreen />, 'expyrico');

    expect(getByText('Pantry History')).toBeTruthy();
    expect(getByTestId('pantry-history-back-btn')).toBeTruthy();

    // Filters
    expect(getByTestId('history-filter-all')).toBeTruthy();
    expect(getByTestId('history-filter-used')).toBeTruthy();
    expect(getByTestId('history-filter-discarded')).toBeTruthy();

    // KPI Summary
    expect(getAllByText(/1 item/i).length).toBe(2);
    expect(getByText(/50% consumption rate/i)).toBeTruthy();
    expect(getByText(/50% waste rate/i)).toBeTruthy();
    // Items rendered
    expect(getByText('Almond Milk')).toBeTruthy();
    expect(getByText('Spinach')).toBeTruthy();
    expect(getByText('Spoiled')).toBeTruthy();
  });

  it('switches filter between All, Used, and Discarded', () => {
    const { getByTestId } = renderWithTheme(<PantryHistoryScreen />, 'expyrico');

    // Tap Used filter
    fireEvent.press(getByTestId('history-filter-used'));
    expect(usePantryHistoryRecords).toHaveBeenCalledWith('consumed');

    // Tap Discarded filter
    fireEvent.press(getByTestId('history-filter-discarded'));
    expect(usePantryHistoryRecords).toHaveBeenCalledWith('discarded');

    // Tap All filter
    fireEvent.press(getByTestId('history-filter-all'));
    expect(usePantryHistoryRecords).toHaveBeenCalledWith('all');
  });

  it('tapping Restore to Pantry calls restoreLocalRecord with household IDs', async () => {
    const { getByTestId } = renderWithTheme(<PantryHistoryScreen />, 'expyrico');

    const restoreBtn = getByTestId('history-restore-rec-used-1');
    await act(async () => {
      fireEvent.press(restoreBtn);
    });

    expect(restoreLocalRecord).toHaveBeenCalledWith('rec-used-1', ['hh-1']);
  });

  it('tapping back button calls navigation.goBack()', () => {
    const { getByTestId } = renderWithTheme(<PantryHistoryScreen />, 'expyrico');

    fireEvent.press(getByTestId('pantry-history-back-btn'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('renders empty state when there are no records for a filter', () => {
    (usePantryHistoryRecords as jest.Mock).mockReturnValue([]);

    const { getByText } = renderWithTheme(<PantryHistoryScreen />, 'expyrico');
    expect(getByText('Pantry history is empty')).toBeTruthy();
  });
});
