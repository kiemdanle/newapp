import React from 'react';
import { Text, View } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { RecordList } from '../../src/features/records/RecordList';
import { PantryListSkeleton } from '../../src/features/records/PantryListSkeleton';
import { SyncStatusBar } from '../../src/components/SyncStatusBar';
import { useSyncStateStore } from '../../src/store/syncStateStore';
import { useActiveRecordsWithStatus } from '../../src/api/records';
import { usePantryScope } from '../../src/store/pantryScope';
import { clearAllLocalUserData } from '../../src/auth/session-store';
import * as syncModule from '../../src/db/sync';
import * as photoStorage from '../../src/features/records/record-photo-storage';
import { renderWithTheme } from '../helpers/renderWithTheme';
import type { LocalRecord } from '../../src/api/records';

jest.mock('../../src/api/records', () => {
  const actual = jest.requireActual('../../src/api/records');
  return {
    ...actual,
    useActiveRecordsWithStatus: jest.fn(),
  };
});

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));

jest.mock('../../src/utils/pantry-limits', () => ({
  usePantryLimits: () => ({ defaultUserPantryLimit: 100 }),
}));

jest.mock('../../src/features/records/record-counters', () => ({
  useMyActiveRecordCount: () => 0,
}));

const mockEmpty = (
  <View testID="pantry-empty-card">
    <Text>Start your pantry</Text>
  </View>
);

const sampleRecord: LocalRecord = {
  id: 'rec-1',
  serverId: 'srv-1',
  clientId: 'cli-1',
  productId: null,
  customName: 'Apples',
  category: 'Produce',
  expiryDate: '2026-12-31',
  quantity: 2,
  unit: 'kg',
  price: 3,
  store: 'Market',
  notes: '',
  photoUrl: null,
  status: 'active',
  notifyAt: [],
  householdId: null,
  brand: null,
};

describe('Pantry View Skeletons & Initial Sync Tracking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useSyncStateStore.getState().reset();
      usePantryScope.getState().setScope('all', null);
    });
  });

  afterEach(() => {
    act(() => {
      useSyncStateStore.getState().reset();
    });
  });

  describe('PantryListSkeleton Primitives', () => {
    it('renders 5 list skeleton cards in list mode', () => {
      renderWithTheme(<PantryListSkeleton viewMode="list" />, 'expyrico');
      expect(screen.getByTestId('pantry-list-skeleton')).toBeTruthy();
      expect(screen.getByTestId('record-card-skeleton-0')).toBeTruthy();
      expect(screen.getByTestId('record-card-skeleton-4')).toBeTruthy();
    });
    it('renders 6 grid skeleton cards in grid mode', () => {
      renderWithTheme(<PantryListSkeleton viewMode="grid" />, 'expyrico');
      expect(screen.getByTestId('pantry-list-skeleton')).toBeTruthy();
      expect(screen.getByTestId('pantry-grid-skeleton-0')).toBeTruthy();
      expect(screen.getByTestId('pantry-grid-skeleton-5')).toBeTruthy();
    });
  });

  describe('RecordList Fresh-Install Skeleton Gating', () => {
    it('renders PantryListSkeleton and suppresses "Start your pantry" when initial sync is pending', () => {
      (useActiveRecordsWithStatus as jest.Mock).mockReturnValue({
        records: [],
        isLoading: false,
        isResolved: true,
      });

      // initialSyncCompleted is false by default on fresh install
      renderWithTheme(<RecordList empty={mockEmpty} />, 'expyrico');

      expect(screen.getByTestId('pantry-list-skeleton')).toBeTruthy();
      expect(screen.queryByText('Start your pantry')).toBeNull();
    });

    it('pre-allocates search controls above skeleton for zero layout shift (CLS = 0)', () => {
      (useActiveRecordsWithStatus as jest.Mock).mockReturnValue({
        records: [],
        isLoading: false,
        isResolved: true,
      });

      renderWithTheme(<RecordList empty={mockEmpty} />, 'expyrico');

      // Search bar is pre-rendered on Frame 0
      expect(screen.getByTestId('pantry-search-input')).toBeTruthy();
      expect(screen.getByTestId('pantry-list-skeleton')).toBeTruthy();
    });

    it('renders actual records once initial sync settles and records are present', () => {
      (useActiveRecordsWithStatus as jest.Mock).mockReturnValue({
        records: [sampleRecord],
        isLoading: false,
        isResolved: true,
      });

      act(() => {
        useSyncStateStore.getState().setSyncSuccess();
      });

      renderWithTheme(<RecordList empty={mockEmpty} />, 'expyrico');

      expect(screen.queryByTestId('pantry-list-skeleton')).toBeNull();
      expect(screen.getByText('Apples')).toBeTruthy();
      expect(screen.queryByText('Start your pantry')).toBeNull();
    });
  });

  describe('Universal 4-Second Fail-Safe Timeout & SyncStatusBar', () => {
    it('forces initialSyncCompleted = true at 4000ms and unmasks empty state with offline status bar', () => {
      jest.useFakeTimers();

      (useActiveRecordsWithStatus as jest.Mock).mockReturnValue({
        records: [],
        isLoading: false,
        isResolved: true,
      });

      // Initiate sync deadline
      useSyncStateStore.getState().beginInitialSync();
      expect(useSyncStateStore.getState().initialSyncCompleted).toBe(false);

      const { rerender } = renderWithTheme(<RecordList empty={mockEmpty} />, 'expyrico');
      expect(screen.getByTestId('pantry-list-skeleton')).toBeTruthy();
      expect(screen.queryByText('Start your pantry')).toBeNull();

      // Fast forward past 4,000ms fail-safe timeout
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      expect(useSyncStateStore.getState().initialSyncCompleted).toBe(true);
      expect(useSyncStateStore.getState().lastSyncError).toBe('timeout');
      act(() => {
        rerender(<RecordList empty={mockEmpty} />);
      });
      // Now unmasked to empty state + offline status bar
      expect(screen.queryByTestId('pantry-list-skeleton')).toBeNull();
      expect(screen.getByText('Start your pantry')).toBeTruthy();
      expect(screen.getByTestId('sync-status-bar')).toBeTruthy();
      expect(
        screen.getByText('Offline — showing local pantry (tap to retry)')
      ).toBeTruthy();

      jest.useRealTimers();
    });
  });

  describe('Scope Transition & Cross-Session Invalidation', () => {
    it('resets isResolved immediately on household scope transition', () => {
      let isResolvedState = true;
      (useActiveRecordsWithStatus as jest.Mock).mockImplementation(() => ({
        records: [],
        isLoading: !isResolvedState,
        isResolved: isResolvedState,
      }));

      act(() => {
        useSyncStateStore.getState().setSyncSuccess();
      });

      const { rerender } = renderWithTheme(<RecordList empty={mockEmpty} />, 'expyrico');
      expect(screen.queryByTestId('pantry-list-skeleton')).toBeNull();

      // Simulate scope switch causing query to become unresolved
      isResolvedState = false;
      act(() => {
        rerender(<RecordList empty={mockEmpty} />);
      });
      // Skeleton displays while SQLite query for the new household is resolving
      expect(screen.getByTestId('pantry-list-skeleton')).toBeTruthy();
    });

    it('clearAllLocalUserData triggers invalidateSyncEpoch, resets syncStateStore, and purges attachments', async () => {
      const invalidateSpy = jest.spyOn(syncModule, 'invalidateSyncEpoch');
      const purgeSpy = jest.spyOn(photoStorage, 'clearAllRecordPhotoAttachments');

      act(() => {
        useSyncStateStore.getState().setSyncSuccess();
      });
      expect(useSyncStateStore.getState().initialSyncCompleted).toBe(true);

      await clearAllLocalUserData('user-1');

      expect(invalidateSpy).toHaveBeenCalled();
      expect(purgeSpy).toHaveBeenCalled();
      expect(useSyncStateStore.getState().initialSyncCompleted).toBe(false);
    });
  });
});
