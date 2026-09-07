// apps/mobile/tests/integration/pantry-filtering-and-pagination.test.tsx
import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import HomeTab from '../../app/(app)/(tabs)/home';
import { filterAndSortRecords } from '../../src/features/records/filterAndSortRecords';
import type { LocalRecord } from '../../src/api/records';
import * as recordsApi from '../../src/api/records';
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

describe('Pantry Filtering and Pagination Integration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('Chronological Priority Invariant', () => {
    it('ensures most-expired items physically located past index 20 appear on page 1 after sorting and slicing', () => {
      // Build 45 items where items 0-24 have future dates (2027),
      // while items 25-29 are expired (2026-08)
      const rawRecords: LocalRecord[] = [];
      for (let i = 0; i < 25; i++) {
        rawRecords.push(
          makeRecord({
            id: `rec-future-${i}`,
            customName: `Future Item ${i}`,
            expiryDate: '2027-06-01',
          }),
        );
      }
      for (let i = 25; i < 30; i++) {
        rawRecords.push(
          makeRecord({
            id: `rec-urgent-${i}`,
            customName: `Urgent Expired Item ${i}`,
            expiryDate: '2026-08-15', // Expired
          }),
        );
      }
      for (let i = 30; i < 45; i++) {
        rawRecords.push(
          makeRecord({
            id: `rec-later-${i}`,
            customName: `Later Item ${i}`,
            expiryDate: '2027-12-01',
          }),
        );
      }

      // In raw un-sorted array, rec-urgent-25 is at index 25
      expect(rawRecords[25]?.id).toBe('rec-urgent-25');

      // Process through filterAndSortRecords pipeline in default mode
      const sortedRecords = filterAndSortRecords(rawRecords, {}, 'expiry_asc');

      // Page 1 slice of 20 items
      const page1Slice = sortedRecords.slice(0, 20);

      // All urgent items from index 25-29 MUST be present in page 1
      const page1Ids = page1Slice.map((r) => r.id);
      expect(page1Ids).toContain('rec-urgent-25');
      expect(page1Ids).toContain('rec-urgent-26');
      expect(page1Ids).toContain('rec-urgent-27');
      expect(page1Ids).toContain('rec-urgent-28');
      expect(page1Ids).toContain('rec-urgent-29');

      // In fact, they should be at the very beginning of page 1
      expect(page1Ids[0]).toBe('rec-urgent-25');
    });
  });

  describe('Full UI User Flows on HomeTab', () => {
    const mockDataset: LocalRecord[] = Array.from({ length: 45 }, (_, i) => {
      let category = 'Pantry';
      let expiryDate = '2026-11-01';
      if (i === 0) {
        category = 'Dairy';
        expiryDate = '2026-09-01'; // Expired
      } else if (i === 1) {
        category = 'Dairy';
        expiryDate = '2026-09-04'; // Expiring soon
      } else if (i === 2) {
        category = 'Produce';
        expiryDate = '2026-09-05'; // Expiring soon
      } else if (i === 3) {
        category = 'Bakery';
        expiryDate = '2026-09-20'; // This week / later
      }

      return makeRecord({
        id: `rec-${i}`,
        customName: i === 0 ? 'Organic Milk' : i === 1 ? 'Greek Yogurt' : `Item ${i}`,
        category,
        expiryDate,
        quantity: 2,
      });
    });

    it('handles infinite scroll auto-load, search transition, sorting, and filter modal flows', () => {
      jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockDataset);

      const screen = renderWithTheme(<HomeTab />, 'expyrico');

      // 1. Initial State: Unfiltered SectionList with 20 items
      expect(screen.getByTestId('pantry-record-list')).toBeTruthy();
      expect(screen.getByTestId('pantry-search-input')).toBeTruthy();
      expect(screen.getByTestId('pantry-sort-pills')).toBeTruthy();

      // 2. Scroll near bottom in default SectionList: trigger onEndReached
      const list = screen.getByTestId('pantry-record-list');
      act(() => {
        fireEvent(list, 'scrollBeginDrag');
        fireEvent(list, 'endReached');
      });

      // Spinner appears
      expect(screen.getByTestId('pantry-pagination-spinner')).toBeTruthy();

      // Advance 180ms intentional delay
      act(() => {
        jest.advanceTimersByTime(180);
      });

      // Spinner resolves as next page appends
      expect(screen.queryByTestId('pantry-pagination-spinner')).toBeNull();

      // 3. Search Flow: Type "Milk"
      const searchInput = screen.getByTestId('pantry-search-input');
      const initialList = screen.getByTestId('pantry-record-list');
      act(() => {
        fireEvent.changeText(searchInput, 'Milk');
      });
      act(() => {
        fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'Milk' } });
      });
      expect(screen.getByTestId('pantry-record-list')).toBe(initialList);
      expect(screen.getByTestId('pantry-search-input')).toBe(searchInput);
      expect(screen.getByText('Organic Milk')).toBeTruthy();
      expect(screen.queryByText('Greek Yogurt')).toBeNull();
      expect(screen.getByText('Showing 1 of 1 items')).toBeTruthy();

      // Search for non-existent item -> renders filter empty state
      act(() => {
        fireEvent.changeText(searchInput, 'NonExistentProductXYZ');
      });
      act(() => {
        fireEvent.press(screen.getByTestId('pantry-search-submit-btn'));
      });
      expect(screen.getByTestId('pantry-filter-empty-card')).toBeTruthy();
      expect(screen.getByText('No matching pantry items')).toBeTruthy();
      const clearSearchChip = screen.getByLabelText('Remove filter: "NonExistentProductXYZ"');
      act(() => {
        fireEvent.press(clearSearchChip);
        jest.advanceTimersByTime(300);
      });

      // 4. Sort Flow: Select "Name A-Z"
      const sortAtoZ = screen.getByTestId('pantry-sort-pill-name_asc');
      act(() => {
        fireEvent.press(sortAtoZ);
      });

      // In custom sort, view updates SectionList results with active sort indicator
      expect(screen.getByText('Showing 20 of 45 items')).toBeTruthy();

      // 5. Filter Modal Flow: Open filter modal and filter by Category "Dairy"
      const filterBtn = screen.getByTestId('pantry-filter-toggle-btn');
      act(() => {
        fireEvent.press(filterBtn);
      });

      expect(screen.getByTestId('pantry-filter-modal')).toBeTruthy();
      const dairyChip = screen.getByTestId('pantry-filter-cat-dairy');
      act(() => {
        fireEvent.press(dairyChip);
      });

      const applyBtn = screen.getByTestId('pantry-filter-apply-btn');
      act(() => {
        fireEvent.press(applyBtn);
      });

      // Filtered to Dairy items
      expect(screen.getByText('Organic Milk')).toBeTruthy();
      expect(screen.getByText('Greek Yogurt')).toBeTruthy();
      expect(screen.getByText('Showing 2 of 2 items')).toBeTruthy();

      // Active chip is displayed
      expect(screen.getByLabelText('Remove filter: Category: Dairy')).toBeTruthy();

      // Clear all filters
      const clearAllBtn = screen.getByTestId('pantry-clear-all-filters-btn');
      act(() => {
        fireEvent.press(clearAllBtn);
      });

      // Reverts cleanly to default SectionList view
      expect(screen.getByTestId('pantry-record-list')).toBeTruthy();
    });
  });

  describe('Urgent Item Interactive Filter and Section Preservation', () => {
    it('filters records by urgent expiry status (expired, today, this week) and excludes later items', () => {
      const records: LocalRecord[] = [
        makeRecord({ id: 'rec-exp', customName: 'Expired Milk', expiryDate: '2026-09-01' }),
        makeRecord({ id: 'rec-tod', customName: 'Today Bread', expiryDate: '2026-09-07' }),
        makeRecord({ id: 'rec-wk', customName: 'This Week Yogurt', expiryDate: '2026-09-11' }),
        makeRecord({ id: 'rec-lat', customName: 'Later Rice', expiryDate: '2026-10-15' }),
      ];

      const urgentOnly = filterAndSortRecords(records, { expiryStatus: 'urgent' });
      const urgentIds = urgentOnly.map((r) => r.id);

      expect(urgentIds).toContain('rec-exp');
      expect(urgentIds).toContain('rec-tod');
      expect(urgentIds).toContain('rec-wk');
      expect(urgentIds).not.toContain('rec-lat');
    });

    it('toggles urgent filter, preserves urgency sections even under search (advisor concern), and auto-switches from history tab', () => {
      const mockItems: LocalRecord[] = [
        makeRecord({ id: 'u-1', customName: 'Organic Milk Expired', category: 'Dairy', expiryDate: '2026-09-01' }),
        makeRecord({ id: 'u-2', customName: 'Organic Milk Today', category: 'Dairy', expiryDate: '2026-09-07' }),
        makeRecord({ id: 'u-3', customName: 'Organic Milk This Week', category: 'Dairy', expiryDate: '2026-09-10' }),
        makeRecord({ id: 'u-4', customName: 'Fresh Cereal', category: 'Pantry', expiryDate: '2026-11-20' }),
      ];
      jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

      const screen = renderWithTheme(<HomeTab />, 'expyrico');

      // 1. Verify urgent count pill exists with 3 urgent items
      const urgentPill = screen.getByTestId('home-urgent-pill');
      expect(urgentPill).toBeTruthy();
      expect(screen.getByText('3 urgent')).toBeTruthy();
      expect(urgentPill.props.accessibilityState).toEqual({ selected: false });

      // 2. Tap urgent pill -> activates urgent filter
      act(() => {
        fireEvent.press(urgentPill);
      });

      // Pill reflects selected: true
      expect(urgentPill.props.accessibilityState).toEqual({ selected: true });

      // Filter chip is displayed
      expect(screen.getByLabelText('Remove filter: Status: Urgent (≤ 7 days)')).toBeTruthy();

      // Urgency section headers are displayed, Later item is excluded
      expect(screen.getByTestId('record-section-expired')).toBeTruthy();
      expect(screen.getByTestId('record-section-today')).toBeTruthy();
      expect(screen.getByTestId('record-section-thisWeek')).toBeTruthy();
      expect(screen.queryByTestId('record-section-later')).toBeNull();
      expect(screen.queryByText('Fresh Cereal')).toBeNull();

      // 3. Advisor Concern Verification: Type "Milk" into search bar
      // Urgency section headers MUST STILL BE PRESERVED and not collapsed into a flat list!
      const searchInput = screen.getByTestId('pantry-search-input');
      act(() => {
        fireEvent.changeText(searchInput, 'Milk');
      });
      act(() => {
        fireEvent(searchInput, 'submitEditing', { nativeEvent: { text: 'Milk' } });
      });

      // Crucial assertion: Urgency sections remain active even with search query
      expect(screen.getByTestId('record-section-expired')).toBeTruthy();
      expect(screen.getByTestId('record-section-today')).toBeTruthy();
      expect(screen.getByTestId('record-section-thisWeek')).toBeTruthy();
      expect(screen.queryByText('Showing 3 of 3 items')).toBeNull();

      // Clear search
      act(() => {
        fireEvent.press(screen.getByLabelText('Remove filter: "Milk"'));
      });

      // 4. Dismiss urgent filter via active chip (X)
      const dismissChip = screen.getByLabelText('Remove filter: Status: Urgent (≤ 7 days)');
      act(() => {
        fireEvent.press(dismissChip);
      });

      // Advance timers in case of re-render debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Pill reverts to unselected
      expect(urgentPill.props.accessibilityState).toEqual({ selected: false });
      // Check if Fresh Cereal exists or print tree
      expect(screen.getByText('Fresh Cereal')).toBeTruthy();
      // 5. Cross-Tab Switching: Tap History tab, then tap urgent pill
      const historyTab = screen.getByTestId('pantry-tab-history');
      act(() => {
        fireEvent.press(historyTab);
      });
      expect(screen.getByTestId('pantry-tab-history').props.accessibilityState).toEqual({ selected: true });

      // Tapping urgent pill switches back to In Stock tab and applies filter
      act(() => {
        fireEvent.press(screen.getByTestId('home-urgent-pill'));
      });

      expect(screen.getByTestId('pantry-tab-in-stock').props.accessibilityState).toEqual({ selected: true });
      expect(screen.getByLabelText('Remove filter: Status: Urgent (≤ 7 days)')).toBeTruthy();
    });

    it('resets selection mode when urgent filter toggles and auto-resets filter when totalUrgent drops to 0', () => {
      let currentItems: LocalRecord[] = [
        makeRecord({ id: 'u-1', customName: 'Expiring Milk', category: 'Dairy', expiryDate: '2026-09-07' }),
        makeRecord({ id: 'u-2', customName: 'Later Pasta', category: 'Pantry', expiryDate: '2026-11-20' }),
      ];
      const recordsSpy = jest.spyOn(recordsApi, 'useActiveRecords').mockImplementation(() => currentItems);

      const screen = renderWithTheme(<HomeTab />, 'expyrico');

      // 1. Enter selection mode on item u-2
      const pastaCard = screen.getByTestId('record-card-u-2');
      act(() => {
        fireEvent(pastaCard, 'longPress');
      });
      expect(screen.getByTestId('record-select-checkbox-u-2')).toBeTruthy();

      // 2. Tap urgent pill -> selection mode must reset to prevent hidden mutations!
      const urgentPill = screen.getByTestId('home-urgent-pill');
      act(() => {
        fireEvent.press(urgentPill);
      });
      expect(screen.queryByTestId('record-select-checkbox-u-2')).toBeNull();
      expect(urgentPill.props.accessibilityState).toEqual({ selected: true });

      // 3. Clear the only urgent item (totalUrgent drops to 0)
      currentItems = [
        makeRecord({ id: 'u-2', customName: 'Later Pasta', category: 'Pantry', expiryDate: '2026-11-20' }),
      ];
      act(() => {
        fireEvent.press(screen.getByTestId('pantry-tab-history'));
      });
      act(() => {
        fireEvent.press(screen.getByTestId('pantry-tab-in-stock'));
      });

      // Assert the live auto-reset effect executed on the existing instance:
      expect(screen.queryByTestId('home-urgent-pill')).toBeNull();
      expect(screen.queryByLabelText('Remove filter: Status: Urgent (≤ 7 days)')).toBeNull();
      expect(screen.getAllByText('Later Pasta').length).toBeGreaterThan(0);

      recordsSpy.mockRestore();
    });

    it('preserves urgency sections when urgent filter is combined with category filter', () => {
      const mockItems: LocalRecord[] = [
        makeRecord({ id: 'u-1', customName: 'Dairy Expired', category: 'Dairy', expiryDate: '2026-09-01' }),
        makeRecord({ id: 'u-2', customName: 'Dairy Today', category: 'Dairy', expiryDate: '2026-09-07' }),
        makeRecord({ id: 'u-3', customName: 'Bakery Expired', category: 'Bakery', expiryDate: '2026-09-01' }),
      ];
      jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

      const screen = renderWithTheme(<HomeTab />, 'expyrico');

      // 1. Filter by category "Dairy" via filter modal
      const filterBtn = screen.getByTestId('pantry-filter-toggle-btn');
      act(() => {
        fireEvent.press(filterBtn);
      });
      const dairyChip = screen.getByTestId('pantry-filter-cat-dairy');
      act(() => {
        fireEvent.press(dairyChip);
      });
      const applyBtn = screen.getByTestId('pantry-filter-apply-btn');
      act(() => {
        fireEvent.press(applyBtn);
      });

      // 2. Activate urgent filter
      const urgentPill = screen.getByTestId('home-urgent-pill');
      act(() => {
        fireEvent.press(urgentPill);
      });

      // Urgency sections are preserved for Dairy items
      expect(screen.getByTestId('record-section-expired')).toBeTruthy();
      expect(screen.getByTestId('record-section-today')).toBeTruthy();
      expect(screen.getByText('Dairy Expired')).toBeTruthy();
      expect(screen.getByText('Dairy Today')).toBeTruthy();
      expect(screen.queryByText('Bakery Expired')).toBeNull();
    });

    it('resets urgent filter when household scope changes', () => {
      usePantryScope.getState().setScope('all', null);
      const mockItems: LocalRecord[] = [
        makeRecord({ id: 'u-1', customName: 'Urgent Milk', category: 'Dairy', expiryDate: '2026-09-07' }),
      ];
      jest.spyOn(recordsApi, 'useActiveRecords').mockReturnValue(mockItems);

      const screen = renderWithTheme(<HomeTab />, 'expyrico');
      const urgentPill = screen.getByTestId('home-urgent-pill');
      act(() => {
        fireEvent.press(urgentPill);
      });
      expect(urgentPill.props.accessibilityState).toEqual({ selected: true });

      // Switch scope
      act(() => {
        usePantryScope.getState().setScope('personal', null);
      });

      // Urgent filter should reset on scope change
      expect(urgentPill.props.accessibilityState).toEqual({ selected: false });
    });
  });
});
