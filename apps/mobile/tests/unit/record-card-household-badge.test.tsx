import React from 'react';
import { screen } from '@testing-library/react-native';
import { RecordCard } from '../../src/features/records/RecordCard';
import { usePantryScope } from '../../src/store/pantryScope';
import { renderWithTheme } from '../helpers/renderWithTheme';
import type { LocalRecord } from '../../src/api/records';

const baseRecord: LocalRecord = {
  id: 'rec-test-1',
  serverId: 'srv-1',
  clientId: 'cli-1',
  productId: null,
  customName: 'Oat Milk',
  category: 'Dairy & Alternatives',
  expiryDate: '2026-12-31',
  quantity: 2,
  unit: 'cartons',
  price: 3.5,
  store: "Trader Joe's",
  notes: 'Organic',
  photoUrl: null,
  status: 'active',
  notifyAt: [],
  householdId: null,
};

describe('RecordCard Household Attribution Badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePantryScope.getState().setScope('all', null);
  });

  it('renders attribution badge with household name when item belongs to household in "all" mode', () => {
    const record = { ...baseRecord, householdId: 'hh-1' };
    renderWithTheme(
      <RecordCard
        record={record}
        householdName="Family Pantry"
        onPress={jest.fn()}
      />,
      'expyrico',
    );

    const badge = screen.getByTestId('record-household-badge-rec-test-1');
    expect(badge).toBeTruthy();
    expect(screen.getByText('Family Pantry')).toBeTruthy();
  });

  it('renders fallback "Shared" when householdName is null or omitted', () => {
    const record = { ...baseRecord, householdId: 'hh-1' };
    renderWithTheme(
      <RecordCard
        record={record}
        householdName={null}
        onPress={jest.fn()}
      />,
      'expyrico',
    );

    expect(screen.getByTestId('record-household-badge-rec-test-1')).toBeTruthy();
    expect(screen.getByText('Shared')).toBeTruthy();
  });

  it('does not render attribution badge for personal items (householdId is null)', () => {
    const record = { ...baseRecord, householdId: null };
    renderWithTheme(
      <RecordCard
        record={record}
        householdName="Family Pantry"
        onPress={jest.fn()}
      />,
      'expyrico',
    );

    expect(screen.queryByTestId('record-household-badge-rec-test-1')).toBeNull();
  });

  it('does not render attribution badge when scope is "personal" or "household"', () => {
    const record = { ...baseRecord, householdId: 'hh-1' };

    // Set scope to household
    usePantryScope.getState().setScope('household', 'hh-1');
    const { unmount } = renderWithTheme(
      <RecordCard
        record={record}
        householdName="Family Pantry"
        onPress={jest.fn()}
      />,
      'expyrico',
    );
    expect(screen.queryByTestId('record-household-badge-rec-test-1')).toBeNull();
    unmount();

    // Set scope to personal
    usePantryScope.getState().setScope('personal', null);
    renderWithTheme(
      <RecordCard
        record={record}
        householdName="Family Pantry"
        onPress={jest.fn()}
      />,
      'expyrico',
    );
    expect(screen.queryByTestId('record-household-badge-rec-test-1')).toBeNull();
  });

  it('includes household attribution in the accessibility label', () => {
    const record = { ...baseRecord, householdId: 'hh-1' };
    renderWithTheme(
      <RecordCard
        record={record}
        householdName="Family Pantry"
        onPress={jest.fn()}
      />,
      'expyrico',
    );

    const card = screen.getByTestId('record-card-rec-test-1');
    expect(card.props.accessibilityLabel).toContain('Shared in Family Pantry');
  });
});
