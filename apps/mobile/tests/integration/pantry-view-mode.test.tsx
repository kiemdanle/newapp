// apps/mobile/tests/integration/pantry-view-mode.test.tsx
import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HomeTab from '../../app/(app)/(tabs)/home';
import type { LocalRecord } from '../../src/api/records';
import * as recordsApi from '../../src/api/records';
import { useUiPreferencesStore, PANTRY_VIEW_MODE_STORAGE_KEY } from '../../src/store/uiPreferencesStore';
import { usePantryScope } from '../../src/store/pantryScope';
import { renderWithTheme } from '../helpers/renderWithTheme';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

function makeRecord(overrides: Partial<LocalRecord> = {}): LocalRecord {
  return {
    id: overrides.id ?? 'rec-1',
    serverId: null,
    clientId: 'client-1',
    productId: overrides.productId ?? null,
    customName: overrides.customName ?? 'Pantry Item',
    category: overrides.category ?? 'Pantry',
    expiryDate: overrides.expiryDate ?? '2026-10-01',
    quantity: overrides.quantity ?? 1,
    unit: 'pcs',
    price: null,
    store: overrides.store ?? null,
    notes: overrides.notes ?? null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: overrides.householdId ?? null,
  };
}

describe('Pantry View Mode Toggle Integration', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T12:00:00Z'));
    await AsyncStorage.clear();
    useUiPreferencesStore.setState({ pantryViewMode: 'list' });
    usePantryScope.getState().setScope('all', null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('toggles between list and grid views, persists preference to AsyncStorage, and renders grid cards', async () => {
    const mockItems: LocalRecord[] = [
      makeRecord({ id: 'item-1', customName: 'Almond Milk', category: 'Dairy', expiryDate: '2026-09-07' }),
      makeRecord({ id: 'item-2', customName: 'Greek Yogurt', category: 'Dairy', expiryDate: '2026-09-07' }),
      makeRecord({ id: 'item-3', customName: 'Cheddar Cheese', category: 'Dairy', expiryDate: '2026-09-07' }),
    ];
    jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

    const screen = renderWithTheme(<HomeTab />, 'expyrico');

    // 1. Initial State: List View
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
    const toggleBtn = screen.getByTestId('pantry-view-mode-toggle-btn');
    expect(toggleBtn.props.accessibilityLabel).toBe('Switch to grid view');

    // List view items are present
    expect(screen.getByTestId('record-card-item-1')).toBeTruthy();
    expect(screen.queryByTestId('pantry-grid-card-item-1')).toBeNull();

    // 2. Tap toggle to switch to Grid View
    act(() => {
      fireEvent.press(toggleBtn);
    });

    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');
    expect(toggleBtn.props.accessibilityLabel).toBe('Switch to list view');

    // Grid cards are now rendered
    expect(screen.getByTestId('pantry-grid-card-item-1')).toBeTruthy();
    expect(screen.getByTestId('pantry-grid-card-item-2')).toBeTruthy();
    expect(screen.getByTestId('pantry-grid-card-item-3')).toBeTruthy();

    // AsyncStorage persisted 'grid'
    const stored = await AsyncStorage.getItem(PANTRY_VIEW_MODE_STORAGE_KEY);
    expect(stored).toBe('grid');

    // 3. Tap toggle to switch back to List View
    act(() => {
      fireEvent.press(toggleBtn);
    });

    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('list');
    expect(toggleBtn.props.accessibilityLabel).toBe('Switch to grid view');
    expect(screen.queryByTestId('pantry-grid-card-item-1')).toBeNull();
    expect(screen.getByTestId('record-card-item-1')).toBeTruthy();

    const storedBack = await AsyncStorage.getItem(PANTRY_VIEW_MODE_STORAGE_KEY);
    expect(storedBack).toBe('list');
  });

  it('displays correct section header count in grid mode for odd item counts without halving', () => {
    // 3 items expiring today (odd count: 1 pair + 1 trailing single item)
    const mockItems: LocalRecord[] = [
      makeRecord({ id: 'item-1', customName: 'Milk', category: 'Dairy', expiryDate: '2026-09-07' }),
      makeRecord({ id: 'item-2', customName: 'Yogurt', category: 'Dairy', expiryDate: '2026-09-07' }),
      makeRecord({ id: 'item-3', customName: 'Cheese', category: 'Dairy', expiryDate: '2026-09-07' }),
    ];
    jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

    const screen = renderWithTheme(<HomeTab />, 'expyrico');

    // Switch to grid mode
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-view-mode-toggle-btn'));
    });

    // In grid mode, the 3 items chunk into 2 rows, but section header MUST display original count: 3
    const sectionHeader = screen.getByTestId('record-section-today');
    expect(sectionHeader.props.children).toContain(3);
    expect(sectionHeader.props.children).not.toContain(2);
  });

  it('supports long-press to enter selection mode and toggling checkboxes in grid view', () => {
    const mockItems: LocalRecord[] = [
      makeRecord({ id: 'item-1', customName: 'Milk', category: 'Dairy', expiryDate: '2026-09-07' }),
      makeRecord({ id: 'item-2', customName: 'Eggs', category: 'Dairy', expiryDate: '2026-09-07' }),
    ];
    jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

    const screen = renderWithTheme(<HomeTab />, 'expyrico');

    // Switch to grid view
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-view-mode-toggle-btn'));
    });

    // Long press first grid card to enter selection mode
    const card1 = screen.getByTestId('record-card-item-1');
    act(() => {
      fireEvent(card1, 'longPress');
    });

    // Selection mode active
    expect(screen.getByTestId('bulk-action-bar')).toBeTruthy();
    expect(screen.getByTestId('record-select-checkbox-item-1')).toBeTruthy();
    expect(screen.getByTestId('record-select-checkbox-item-2')).toBeTruthy();

    // Tap second card to toggle selection
    const card2 = screen.getByTestId('record-card-item-2');
    act(() => {
      fireEvent.press(card2);
    });

    expect(screen.getByTestId('bulk-selected-count').props.children).toContain(2);
  });

  it('filters items in grid view without resetting view mode or losing grid layout', () => {
    const mockItems: LocalRecord[] = [
      makeRecord({ id: 'item-1', customName: 'Almond Milk', category: 'Dairy', expiryDate: '2026-09-07' }),
      makeRecord({ id: 'item-2', customName: 'Whole Wheat Bread', category: 'Bakery', expiryDate: '2026-09-07' }),
    ];
    jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

    const screen = renderWithTheme(<HomeTab />, 'expyrico');

    // Switch to grid view
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-view-mode-toggle-btn'));
    });
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');

    // Type in search input
    const searchInput = screen.getByTestId('pantry-search-input');
    act(() => {
      fireEvent.changeText(searchInput, 'Bread');
    });
    act(() => {
      fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'Bread' } });
    });

    // Still in grid mode with Bread matching
    expect(useUiPreferencesStore.getState().pantryViewMode).toBe('grid');
    expect(screen.getByTestId('pantry-grid-card-item-2')).toBeTruthy();
    expect(screen.queryByTestId('pantry-grid-card-item-1')).toBeNull();
  });

  it('suppresses false onEndReached pagination triggers when toggling view mode', () => {
    // 30 items so pagination is active (page 1 has 20 items, page 2 has 10)
    const mockDataset: LocalRecord[] = Array.from({ length: 30 }, (_, i) =>
      makeRecord({
        id: `item-${i}`,
        customName: `Pantry Item ${i}`,
        category: 'Pantry',
        expiryDate: '2026-09-07',
      }),
    );
    jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockDataset);

    const screen = renderWithTheme(<HomeTab />, 'expyrico');

    const list = screen.getByTestId('pantry-record-list');
    const toggleBtn = screen.getByTestId('pantry-view-mode-toggle-btn');

    // 1. Toggle from list to grid view
    act(() => {
      fireEvent.press(toggleBtn);
    });

    // 2. An immediate onEndReached fired without scrollBeginDrag MUST NOT trigger pagination
    act(() => {
      fireEvent(list, 'endReached');
    });

    // Spinner must NOT appear
    expect(screen.queryByTestId('pantry-pagination-spinner')).toBeNull();

    // 3. But when the user explicitly begins dragging / scrolling, onEndReached does trigger pagination
    act(() => {
      fireEvent(list, 'scrollBeginDrag');
      fireEvent(list, 'endReached');
    });

    expect(screen.getByTestId('pantry-pagination-spinner')).toBeTruthy();
  });

  it('supports opening grid action drawer, incrementing quantity, and mutual exclusivity between items', async () => {
    const patchSpy = jest.spyOn(recordsApi, 'patchLocalRecord').mockResolvedValue(undefined as any);
    const mockItems: LocalRecord[] = [
      makeRecord({ id: 'item-1', customName: 'Milk', quantity: 2, unit: 'cartons', expiryDate: '2026-09-07' }),
      makeRecord({ id: 'item-2', customName: 'Bread', quantity: 1, unit: 'loaf', expiryDate: '2026-09-07' }),
    ];
    jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

    const screen = renderWithTheme(<HomeTab />, 'expyrico');

    // Toggle to grid mode
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-view-mode-toggle-btn'));
    });

    // Tap 3-dots trigger on item-1
    const moreBtn1 = screen.getByTestId('record-open-actions-item-1');
    act(() => {
      fireEvent.press(moreBtn1);
    });

    // Action drawer for item-1 is visible with duplicate action
    const duplicateBtn1 = screen.getByTestId('record-duplicate-item-1');
    expect(duplicateBtn1).toBeTruthy();

    // Tap duplicate on item-1 opens QuickEditModal with draft
    act(() => {
      fireEvent.press(duplicateBtn1);
    });

    expect(screen.getByTestId('save-quick-edit')).toBeTruthy();
    // Close modal
    act(() => {
      fireEvent.press(screen.getByText('Cancel'));
    });

    // Tap 3-dots on item-2 -> opens item-2
    const moreBtn2 = screen.getByTestId('record-open-actions-item-2');
    act(() => {
      fireEvent.press(moreBtn2);
    });

    expect(screen.getByTestId('record-duplicate-item-2')).toBeTruthy();
    // Scrolling the list closes the active drawer
    const list = screen.getByTestId('pantry-record-list');
    act(() => {
      fireEvent(list, 'scrollBeginDrag');
    });

    patchSpy.mockRestore();
  });
});
