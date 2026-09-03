// apps/mobile/tests/unit/pantry-filter-modal.test.tsx
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { PantryFilterModal } from '../../src/features/records/PantryFilterModal';
import type { LocalRecord } from '../../src/api/records';
import { renderWithTheme } from '../helpers/renderWithTheme';
import * as householdsApi from '../../src/api/households';
import { usePantryScope } from '../../src/store/pantryScope';

function makeRecord(overrides: Partial<LocalRecord> = {}): LocalRecord {
  return {
    id: overrides.id ?? 'rec-1',
    serverId: null,
    clientId: 'client-1',
    productId: null,
    customName: overrides.customName ?? 'Milk',
    category: overrides.category ?? 'Dairy',
    expiryDate: overrides.expiryDate ?? '2026-09-01',
    quantity: overrides.quantity ?? 2,
    unit: 'pcs',
    price: null,
    store: null,
    notes: null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: overrides.householdId ?? null,
  };
}

describe('PantryFilterModal', () => {
  const sampleRecords: LocalRecord[] = [
    makeRecord({ id: 'rec-1', customName: 'Milk', category: 'Dairy', expiryDate: '2026-09-01', quantity: 2 }),
    makeRecord({ id: 'rec-2', customName: 'Bread', category: 'Bakery', expiryDate: '2026-09-05', quantity: 0 }),
    makeRecord({ id: 'rec-3', customName: 'Apple', category: 'Produce', expiryDate: '2026-09-10', quantity: 5 }),
  ];

  it('renders modal content when visible', () => {
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{}}
        onApply={jest.fn()}
        records={sampleRecords}
      />,
      'expyrico',
    );

    expect(screen.getByTestId('pantry-filter-modal')).toBeTruthy();
    expect(screen.getByText('Filter Pantry')).toBeTruthy();
    expect(screen.getByText('EXPIRY STATUS')).toBeTruthy();
    expect(screen.getByText('FOOD CATEGORY')).toBeTruthy();
    expect(screen.getByText('AVAILABILITY')).toBeTruthy();
  });

  it('allows selecting expiry status and updates match count', () => {
    const onApply = jest.fn();
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{ expiryStatus: 'all' }}
        onApply={onApply}
        records={sampleRecords}
      />,
      'expyrico',
    );

    // Tap "Expired"
    const expiredPill = screen.getByTestId('pantry-filter-expiry-expired');
    fireEvent.press(expiredPill);

    // Apply
    const applyBtn = screen.getByTestId('pantry-filter-apply-btn');
    fireEvent.press(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ expiryStatus: 'expired' }),
    );
  });

  it('allows toggling category chip', () => {
    const onApply = jest.fn();
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{}}
        onApply={onApply}
        records={sampleRecords}
      />,
      'expyrico',
    );

    // Tap "Dairy" category chip
    const dairyChip = screen.getByTestId('pantry-filter-cat-dairy');
    fireEvent.press(dairyChip);

    const applyBtn = screen.getByTestId('pantry-filter-apply-btn');
    fireEvent.press(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Dairy' }),
    );
  });

  it('allows toggling in-stock only switch', () => {
    const onApply = jest.fn();
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{ inStockOnly: false }}
        onApply={onApply}
        records={sampleRecords}
      />,
      'expyrico',
    );

    const toggle = screen.getByTestId('pantry-filter-instock-toggle');
    fireEvent(toggle, 'valueChange', true);

    const applyBtn = screen.getByTestId('pantry-filter-apply-btn');
    fireEvent.press(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ inStockOnly: true }),
    );
  });

  it('resets draft filters on Reset button press', () => {
    const onApply = jest.fn();
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{ category: 'Dairy', inStockOnly: true, expiryStatus: 'expired' }}
        onApply={onApply}
        records={sampleRecords}
      />,
      'expyrico',
    );

    const resetBtn = screen.getByTestId('pantry-filter-reset-btn');
    fireEvent.press(resetBtn);

    const applyBtn = screen.getByTestId('pantry-filter-apply-btn');
    fireEvent.press(applyBtn);

    expect(onApply).toHaveBeenCalledWith({
      query: undefined,
      category: undefined,
      expiryStatus: 'all',
      inStockOnly: false,
      householdScope: 'all',
      store: undefined,
    });
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={onClose}
        filters={{}}
        onApply={jest.fn()}
        records={sampleRecords}
      />,
      'expyrico',
    );

    const closeBtn = screen.getByLabelText('Close filters');
    fireEvent.press(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders INVENTORY SCOPE section when user belongs to households even if all records are personal', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: { items: [{ id: 'hh-1', name: 'Family Pantry', ownerUserId: 'u-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' }] },
      isLoading: false,
    } as any);

    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{}}
        onApply={jest.fn()}
        records={sampleRecords} // all sampleRecords have householdId: null
      />,
      'expyrico',
    );

    expect(screen.getByText('INVENTORY SCOPE')).toBeTruthy();
    expect(screen.getByTestId('pantry-filter-scope-all')).toBeTruthy();
    expect(screen.getByTestId('pantry-filter-scope-personal')).toBeTruthy();
    expect(screen.getByTestId('pantry-filter-scope-household')).toBeTruthy();
  });

  it('allows selecting household scope and passes it to onApply', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: { items: [{ id: 'hh-1', name: 'Family Pantry', ownerUserId: 'u-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' }] },
      isLoading: false,
    } as any);

    const onApply = jest.fn();
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{ householdScope: 'all' }}
        onApply={onApply}
        records={sampleRecords}
      />,
      'expyrico',
    );

    // Select household scope
    fireEvent.press(screen.getByTestId('pantry-filter-scope-household'));

    // Press Apply
    fireEvent.press(screen.getByTestId('pantry-filter-apply-btn'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ householdScope: 'household' }),
    );
  });
});
