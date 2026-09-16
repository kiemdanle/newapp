import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { RecordList } from '../../src/features/records/RecordList';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { useActiveRecordsWithStatus } from '../../src/api/records';
import { useSyncStateStore } from '../../src/store/syncStateStore';

jest.mock('../../src/api/records', () => ({
  ...jest.requireActual('../../src/api/records'),
  useActiveRecordsWithStatus: jest.fn(),
  createLocalRecord: jest.fn(),
  patchLocalRecord: jest.fn(),
  deleteLocalRecord: jest.fn(),
}));

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));

jest.mock('../../src/db/sync', () => ({
  runSync: jest.fn(),
}));

jest.mock('../../src/api/products', () => ({
  useProduct: () => ({ data: null }),
}));

describe('RecordList Facebook-style Quick-Reappear Floating Controls', () => {
  const sampleRecords = Array.from({ length: 25 }, (_, i) => ({
    id: `rec-${i}`,
    clientId: `client-${i}`,
    serverId: `srv-${i}`,
    customName: `Pantry Item ${i + 1}`,
    brand: null,
    category: 'Pantry',
    expiryDate: '2026-12-31',
    quantity: 1,
    unit: 'pcs',
    photoUrl: null,
    localPhotos: [],
    status: 'active' as const,
    notifyAt: [],
    householdId: null,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    (useActiveRecordsWithStatus as jest.Mock).mockReturnValue({
      records: sampleRecords,
      isResolved: true,
      isLoading: false,
    });
    useSyncStateStore.setState({ initialSyncCompleted: true });
  });

  it('renders floating controls initially hidden with pointerEvents="none" at top of list', () => {
    const { getByTestId } = renderWithTheme(<RecordList />, 'expyrico');

    const floatingControls = getByTestId('pantry-floating-controls');
    expect(floatingControls).toBeTruthy();
    expect(floatingControls.props.pointerEvents).toBe('none');
  });

  it('shows floating controls when scrolling down then scrolling up by ~7 lines (>= 120px)', () => {
    const { getByTestId } = renderWithTheme(<RecordList />, 'expyrico');

    const list = getByTestId('pantry-record-list');
    const floatingControls = getByTestId('pantry-floating-controls');

    const scrollMetrics = {
      layoutMeasurement: { height: 800, width: 400 },
      contentSize: { height: 3000, width: 400 },
    };

    // 1. User scrolls down past header controls (contentOffset.y = 600)
    act(() => {
      fireEvent.scroll(list, {
        nativeEvent: {
          ...scrollMetrics,
          contentOffset: { y: 600, x: 0 },
        },
      });
    });
    // Still hidden while scrolling down
    expect(floatingControls.props.pointerEvents).toBe('none');

    // 2. User scrolls UP by ~7 lines (contentOffset.y drops from 600 to 460 -> delta = -140px >= 120px)
    act(() => {
      fireEvent.scroll(list, {
        nativeEvent: {
          ...scrollMetrics,
          contentOffset: { y: 460, x: 0 },
        },
      });
    });

    // Floating controls appear and become interactive!
    expect(floatingControls.props.pointerEvents).toBe('auto');

    // 3. User scrolls down again (contentOffset.y rises from 460 to 490 -> delta = +30px)
    act(() => {
      fireEvent.scroll(list, {
        nativeEvent: {
          ...scrollMetrics,
          contentOffset: { y: 490, x: 0 },
        },
      });
    });
    // Floating controls disappear again
    expect(floatingControls.props.pointerEvents).toBe('none');

    // 4. User scrolls all the way back to top (contentOffset.y = 100 <= 200)
    act(() => {
      fireEvent.scroll(list, {
        nativeEvent: {
          ...scrollMetrics,
          contentOffset: { y: 100, x: 0 },
        },
      });
    });
  });
});
