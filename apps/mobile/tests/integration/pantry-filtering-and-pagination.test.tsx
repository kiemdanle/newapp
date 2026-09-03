// apps/mobile/tests/integration/pantry-filtering-and-pagination.test.tsx
import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import HomeTab from '../../app/(app)/(tabs)/home';
import { filterAndSortRecords } from '../../src/features/records/filterAndSortRecords';
import type { LocalRecord } from '../../src/api/records';
import * as recordsApi from '../../src/api/records';
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
      act(() => {
        fireEvent.changeText(searchInput, 'Milk');
        jest.advanceTimersByTime(300); // debounce
      });

      // Switches to FlatList filtered view
      expect(screen.getByText('Organic Milk')).toBeTruthy();
      expect(screen.queryByText('Greek Yogurt')).toBeNull();
      expect(screen.getByText('Showing 1 of 1 items')).toBeTruthy();

      // Clear search via active chip
      const clearSearchChip = screen.getByLabelText('Remove filter: "Milk"');
      act(() => {
        fireEvent.press(clearSearchChip);
        jest.advanceTimersByTime(300);
      });

      // 4. Sort Flow: Select "Name A-Z"
      const sortAtoZ = screen.getByTestId('pantry-sort-pill-name_asc');
      act(() => {
        fireEvent.press(sortAtoZ);
      });

      // In custom sort, view transitions to FlatList with active sort indicator
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
});
