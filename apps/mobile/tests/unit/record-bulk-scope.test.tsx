import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { RecordCard } from '../../src/features/records/RecordCard';
import { BulkScopeModal } from '../../src/features/records/BulkScopeModal';
import * as recordsApi from '../../src/api/records';
import * as householdsApi from '../../src/api/households';
import type { LocalRecord } from '../../src/api/records';
import type { Household } from '@expyrico/shared';

jest.mock('../../src/api/records', () => {
  const actual = jest.requireActual('../../src/api/records');
  return {
    ...actual,
    bulkPatchLocalRecordScope: jest.fn(),
  };
});

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: jest.fn(),
}));

const mockHouseholds: Household[] = [
  {
    id: 'hh-1',
    name: 'Family Kitchen',
    ownerUserId: 'u-1',
    myRole: 'owner',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'hh-2',
    name: 'Beach House',
    ownerUserId: 'u-1',
    myRole: 'member',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const mockRecords: LocalRecord[] = [
  {
    id: 'rec-1',
    serverId: 'srv-1',
    clientId: 'cli-1',
    productId: null,
    customName: 'Apples',
    category: 'Fruit',
    expiryDate: '2026-09-10',
    quantity: 3,
    unit: 'pcs',
    price: 3.0,
    store: 'Supermarket',
    notes: null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: null,
  },
  {
    id: 'rec-2',
    serverId: 'srv-2',
    clientId: 'cli-2',
    productId: null,
    customName: 'Milk',
    category: 'Dairy',
    expiryDate: '2026-09-08',
    quantity: 1,
    unit: 'bottle',
    price: 2.5,
    store: 'Market',
    notes: null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: null,
  },
  {
    id: 'rec-3',
    serverId: 'srv-3',
    clientId: 'cli-3',
    productId: null,
    customName: 'Shared Butter',
    category: 'Dairy',
    expiryDate: '2026-09-15',
    quantity: 1,
    unit: 'pack',
    price: 4.0,
    store: 'Market',
    notes: null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: 'hh-1',
  },
];

describe('RecordCard Multi-Select & Long-Press', () => {
  it('calls onLongPress when card is long-pressed outside selection mode', () => {
    const handleLongPress = jest.fn();
    const handlePress = jest.fn();

    const { getByTestId } = renderWithTheme(
      <RecordCard
        record={mockRecords[0]!}
        onPress={handlePress}
        onLongPress={handleLongPress}
        selectionMode={false}
      />,
      'expyrico',
    );

    const card = getByTestId('record-card-rec-1');
    fireEvent(card, 'longPress');

    expect(handleLongPress).toHaveBeenCalledTimes(1);
    expect(handlePress).not.toHaveBeenCalled();
  });

  it('renders selection checkbox and calls onToggleSelect when in selection mode', () => {
    const handleToggleSelect = jest.fn();
    const handlePress = jest.fn();

    const { getByTestId } = renderWithTheme(
      <RecordCard
        record={mockRecords[0]!}
        onPress={handlePress}
        onToggleSelect={handleToggleSelect}
        selectionMode={true}
        isSelected={true}
      />,
      'expyrico',
    );

    expect(getByTestId('record-select-checkbox-rec-1')).toBeTruthy();

    const card = getByTestId('record-card-rec-1');
    fireEvent.press(card);

    expect(handleToggleSelect).toHaveBeenCalledTimes(1);
    expect(handlePress).not.toHaveBeenCalled();
  });
});

describe('BulkScopeModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (householdsApi.useMyHouseholds as jest.Mock).mockReturnValue({
      data: { items: mockHouseholds },
    });
  });

  it('renders Personal Pantry and all households as destinations', () => {
    const { getByText, getByTestId } = renderWithTheme(
      <BulkScopeModal
        visible={true}
        onClose={jest.fn()}
        selectedRecordIds={['rec-1', 'rec-2']}
        records={mockRecords}
      />,
      'expyrico',
    );

    expect(getByText('Move 2 items')).toBeTruthy();
    expect(getByTestId('bulk-scope-dest-personal')).toBeTruthy();
    expect(getByTestId('bulk-scope-dest-hh-1')).toBeTruthy();
    expect(getByTestId('bulk-scope-dest-hh-2')).toBeTruthy();
  });

  it('indicates current scope when all selected items share the same scope', () => {
    const { getByText } = renderWithTheme(
      <BulkScopeModal
        visible={true}
        onClose={jest.fn()}
        selectedRecordIds={['rec-1', 'rec-2']} // both have householdId: null
        records={mockRecords}
      />,
      'expyrico',
    );

    expect(getByText('Current')).toBeTruthy();
  });

  it('calls bulkPatchLocalRecordScope and invokes onSuccess upon destination selection', async () => {
    const handleClose = jest.fn();
    const handleSuccess = jest.fn();
    (recordsApi.bulkPatchLocalRecordScope as jest.Mock).mockResolvedValue({
      updatedCount: 2,
      recordIds: ['srv-1', 'srv-2'],
    });

    const { getByTestId } = renderWithTheme(
      <BulkScopeModal
        visible={true}
        onClose={handleClose}
        selectedRecordIds={['rec-1', 'rec-2']}
        records={mockRecords}
        onSuccess={handleSuccess}
      />,
      'expyrico',
    );

    const targetHh = getByTestId('bulk-scope-dest-hh-1');
    await act(async () => {
      fireEvent.press(targetHh);
    });

    expect(recordsApi.bulkPatchLocalRecordScope).toHaveBeenCalledWith(
      ['rec-1', 'rec-2'],
      'hh-1',
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(handleSuccess).toHaveBeenCalledWith(2, 'Family Kitchen');
  });

  it('shows Network Required alert if bulk move fails due to offline error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (recordsApi.bulkPatchLocalRecordScope as jest.Mock).mockRejectedValue(
      new Error('Network request failed'),
    );

    const { getByTestId } = renderWithTheme(
      <BulkScopeModal
        visible={true}
        onClose={jest.fn()}
        selectedRecordIds={['rec-1']}
        records={mockRecords}
      />,
      'expyrico',
    );
    const targetHh = getByTestId('bulk-scope-dest-hh-1');
    await act(async () => {
      fireEvent.press(targetHh);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Network Required',
      'Internet connection required to move pantry items.',
    );
  });
});
