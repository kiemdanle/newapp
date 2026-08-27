import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { RecordList } from './RecordList';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runSync } from '../../db/sync';

jest.mock('../../db/sync', () => ({
  runSync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../api/records', () => ({
  useActiveRecords: jest.fn(() => [
    {
      id: 'rec-1',
      serverId: 'srv-1',
      clientId: 'cli-1',
      productId: null,
      customName: 'Milk',
      category: 'Dairy',
      expiryDate: '2026-12-31',
      quantity: 1,
      unit: 'bottle',
      price: null,
      store: null,
      notes: null,
      photoUrl: null,
      status: 'active',
      notifyAt: [],
      householdId: null,
    },
  ]),
  patchLocalRecord: jest.fn().mockResolvedValue(undefined),
  deleteLocalRecord: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
  }),
}));

function renderWithProviders(ui: React.ReactElement, queryClient?: QueryClient) {
  const qc =
    queryClient ||
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('RecordList pull-to-refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders SectionList with RefreshControl configured for spinning reload', () => {
    const { getByTestId } = renderWithProviders(<RecordList />);

    const list = getByTestId('pantry-record-list');
    expect(list.props.refreshControl).toBeTruthy();
    expect(list.props.refreshControl.props.refreshing).toBe(false);
    expect(list.props.alwaysBounceVertical).toBe(true);
  });

  it('triggers default runSync and query invalidation on pull-to-refresh', async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { getByTestId } = renderWithProviders(<RecordList />, queryClient);
    const list = getByTestId('pantry-record-list');
    const onRefresh = list.props.refreshControl.props.onRefresh;

    expect(typeof onRefresh).toBe('function');

    await act(async () => {
      await onRefresh();
    });

    expect(runSync).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['households'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['records'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
  });
  it('supports custom refreshing and onRefresh handler', async () => {
    const onRefreshMock = jest.fn();
    const { getByTestId } = renderWithProviders(
      <RecordList refreshing={true} onRefresh={onRefreshMock} />,
    );

    const list = getByTestId('pantry-record-list');
    expect(list.props.refreshControl.props.refreshing).toBe(true);

    const onRefresh = list.props.refreshControl.props.onRefresh;
    await act(async () => {
      await onRefresh();
    });

    expect(onRefreshMock).toHaveBeenCalledTimes(1);
    expect(runSync).not.toHaveBeenCalled();
  });
});
