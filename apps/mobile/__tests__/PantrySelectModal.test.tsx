// apps/mobile/__tests__/PantrySelectModal.test.tsx
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PantrySelectModal } from '../src/features/giveaways/PantrySelectModal';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import type { LocalRecord } from '../src/api/records';

const mockRecords: LocalRecord[] = [
  {
    id: 'rec-1',
    serverId: 'srv-1',
    clientId: 'cli-1',
    productId: 'prod-1',
    customName: 'Organic Soy Milk',
    category: 'Dairy & Alternatives',
    expiryDate: '2026-10-20',
    quantity: 3,
    unit: 'cartons',
    price: 3.5,
    store: 'Whole Foods',
    notes: 'Unopened cartons',
    photoUrl: 'https://cdn.expyrico.app/records/milk.webp',
    status: 'active',
    notifyAt: [],
    householdId: null,
  },
  {
    id: 'rec-2',
    serverId: 'srv-2',
    clientId: 'cli-2',
    productId: null,
    customName: 'Canned Sweet Corn',
    category: 'Canned Goods',
    expiryDate: '2026-12-31',
    quantity: 5,
    unit: 'cans',
    price: 1.2,
    store: 'Target',
    notes: 'Stored in cool pantry',
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: 'house-1',
  },
];

let mockActiveRecords = mockRecords;

jest.mock('../src/api/records', () => ({
  useActiveRecords: () => mockActiveRecords,
  useAllActiveRecords: () => mockActiveRecords,
}));

jest.mock('../src/api/products', () => ({
  useProduct: () => ({ data: null }),
}));

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('PantrySelectModal', () => {
  beforeEach(() => {
    mockActiveRecords = mockRecords;
  });

  it('renders pantry items with title, quantity, and expiration info', () => {
    const onSelectRecord = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByTestId } = render(
      wrap(
        <PantrySelectModal
          visible={true}
          onClose={onClose}
          onSelectRecord={onSelectRecord}
        />,
      ),
    );

    expect(getByText('Select from Pantry')).toBeTruthy();
    expect(getByText('Organic Soy Milk')).toBeTruthy();
    expect(getByText('3 cartons')).toBeTruthy();
    expect(getByText('Canned Sweet Corn')).toBeTruthy();
    expect(getByText('5 cans')).toBeTruthy();
    expect(getByText('Household')).toBeTruthy();
    expect(getByTestId('pantry-select-item-rec-1')).toBeTruthy();
  });

  it('filters items in real-time based on search input', () => {
    const onSelectRecord = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, queryByText, getByText } = render(
      wrap(
        <PantrySelectModal
          visible={true}
          onClose={onClose}
          onSelectRecord={onSelectRecord}
        />,
      ),
    );

    const searchInput = getByTestId('pantry-select-search-input');
    fireEvent.changeText(searchInput, 'Soy');

    expect(getByText('Organic Soy Milk')).toBeTruthy();
    expect(queryByText('Canned Sweet Corn')).toBeNull();
  });

  it('calls onSelectRecord and onClose when an item is selected', () => {
    const onSelectRecord = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      wrap(
        <PantrySelectModal
          visible={true}
          onClose={onClose}
          onSelectRecord={onSelectRecord}
        />,
      ),
    );

    fireEvent.press(getByTestId('pantry-select-item-rec-1'));

    expect(onSelectRecord).toHaveBeenCalledTimes(1);
    expect(onSelectRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rec-1',
        customName: 'Organic Soy Milk',
        quantity: 3,
        unit: 'cartons',
      }),
      null,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
