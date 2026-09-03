import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { RecordLocationRow } from '../../app/(app)/record/[id]';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { AddRecordForm } from '../../src/features/records/AddRecordForm';
import { usePantryScope } from '../../src/store/pantryScope';
import { useSessionStore } from '../../src/auth/session-store';
import * as recordsApi from '../../src/api/records';
import * as householdsApi from '../../src/api/households';
import type { LocalRecord } from '../../src/api/records';
import type { Household } from '@expyrico/shared';
jest.mock('../../src/api/records', () => {
  const actual = jest.requireActual('../../src/api/records');
  return {
    ...actual,
    createLocalRecord: jest.fn().mockResolvedValue('new-rec-id'),
  };
});


const mockHouseholds: Household[] = [
  {
    id: 'hh-1',
    name: 'Family Pantry',
    ownerUserId: 'u-1',
    myRole: 'owner',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 'hh-2',
    name: 'Cabin Kitchen',
    ownerUserId: 'u-2',
    myRole: 'member',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

const baseRecord: LocalRecord = {
  id: 'rec-test-1',
  serverId: 'srv-1',
  clientId: 'cli-1',
  productId: null,
  customName: 'Sourdough Bread',
  category: 'Bakery',
  expiryDate: '2026-09-10',
  quantity: 1,
  unit: 'loaf',
  price: 5.0,
  store: 'Local Bakery',
  notes: null,
  photoUrl: null,
  status: 'active',
  notifyAt: [],
  householdId: null,
};

describe('RecordLocationRow Scope Reassignment', () => {
  it('displays "Personal Pantry" for items with householdId=null', () => {
    renderWithTheme(
      <RecordLocationRow
        record={baseRecord}
        households={mockHouseholds}
        onReassign={jest.fn()}
      />,
      'expyrico',
    );

    expect(screen.getByTestId('record-location-label')).toBeTruthy();
    expect(screen.getByText('Personal Pantry')).toBeTruthy();
  });

  it('displays household name when item belongs to a household', () => {
    const record = { ...baseRecord, householdId: 'hh-1' };
    renderWithTheme(
      <RecordLocationRow
        record={record}
        households={mockHouseholds}
        onReassign={jest.fn()}
      />,
      'expyrico',
    );

    expect(screen.getByTestId('record-location-label')).toBeTruthy();
    expect(screen.getByText('Family Pantry')).toBeTruthy();
  });

  it('disables trigger button when user belongs to 0 households', () => {
    renderWithTheme(
      <RecordLocationRow
        record={baseRecord}
        households={[]}
        onReassign={jest.fn()}
      />,
      'expyrico',
    );

    const btn = screen.getByTestId('record-reassign-scope-btn');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('opens modal and allows moving a personal item to a household', async () => {
    const onReassign = jest.fn().mockResolvedValue(undefined);
    renderWithTheme(
      <RecordLocationRow
        record={baseRecord}
        households={mockHouseholds}
        onReassign={onReassign}
      />,
      'expyrico',
    );

    // Open modal
    fireEvent.press(screen.getByTestId('record-reassign-scope-btn'));

    // Verify modal content
    expect(screen.getByText('Move Pantry Item')).toBeTruthy();
    expect(screen.getByTestId('reassign-option-personal')).toBeTruthy();
    expect(screen.getByTestId('reassign-option-hh-1')).toBeTruthy();
    expect(screen.getByTestId('reassign-option-hh-2')).toBeTruthy();

    // Select Family Pantry
    fireEvent.press(screen.getByTestId('reassign-option-hh-1'));
    expect(onReassign).toHaveBeenCalledWith('hh-1');
  });

  it('opens modal and allows moving a household item to personal pantry', async () => {
    const record = { ...baseRecord, householdId: 'hh-1' };
    const onReassign = jest.fn().mockResolvedValue(undefined);
    renderWithTheme(
      <RecordLocationRow
        record={record}
        households={mockHouseholds}
        onReassign={onReassign}
      />,
      'expyrico',
    );

    // Open modal
    fireEvent.press(screen.getByTestId('record-reassign-scope-btn'));

    // Select Personal Pantry option
    fireEvent.press(screen.getByTestId('reassign-option-personal'));
    expect(onReassign).toHaveBeenCalledWith(null);
  });

  it('hides the Personal Pantry option for non-owners of a shared record', () => {
    useSessionStore.setState({
      user: {
        id: 'user-me',
        email: 'me@example.com',
        emailVerified: true,
        role: 'user',
        country: 'US',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      } as any,
      hydrated: true,
    });

    // Record created by 'user-other'
    const record = { ...baseRecord, householdId: 'hh-1', userId: 'user-other' };
    renderWithTheme(
      <RecordLocationRow
        record={record}
        households={mockHouseholds}
        onReassign={jest.fn()}
      />,
      'expyrico',
    );

    // Open modal
    fireEvent.press(screen.getByTestId('record-reassign-scope-btn'));

    // Personal option must NOT be rendered for non-owner
    expect(screen.queryByTestId('reassign-option-personal')).toBeNull();
    // Household options remain available
    expect(screen.getByTestId('reassign-option-hh-1')).toBeTruthy();
  });

  it('closes modal when cancel is pressed', () => {
    renderWithTheme(
      <RecordLocationRow
        record={baseRecord}
        households={mockHouseholds}
        onReassign={jest.fn()}
      />,
      'expyrico',
    );

    // Open modal
    fireEvent.press(screen.getByTestId('record-reassign-scope-btn'));
    expect(screen.getByText('Move Pantry Item')).toBeTruthy();

    // Press cancel
    fireEvent.press(screen.getByTestId('reassign-modal-cancel'));
    expect(screen.queryByText('Move Pantry Item')).toBeNull();
  });
});

describe('AddRecordForm Creation Flow Scope Assignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (recordsApi.createLocalRecord as jest.Mock).mockClear();
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: { items: mockHouseholds },
      isLoading: false,
    } as any);
  });

  it('scanning or adding an item while in household scope assigns it to that household', async () => {
    usePantryScope.getState().setScope('household', 'hh-1');

    renderWithTheme(
      <AddRecordForm
        customName="Household Apples"
        onSaved={jest.fn()}
      />,
      'expyrico',
    );
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('add-record-expiry-input'), '2026-12-31');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-record-save'));
    });

    expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        customName: 'Household Apples',
        householdId: 'hh-1',
      }),
    );
  });

  it('adding an item while in "all" scope defaults to personal pantry (householdId: null)', async () => {
    usePantryScope.getState().setScope('all', null);

    renderWithTheme(
      <AddRecordForm
        customName="Personal Banana"
        onSaved={jest.fn()}
      />,
      'expyrico',
    );

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('add-record-expiry-input'), '2026-12-31');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-record-save'));
    });

    expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        customName: 'Personal Banana',
        householdId: null,
      }),
    );
  });

  it('forces personal scope (householdId: null) when lockedPersonalScope is true even in household scope', async () => {
    usePantryScope.getState().setScope('household', 'hh-1');

    renderWithTheme(
      <AddRecordForm
        customName="Private Draft Item"
        lockedPersonalScope={true}
        onSaved={jest.fn()}
      />,
      'expyrico',
    );

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('add-record-expiry-input'), '2026-12-31');
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-record-save'));
    });

    expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        customName: 'Private Draft Item',
        householdId: null,
      }),
    );
  });
});
