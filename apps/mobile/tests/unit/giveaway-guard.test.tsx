// apps/mobile/tests/unit/giveaway-guard.test.tsx
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, act } from '@testing-library/react-native';
import RecordDetail from '../../app/(app)/record/[id]';
import {
  useRecord,
  markRecordStatusWithQuantity,
  type LocalRecord,
} from '../../src/api/records';
import { useActiveGiveawaysForRecord } from '../../src/api/giveaways';
import { renderWithTheme } from '../helpers/renderWithTheme';

jest.spyOn(Alert, 'alert');

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: mockGoBack,
      canGoBack: () => true,
    }),
    useRoute: () => ({
      params: { id: 'rec-1' },
    }),
  };
});

jest.mock('../../src/api/records', () => ({
  useRecord: jest.fn(),
  patchLocalRecord: jest.fn(),
  deleteLocalRecord: jest.fn(),
  markRecordStatusWithQuantity: jest.fn().mockResolvedValue({
    affectedId: 'rec-1',
    isSplit: false,
    markedQuantity: 1,
  }),
  restoreLocalRecord: jest.fn(),
}));

jest.mock('../../src/api/giveaways', () => ({
  useActiveGiveawaysForRecord: jest.fn(),
}));

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));

jest.mock('../../src/api/products', () => ({
  useProduct: () => ({ data: null }),
  useCreateOrResumeDraft: () => ({ mutateAsync: jest.fn() }),
  usePatchDraft: () => ({ mutateAsync: jest.fn() }),
}));

const mockRecord: LocalRecord = {
  id: 'rec-1',
  serverId: 'server-rec-1',
  clientId: 'client-rec-1',
  productId: null,
  customName: 'Peanut Butter',
  category: 'Pantry',
  expiryDate: '2026-09-30',
  quantity: 1,
  unit: 'jar',
  price: 4.5,
  store: 'Costco',
  notes: null,
  photoUrl: null,
  status: 'active',
  notifyAt: [],
  householdId: null,
  userId: 'user-1',
};

describe('Giveaway Safety Guard in RecordDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRecord as jest.Mock).mockReturnValue(mockRecord);
  });

  it('blocks marking as used/discarded when item is linked to an active giveaway and alerts user', async () => {
    (useActiveGiveawaysForRecord as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'giveaway-1',
          title: 'Free Peanut Butter',
          status: 'open',
          recordId: 'rec-1',
        },
      ],
      isLoading: false,
    });

    const { getByTestId } = renderWithTheme(<RecordDetail />, 'expyrico');

    const markUsedBtn = getByTestId('record-mark-consumed');
    await act(async () => {
      fireEvent.press(markUsedBtn);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Item Listed in Giveaway',
      expect.stringContaining('community giveaway'),
      expect.any(Array),
    );
    expect(markRecordStatusWithQuantity).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('blocks marking as discarded when item is linked to an active giveaway', async () => {
    (useActiveGiveawaysForRecord as jest.Mock).mockReturnValue({
      data: [
        {
          id: 'giveaway-1',
          title: 'Free Peanut Butter',
          status: 'claimed',
          recordId: 'rec-1',
        },
      ],
      isLoading: false,
    });

    const { getByTestId } = renderWithTheme(<RecordDetail />, 'expyrico');

    const markDiscardedBtn = getByTestId('record-mark-discarded');
    await act(async () => {
      fireEvent.press(markDiscardedBtn);
    });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Item Listed in Giveaway',
      expect.stringContaining('community giveaway'),
      expect.any(Array),
    );
    expect(markRecordStatusWithQuantity).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });
  it('allows marking when there are no active giveaways for this item', async () => {
    (useActiveGiveawaysForRecord as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
    });

    const { getByTestId } = renderWithTheme(<RecordDetail />, 'expyrico');

    const markUsedBtn = getByTestId('record-mark-consumed');
    await act(async () => {
      fireEvent.press(markUsedBtn);
    });

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(markRecordStatusWithQuantity).toHaveBeenCalledWith('rec-1', 'consumed', 1, null);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
