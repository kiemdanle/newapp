import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PantryGridActionDrawer } from './PantryGridActionDrawer';
import type { LocalRecord } from '../../api/records';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRecord: LocalRecord = {
  id: 'rec-drawer-1',
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
  notes: 'Pasture raised secret note',
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

describe('PantryGridActionDrawer', () => {
  it('renders product title and close button in header', () => {
    const onClose = jest.fn();
    const { getByText, getByTestId } = renderWithProviders(
      <PantryGridActionDrawer record={mockRecord} onClose={onClose} />,
    );

    expect(getByText('Organic Eggs')).toBeTruthy();
    const closeBtn = getByTestId('record-close-actions-rec-drawer-1');
    expect(closeBtn).toBeTruthy();

    fireEvent.press(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders all 3 floating action circles and invokes callbacks on tap', () => {
    const onDuplicate = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = renderWithProviders(
      <PantryGridActionDrawer
        record={mockRecord}
        onDuplicate={onDuplicate}
        onEdit={onEdit}
        onDelete={onDelete}
        onClose={onClose}
      />,
    );

    expect(getByText('Edit')).toBeTruthy();
    expect(getByText('Duplicate')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();

    const editBtn = getByTestId('record-edit-rec-drawer-1');
    const duplicateBtn = getByTestId('record-duplicate-rec-drawer-1');
    const deleteBtn = getByTestId('record-delete-rec-drawer-1');

    fireEvent.press(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockRecord);

    fireEvent.press(duplicateBtn);
    expect(onDuplicate).toHaveBeenCalledWith(mockRecord);

    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(mockRecord);
  });

  it('respects canDelete=false by hiding or locking the delete action circle', () => {
    const onDelete = jest.fn();
    const { queryByTestId, getByText } = renderWithProviders(
      <PantryGridActionDrawer
        record={mockRecord}
        onDelete={onDelete}
        onClose={jest.fn()}
        canDelete={false}
      />,
    );

    expect(queryByTestId('record-delete-rec-drawer-1')).toBeNull();
    expect(getByText('Shared')).toBeTruthy();
  });

  it('disables action triggers when isProcessing is true to prevent duplicate mutations', () => {
    const onDuplicate = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    const { getByTestId } = renderWithProviders(
      <PantryGridActionDrawer
        record={mockRecord}
        onDuplicate={onDuplicate}
        onEdit={onEdit}
        onDelete={onDelete}
        onClose={jest.fn()}
        isProcessing={true}
      />,
    );

    fireEvent.press(getByTestId('record-duplicate-rec-drawer-1'));
    expect(onDuplicate).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('record-edit-rec-drawer-1'));
    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('record-delete-rec-drawer-1'));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
