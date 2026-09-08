import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PantryGridCard } from './PantryGridCard';
import type { LocalRecord } from '../../api/records';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePantryScope } from '../../store/pantryScope';

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

describe('PantryGridCard', () => {
  beforeEach(() => {
    usePantryScope.getState().setScope('all', null);
    jest.clearAllMocks();
  });

  it('renders record item name, quantity, category, and expiry date', () => {
    const onPress = jest.fn();
    const { getByText, getAllByText, getByTestId, queryByText } = renderWithProviders(
      <PantryGridCard record={mockRecord} onPress={onPress} />,
    );

    expect(getAllByText('Organic Eggs').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Dairy & Eggs')).toBeTruthy();
    expect(getByText(/Expires/)).toBeTruthy();
    expect(getByTestId('pantry-grid-card-rec-1')).toBeTruthy();
    expect(getByTestId('record-card-rec-1')).toBeTruthy();

    // Privacy check: should NOT render notes or price
    expect(queryByText('Pasture raised secret note')).toBeNull();
    expect(queryByText('4.5')).toBeNull();
  });

  it('calls onPress when tapped in normal mode', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <PantryGridCard record={mockRecord} onPress={onPress} />,
    );

    fireEvent.press(getByTestId('record-card-rec-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onLongPress when long-pressed in normal mode', () => {
    const onLongPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <PantryGridCard record={mockRecord} onPress={jest.fn()} onLongPress={onLongPress} />,
    );

    fireEvent(getByTestId('record-card-rec-1'), 'longPress');
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('renders selection checkbox and calls onToggleSelect when in selectionMode', () => {
    const onToggleSelect = jest.fn();
    const onPress = jest.fn();
    const onLongPress = jest.fn();

    const { getByTestId } = renderWithProviders(
      <PantryGridCard
        record={mockRecord}
        onPress={onPress}
        onLongPress={onLongPress}
        selectionMode={true}
        isSelected={false}
        onToggleSelect={onToggleSelect}
      />,
    );

    expect(getByTestId('record-select-checkbox-rec-1')).toBeTruthy();

    // Single press in selection mode calls onToggleSelect, NOT onPress
    fireEvent.press(getByTestId('record-card-rec-1'));
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    // Long press in selection mode is guarded and does NOT call onLongPress
    fireEvent(getByTestId('record-card-rec-1'), 'longPress');
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('renders household badge when item belongs to a household and scope is all', () => {
    const householdRecord: LocalRecord = {
      ...mockRecord,
      householdId: 'hh-1',
    };

    const { getByTestId, getByText } = renderWithProviders(
      <PantryGridCard
        record={householdRecord}
        householdName="Smith Family"
        onPress={jest.fn()}
      />,
    );

    expect(getByTestId('record-household-badge-rec-1')).toBeTruthy();
    expect(getByText('Smith Family')).toBeTruthy();
  });

  it('falls back to Shared when household item has no cached household name', () => {
    const householdRecord: LocalRecord = {
      ...mockRecord,
      householdId: 'hh-1',
    };

    const { getByTestId, getAllByText } = renderWithProviders(
      <PantryGridCard
        record={householdRecord}
        householdName={null}
        onPress={jest.fn()}
      />,
    );

    expect(getByTestId('record-household-badge-rec-1')).toBeTruthy();
    expect(getAllByText('Shared').length).toBeGreaterThanOrEqual(1);
  });

  it('renders personal badge when item is personal and scope is all', () => {
    const { getByTestId, getByText } = renderWithProviders(
      <PantryGridCard record={mockRecord} onPress={jest.fn()} />,
    );

    expect(getByTestId('record-personal-badge-rec-1')).toBeTruthy();
    expect(getByText('Personal')).toBeTruthy();
  });

  it('renders 3-dots action button in normal mode and triggers onOpenDrawer on tap', () => {
    const onOpenDrawer = jest.fn();
    const onPress = jest.fn();
    const { getByTestId } = renderWithProviders(
      <PantryGridCard
        record={mockRecord}
        onPress={onPress}
        onOpenDrawer={onOpenDrawer}
      />,
    );

    const moreBtn = getByTestId('record-open-actions-rec-1');
    expect(moreBtn).toBeTruthy();

    fireEvent.press(moreBtn);
    expect(onOpenDrawer).toHaveBeenCalledTimes(1);
    // Ensures 3-dots tap does NOT navigate to record detail
    expect(onPress).not.toHaveBeenCalled();
  });

  it('hides 3-dots action button when selectionMode is active', () => {
    const { queryByTestId } = renderWithProviders(
      <PantryGridCard
        record={mockRecord}
        onPress={jest.fn()}
        selectionMode={true}
      />,
    );

    expect(queryByTestId('record-open-actions-rec-1')).toBeNull();
  });

  it('hides action drawer from accessibility tree when isDrawerOpen is false', () => {
    const { queryByTestId } = renderWithProviders(
      <PantryGridCard
        record={mockRecord}
        onPress={jest.fn()}
        isDrawerOpen={false}
      />,
    );

    expect(queryByTestId('record-duplicate-rec-1')).toBeNull();
    expect(queryByTestId('record-delete-rec-1')).toBeNull();
  });

  it('invokes onDuplicate when duplicate action is tapped while drawer is open', () => {
    const onDuplicate = jest.fn();
    const { getByTestId } = renderWithProviders(
      <PantryGridCard
        record={mockRecord}
        onPress={jest.fn()}
        onDuplicate={onDuplicate}
        isDrawerOpen={true}
      />,
    );

    fireEvent.press(getByTestId('record-duplicate-rec-1'));
    expect(onDuplicate).toHaveBeenCalledWith(mockRecord);
  });

  it('invokes onEdit when edit action is tapped while drawer is open', () => {
    const onEdit = jest.fn();
    const { getByTestId } = renderWithProviders(
      <PantryGridCard
        record={mockRecord}
        onPress={jest.fn()}
        onEdit={onEdit}
        isDrawerOpen={true}
      />,
    );

    fireEvent.press(getByTestId('record-edit-rec-1'));
    expect(onEdit).toHaveBeenCalledWith(mockRecord);
  });

  it('invokes onDelete when delete action is tapped while drawer is open', () => {
    const onDelete = jest.fn();
    const { getByTestId } = renderWithProviders(
      <PantryGridCard
        record={mockRecord}
        onPress={jest.fn()}
        onDelete={onDelete}
        isDrawerOpen={true}
      />,
    );

    fireEvent.press(getByTestId('record-delete-rec-1'));
    expect(onDelete).toHaveBeenCalledWith(mockRecord, 'Organic Eggs');
  });

  it('respects creator permission gate: non-creators for household items cannot delete', () => {
    const householdRecord: LocalRecord = {
      ...mockRecord,
      householdId: 'hh-1',
      userId: 'other-user-999',
    };

    const { queryByTestId } = renderWithProviders(
      <PantryGridCard
        record={householdRecord}
        onPress={jest.fn()}
        isDrawerOpen={true}
      />,
    );

    expect(queryByTestId('record-delete-rec-1')).toBeNull();
  });
});
