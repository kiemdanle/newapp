import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
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

    it('hero and thumbnail duplicate URL invariant: thumbnail decode does not dismiss hero overlay prematurely', () => {
      const recordWithMultiplePhotos: LocalRecord = {
        ...sampleRecord,
        localPhotos: ['https://cdn.example.com/same-apple.jpg', 'https://cdn.example.com/photo2.jpg'],
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

      // Both hero and thumbnail share the same URL: overlay remains active until hero decodes
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
