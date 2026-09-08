import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RecordCard } from './RecordCard';
import type { LocalRecord } from '../../api/records';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRecord: LocalRecord = {
  id: 'rec-1',
  serverId: 'srv-1',
  clientId: 'cli-1',
  productId: null,
  customName: 'Organic Eggs',
  category: 'Dairy & Eggs',
  expiryDate: '2026-12-31',
  quantity: 12,
  unit: 'pcs',
  price: 4.5,
  store: 'Trader Joe',
  notes: 'Pasture raised',
  photoUrl: null,
  status: 'active',
  notifyAt: [],
  householdId: null,
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('RecordCard with swipe actions', () => {
  it('renders record item name, quantity, and expiry date', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithProviders(
      <RecordCard record={mockRecord} onPress={onPress} />,
    );

    expect(getByText('Organic Eggs')).toBeTruthy();
    expect(getByText('12 pcs')).toBeTruthy();
    expect(getByText(/Expires/)).toBeTruthy();
  });

  it('triggers onDuplicate when the duplicate swipe action is pressed', () => {
    const onDuplicate = jest.fn();
    const { getByTestId, getByText } = renderWithProviders(
      <RecordCard record={mockRecord} onPress={jest.fn()} onDuplicate={onDuplicate} />,
    );

    const duplicateBtn = getByTestId('record-duplicate-rec-1');
    expect(duplicateBtn).toBeTruthy();
    expect(getByText('Duplicate')).toBeTruthy();
    fireEvent.press(duplicateBtn);
    expect(onDuplicate).toHaveBeenCalledWith(mockRecord);
  });

  it('triggers onEdit when the edit swipe action is pressed', () => {
    const onEdit = jest.fn();
    const { getByTestId } = renderWithProviders(
      <RecordCard record={mockRecord} onPress={jest.fn()} onEdit={onEdit} />,
    );

    const editBtn = getByTestId('record-edit-rec-1');
    expect(editBtn).toBeTruthy();
    fireEvent.press(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockRecord);
  });

  it('triggers onDelete when the delete swipe action is pressed', () => {
    const onDelete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <RecordCard record={mockRecord} onPress={jest.fn()} onDelete={onDelete} />,
    );

    const deleteBtn = getByTestId('record-delete-rec-1');
    expect(deleteBtn).toBeTruthy();
    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockRecord);
  });
});
