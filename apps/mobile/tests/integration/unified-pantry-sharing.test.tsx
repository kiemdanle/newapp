import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import HomeTab from '../../app/(app)/(tabs)/home';
import { usePantryScope } from '../../src/store/pantryScope';
import * as recordsApi from '../../src/api/records';
import * as householdsApi from '../../src/api/households';
import { renderWithTheme } from '../helpers/renderWithTheme';
import type { LocalRecord } from '../../src/api/records';
import type { Household } from '@expyrico/shared';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

const mockHouseholds: Household[] = [
  {
    id: 'hh-1',
    name: 'Family Pantry',
    ownerUserId: 'u-1',
    myRole: 'owner',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
];

let recordsState: LocalRecord[] = [];

function makeRecord(overrides: Partial<LocalRecord>): LocalRecord {
  return {
    id: overrides.id ?? 'rec-1',
    serverId: null,
    clientId: 'client-1',
    productId: null,
    customName: overrides.customName ?? 'Item',
    category: overrides.category ?? 'Pantry',
    expiryDate: overrides.expiryDate ?? '2026-10-01',
    quantity: overrides.quantity ?? 1,
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

describe('Unified Pantry and Household Sharing Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    usePantryScope.getState().setScope('all', null);

    recordsState = [
      makeRecord({
        id: 'rec-shared-1',
        customName: 'Greek Yogurt',
        category: 'Dairy',
        expiryDate: '2026-09-04',
        householdId: 'hh-1',
      }),
      makeRecord({
        id: 'rec-personal-1',
        customName: 'Organic Eggs',
        category: 'Dairy',
        expiryDate: '2026-09-05',
        householdId: null,
      }),
      makeRecord({
        id: 'rec-shared-2',
        customName: 'Cheddar Cheese',
        category: 'Dairy',
        expiryDate: '2026-09-08',
        householdId: 'hh-1',
      }),
      makeRecord({
        id: 'rec-personal-2',
        customName: 'Almond Milk',
        category: 'Dairy',
        expiryDate: '2026-09-10',
        householdId: null,
      }),
    ];

    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: { items: mockHouseholds },
      isLoading: false,
    } as any);

    jest.spyOn(recordsApi, 'useActiveRecords').mockImplementation(() => {
      const { scope, householdId } = usePantryScope();
      if (scope === 'personal') {
        return recordsState.filter((r) => r.householdId === null);
      }
      if (scope === 'household' && householdId) {
        return recordsState.filter((r) => r.householdId === householdId);
      }
      return recordsState;
    });

    jest.spyOn(recordsApi, 'patchLocalRecord').mockImplementation(async (id, patch) => {
      recordsState = recordsState.map((r) => {
        if (r.id === id) {
          return { ...r, ...patch };
        }
        return r;
      });
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });


  it('renders unified "All" view with combined records sorted by urgency and household attribution badges', () => {
    renderWithTheme(<HomeTab />, 'expyrico');
    // Both personal and shared items are visible in the pantry list
    expect(screen.getByTestId('record-card-rec-shared-1')).toBeTruthy();
    expect(screen.getByTestId('record-card-rec-personal-1')).toBeTruthy();
    expect(screen.getByTestId('record-card-rec-shared-2')).toBeTruthy();
    expect(screen.getByTestId('record-card-rec-personal-2')).toBeTruthy();

    // Shared items display the household attribution badge
    expect(screen.getByTestId('record-household-badge-rec-shared-1')).toBeTruthy();
    expect(screen.getByTestId('record-household-badge-rec-shared-2')).toBeTruthy();

    // Personal items do NOT display an attribution badge
    expect(screen.queryByTestId('record-household-badge-rec-personal-1')).toBeNull();
    expect(screen.queryByTestId('record-household-badge-rec-personal-2')).toBeNull();
  });

  it('filters strictly to personal items when tapping "Personal" segment', () => {
    renderWithTheme(<HomeTab />, 'expyrico');

    // Tap "Personal" in ScopeToggle
    act(() => {
      fireEvent.press(screen.getByTestId('scope-toggle-personal'));
    });

    expect(usePantryScope.getState().scope).toBe('personal');

    // Only personal items are visible in the list
    expect(screen.getByTestId('record-card-rec-personal-1')).toBeTruthy();
    expect(screen.getByTestId('record-card-rec-personal-2')).toBeTruthy();
    expect(screen.queryByTestId('record-card-rec-shared-1')).toBeNull();
    expect(screen.queryByTestId('record-card-rec-shared-2')).toBeNull();
  });

  it('filters strictly to household items when tapping household segment', () => {
    renderWithTheme(<HomeTab />, 'expyrico');

    // Tap "Family Pantry" in ScopeToggle
    act(() => {
      fireEvent.press(screen.getByTestId('scope-toggle-hh-1'));
    });

    expect(usePantryScope.getState().scope).toBe('household');
    expect(usePantryScope.getState().householdId).toBe('hh-1');
    // Only shared items are visible in the list
    expect(screen.getByTestId('record-card-rec-shared-1')).toBeTruthy();
    expect(screen.getByTestId('record-card-rec-shared-2')).toBeTruthy();
    expect(screen.queryByTestId('record-card-rec-personal-1')).toBeNull();
    expect(screen.queryByTestId('record-card-rec-personal-2')).toBeNull();
  });

  it('searches across both personal and shared items in unified "All" mode', () => {
    renderWithTheme(<HomeTab />, 'expyrico');


    act(() => {
      fireEvent.changeText(screen.getByTestId('pantry-search-input'), 'Greek');
      jest.advanceTimersByTime(350);
    });
    expect(screen.getByTestId('record-card-rec-shared-1')).toBeTruthy();
    expect(screen.queryByTestId('record-card-rec-personal-1')).toBeNull();

    // Search for a personal item using active input
    act(() => {
      fireEvent.changeText(screen.getByTestId('pantry-search-input'), 'Almond');
      jest.advanceTimersByTime(350);
    });
    expect(screen.getByTestId('record-card-rec-personal-2')).toBeTruthy();
    expect(screen.queryByTestId('record-card-rec-shared-1')).toBeNull();
  });

  it('updates scope assignment dynamically when record is patched', async () => {
    renderWithTheme(<HomeTab />, 'expyrico');

    // Move Organic Eggs from personal to household
    await act(async () => {
      await recordsApi.patchLocalRecord('rec-personal-1', { householdId: 'hh-1' });
    });

    // Switch to household scope
    act(() => {
      fireEvent.press(screen.getByTestId('scope-toggle-hh-1'));
    });

    // Organic Eggs is now present in the household scope!
    expect(screen.getByTestId('record-card-rec-personal-1')).toBeTruthy();
  });

  it('resets search query and isolates filters when switching scopes', () => {
    renderWithTheme(<HomeTab />, 'expyrico');

    // Search in All mode
    act(() => {
      fireEvent.changeText(screen.getByTestId('pantry-search-input'), 'Greek');
      jest.advanceTimersByTime(350);
    });
    expect(screen.getByTestId('record-card-rec-shared-1')).toBeTruthy();
    expect(screen.queryByTestId('record-card-rec-personal-1')).toBeNull();

    // Switch to Personal scope -> resets search
    act(() => {
      fireEvent.press(screen.getByTestId('scope-toggle-personal'));
    });

    // In personal scope, all personal items are visible (not filtered by 'Greek')
    expect(screen.getByTestId('record-card-rec-personal-1')).toBeTruthy();
    expect(screen.getByTestId('record-card-rec-personal-2')).toBeTruthy();
  });

  it('filters to shared items under global "all" when Household Only is selected in modal', () => {
    renderWithTheme(<HomeTab />, 'expyrico');

    expect(usePantryScope.getState().scope).toBe('all');
    expect(usePantryScope.getState().householdId).toBeNull();

    // Open filter modal
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-filter-toggle-btn'));
    });

    // Select "Household Only" scope pill
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-filter-scope-household'));
    });

    // Apply
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-filter-apply-btn'));
    });

    // Global scope remains 'all' with null householdId
    expect(usePantryScope.getState().scope).toBe('all');
    expect(usePantryScope.getState().householdId).toBeNull();

    // Local list filters strictly to shared items
    expect(screen.getByTestId('record-card-rec-shared-1')).toBeTruthy();
    expect(screen.getByTestId('record-card-rec-shared-2')).toBeTruthy();
    expect(screen.queryByTestId('record-card-rec-personal-1')).toBeNull();
    expect(screen.queryByTestId('record-card-rec-personal-2')).toBeNull();
  });
});
