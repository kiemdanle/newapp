import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { RecordDetailSkeleton } from '../../src/components/skeleton/RecordDetailSkeleton';
import { ProductDetailSkeleton } from '../../src/components/skeleton/ProductDetailSkeleton';
import { PantryHistorySkeleton } from '../../src/features/records/PantryHistorySkeleton';
import RecordDetail from '../../app/(app)/record/[id]';
import { PantryHistoryView } from '../../src/features/records/PantryHistoryView';
import { useRecordWithStatus, usePantryHistoryRecordsWithStatus } from '../../src/api/records';
import { useProduct } from '../../src/api/products';
import { useSyncStateStore } from '../../src/store/syncStateStore';
import { renderWithTheme } from '../helpers/renderWithTheme';
import type { LocalRecord } from '../../src/api/records';

jest.mock('../../src/api/records', () => {
  const actual = jest.requireActual('../../src/api/records');
  return {
    ...actual,
    useRecordWithStatus: jest.fn(),
    usePantryHistoryRecordsWithStatus: jest.fn(),
  };
});

jest.mock('../../src/api/products', () => ({
  useProduct: jest.fn(),
}));

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));

jest.mock('../../src/api/giveaways', () => ({
  useActiveGiveawaysForRecord: () => ({ data: [] }),
}));

jest.mock('../../src/api/reviews', () => ({
  useMyProductReview: () => ({ data: null }),
  useMyReviews: () => ({ data: null }),
  useProductReviews: () => ({ data: null, isLoading: false }),
  useVoteReviewHelpful: () => ({ mutate: jest.fn() }),
  deduplicateReviews: () => [],
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useRoute: () => ({ params: { id: 'test-rec-1' } }),
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      canGoBack: () => true,
    }),
  };
});

const sampleRecord: LocalRecord = {
  id: 'test-rec-1',
  serverId: 'srv-1',
  clientId: 'cli-1',
  productId: 'prod-1',
  customName: 'Crisp Apples',
  category: 'Produce',
  expiryDate: '2026-12-31',
  quantity: 2,
  unit: 'kg',
  price: 3.5,
  store: 'Market',
  notes: '',
  photoUrl: null,
  localPhotos: ['https://cdn.example.com/apple1.jpg'],
  status: 'active',
  notifyAt: [],
  householdId: null,
  brand: 'Orchard Fresh',
};

describe('Detail Skeletons & Screen Overlay Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      useSyncStateStore.getState().reset();
    });
  });

  afterEach(() => {
    act(() => {
      useSyncStateStore.getState().reset();
    });
  });

  describe('Skeleton Component Renders', () => {
    it('renders RecordDetailSkeleton with 4:3 hero bone, content cards, and location/notes bones', () => {
      renderWithTheme(<RecordDetailSkeleton testID="record-detail-skeleton" />, 'expyrico');
      expect(screen.getByTestId('record-detail-skeleton')).toBeTruthy();
      expect(screen.getByTestId('record-detail-location-bone')).toBeTruthy();
      expect(screen.getByTestId('record-detail-store-bone')).toBeTruthy();
      expect(screen.getByTestId('record-detail-notes-bone')).toBeTruthy();
    });

    it('renders ProductDetailSkeleton with hero bone and community review breakdown bone', () => {
      renderWithTheme(<ProductDetailSkeleton testID="product-detail-skeleton" />, 'expyrico');
      expect(screen.getByTestId('product-detail-skeleton')).toBeTruthy();
      expect(screen.getByTestId('product-detail-review-bone')).toBeTruthy();
    });

    it('renders PantryHistorySkeleton with five history record card skeleton rows', () => {
      renderWithTheme(<PantryHistorySkeleton testID="pantry-history-skeleton" />, 'expyrico');
      expect(screen.getByTestId('pantry-history-skeleton')).toBeTruthy();
      expect(screen.getByTestId('history-record-skeleton-0')).toBeTruthy();
      expect(screen.getByTestId('history-record-skeleton-4')).toBeTruthy();
    });
  });

  describe('RecordDetail Screen Mounting & Overlay Gate', () => {
    it('displays RecordDetailSkeleton while local SQLite record lookup is in flight', () => {
      (useRecordWithStatus as jest.Mock).mockReturnValue({
        record: null,
        isLoading: true,
        isResolved: false,
      });
      (useProduct as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      });

      renderWithTheme(<RecordDetail />, 'expyrico');

      expect(screen.getByTestId('record-detail-skeleton')).toBeTruthy();
      expect(screen.queryByText('Item not found')).toBeNull();
    });

    it('displays Item not found when SQLite query resolves with null record', () => {
      (useRecordWithStatus as jest.Mock).mockReturnValue({
        record: null,
        isLoading: false,
        isResolved: true,
      });
      (useProduct as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      });

      renderWithTheme(<RecordDetail />, 'expyrico');

      expect(screen.queryByTestId('record-detail-skeleton')).toBeNull();
      expect(screen.getByText('Item not found')).toBeTruthy();
    });
    it('displays retryable Unable to load item screen when record lookup yields an error', () => {
      const retryMock = jest.fn();
      (useRecordWithStatus as jest.Mock).mockReturnValue({
        record: null,
        isLoading: false,
        isResolved: true,
        isError: true,
        errorMessage: 'Network request timed out',
        retry: retryMock,
      });
      (useProduct as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      });

      renderWithTheme(<RecordDetail />, 'expyrico');

      expect(screen.queryByTestId('record-detail-skeleton')).toBeNull();
      expect(screen.getByText('Unable to load item')).toBeTruthy();
      expect(screen.getByText('Network request timed out')).toBeTruthy();
      expect(screen.queryByText('Item not found')).toBeNull();

      fireEvent.press(screen.getByText('Retry'));
      expect(retryMock).toHaveBeenCalledTimes(1);
    });
    it('end-to-end lookup: asserts skeleton—not Item not found—while lookup is pending, then mounts item details upon insertion', () => {
      let currentLookupState: any = {
        record: null,
        isLoading: true,
        isResolved: false,
        isError: false,
        errorMessage: null,
        retry: jest.fn(),
      };
      (useRecordWithStatus as jest.Mock).mockImplementation(() => currentLookupState);
      (useProduct as jest.Mock).mockReturnValue({
        data: { id: 'prod-1', name: 'Apples' },
        isLoading: false,
        isError: false,
      });

      const { rerender } = renderWithTheme(<RecordDetail />, 'expyrico');

      // 1. Initial pending lookup while sync is in flight: MUST show skeleton, NOT Item not found!
      expect(screen.getByTestId('record-detail-skeleton')).toBeTruthy();
      expect(screen.queryByText('Item not found')).toBeNull();
      expect(screen.queryByText('Crisp Apples')).toBeNull();

      // 2. Incoming sync inserts the record: state updates to resolved with record
      currentLookupState = {
        record: sampleRecord,
        isLoading: false,
        isResolved: true,
        isError: false,
        errorMessage: null,
        retry: jest.fn(),
      };

      rerender(<RecordDetail />);

      // Real item content mounts; "Item not found" is never rendered!
      expect(screen.queryByText('Item not found')).toBeNull();
      expect(screen.getByText('Crisp Apples')).toBeTruthy();
    });
    it('displays RecordDetailSkeleton when product details are loading for a catalog product', () => {
      (useRecordWithStatus as jest.Mock).mockReturnValue({
        record: { ...sampleRecord, productId: 'prod-456' },
        isLoading: false,
        isResolved: true,
      });
      (useProduct as jest.Mock).mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
      });

      renderWithTheme(<RecordDetail />, 'expyrico');

      expect(screen.getByTestId('record-detail-skeleton')).toBeTruthy();
    });

    it('mounts real layout immediately with RecordDetailSkeleton overlay while images settle', () => {
      (useRecordWithStatus as jest.Mock).mockReturnValue({
        record: sampleRecord,
        isLoading: false,
        isResolved: true,
      });
      (useProduct as jest.Mock).mockReturnValue({
        data: { id: 'prod-1', name: 'Apples' },
        isLoading: false,
        isError: false,
      });

      renderWithTheme(<RecordDetail />, 'expyrico');

      // Real screen content mounts underneath
      expect(screen.getByText('Crisp Apples')).toBeTruthy();
      // Overlay is active masking the screen while images settle
      expect(screen.getByTestId('record-detail-skeleton')).toBeTruthy();
    });

    it('multi-photo settlement invariant: overlay remains active while photos settle', () => {
      const recordWithMultiplePhotos: LocalRecord = {
        ...sampleRecord,
        localPhotos: ['https://cdn.example.com/apple1.jpg', 'https://cdn.example.com/apple2.jpg'],
      };

      (useRecordWithStatus as jest.Mock).mockReturnValue({
        record: recordWithMultiplePhotos,
        isLoading: false,
        isResolved: true,
      });
      (useProduct as jest.Mock).mockReturnValue({
        data: { id: 'prod-1', name: 'Apples' },
        isLoading: false,
        isError: false,
      });

      renderWithTheme(<RecordDetail />, 'expyrico');

      // Real screen content mounts underneath
      expect(screen.getByText('Crisp Apples')).toBeTruthy();
      // Overlay remains active until all photos settle
      expect(screen.getByTestId('record-detail-skeleton')).toBeTruthy();
    });
  });

  describe('PantryHistoryView Skeleton Gating', () => {
    it('shows PantryHistorySkeleton while history query is unresolved', () => {
      (usePantryHistoryRecordsWithStatus as jest.Mock).mockReturnValue({
        records: [],
        isLoading: true,
        isResolved: false,
      });

      renderWithTheme(<PantryHistoryView />, 'expyrico');

      // Both KPI header skeleton bones and history record list skeletons are present
      expect(screen.getByTestId('history-kpi-bone-1')).toBeTruthy();
      expect(screen.getByTestId('history-kpi-bone-2')).toBeTruthy();
      expect(screen.getByTestId('pantry-history-skeleton')).toBeTruthy();
      expect(screen.queryByText('Pantry history is empty')).toBeNull();
    });

    it('renders empty history message immediately with 0ms delay when history query resolves empty', () => {
      (usePantryHistoryRecordsWithStatus as jest.Mock).mockReturnValue({
        records: [],
        isLoading: false,
        isResolved: true,
      });

      act(() => {
        useSyncStateStore.getState().setSyncSuccess();
      });

      renderWithTheme(<PantryHistoryView />, 'expyrico');

      expect(screen.queryByTestId('pantry-history-skeleton')).toBeNull();
      expect(screen.getByText('Pantry history is empty')).toBeTruthy();
    });
  });
});
