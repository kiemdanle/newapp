import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { HistoryRecordCard } from './HistoryRecordCard';
import type { LocalRecord } from '../../api/records';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockConsumedRecord: LocalRecord = {
  id: 'hist-1',
  serverId: 'srv-hist-1',
  clientId: 'cli-hist-1',
  productId: 'prod-hist-1',
  customName: 'Yogurt Pack',
  category: 'Dairy',
  expiryDate: '2026-10-10',
  quantity: 2,
  unit: 'pack',
  price: 3.0,
  store: 'VinMart',
  notes: '',
  photoUrl: null,
  localPhotos: null,
  status: 'consumed',
  consumedAt: '2026-09-10T12:00:00.000Z',
  discardedAt: null,
  discardReason: null,
  notifyAt: [],
  householdId: null,
  brand: 'Vinamilk',
};

function renderWithProviders(ui: React.ReactElement, queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('HistoryRecordCard', () => {
  it('renders item details, consumed status badge, and restore button', () => {
    const onRestore = jest.fn();
    const onPress = jest.fn();
    const { getByText, getByTestId } = renderWithProviders(
      <HistoryRecordCard
        record={mockConsumedRecord}
        onRestore={onRestore}
        onPress={onPress}
        userCountry="VN"
      />,
    );

    expect(getByText('Yogurt Pack')).toBeTruthy();
    expect(getByText(/2 pack/)).toBeTruthy();
    expect(getByText(/Used/)).toBeTruthy();
    expect(getByTestId('history-restore-hist-1')).toBeTruthy();

    fireEvent.press(getByTestId('history-restore-hist-1'));
    expect(onRestore).toHaveBeenCalledWith(mockConsumedRecord);
  });

  it('renders discarded status badge and reason when item was discarded', () => {
    const discardedRecord: LocalRecord = {
      ...mockConsumedRecord,
      id: 'hist-discarded',
      status: 'discarded',
      discardedAt: '2026-09-12T10:00:00.000Z',
      discardReason: 'expired',
    };

    const { getByText } = renderWithProviders(
      <HistoryRecordCard
        record={discardedRecord}
        onRestore={jest.fn()}
        onPress={jest.fn()}
        userCountry="VN"
      />,
    );

    expect(getByText(/Discarded/)).toBeTruthy();
    expect(getByText('Expired')).toBeTruthy();
  });

  it('renders ProductThumbnail with 56x56 dimensions while loading', () => {
    const { getByTestId } = renderWithProviders(
      <HistoryRecordCard
        record={mockConsumedRecord}
        onRestore={jest.fn()}
        onPress={jest.fn()}
        userCountry="VN"
      />,
    );

    const skeleton = getByTestId('product-thumbnail-skeleton');
    expect(skeleton).toBeTruthy();
    expect(skeleton.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 56, height: 56 }),
      ]),
    );
  });

  it('renders fallback icon with 56x56 dimensions when record has no product and no photo', () => {
    const recordNoProduct = { ...mockConsumedRecord, productId: null };
    const { getByTestId } = renderWithProviders(
      <HistoryRecordCard
        record={recordNoProduct}
        onRestore={jest.fn()}
        onPress={jest.fn()}
        userCountry="VN"
      />,
    );

    const fallback = getByTestId('product-thumbnail-fallback');
    expect(fallback).toBeTruthy();
    expect(fallback.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 56, height: 56 }),
      ]),
    );
  });
});
