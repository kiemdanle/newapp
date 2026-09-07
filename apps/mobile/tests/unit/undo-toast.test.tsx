// apps/mobile/tests/unit/undo-toast.test.tsx
import React from 'react';
import { fireEvent, act } from '@testing-library/react-native';
import { UndoToast } from '../../src/components/UndoToast';
import { useUndoToastStore } from '../../src/store/undoToast';
import { restoreLocalRecord } from '../../src/api/records';
import { renderWithTheme } from '../helpers/renderWithTheme';

jest.mock('../../src/api/records', () => ({
  restoreLocalRecord: jest.fn().mockResolvedValue({
    restoredRecordId: 'rec-1',
    wasReassignedToPersonal: false,
    mergedBackToParent: false,
  }),
}));

jest.mock('../../src/api/households', () => ({
  useMyHouseholds: () => ({
    data: { items: [{ id: 'hh-1', name: 'Family' }] },
  }),
}));

describe('UndoToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useUndoToastStore.getState().dismiss();
  });

  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('renders nothing when there is no active action', () => {
    const { queryByTestId } = renderWithTheme(<UndoToast />, 'expyrico');
    expect(queryByTestId('undo-toast-container')).toBeNull();
  });

  it('renders action notification with item name and used status', () => {
    act(() => {
      useUndoToastStore.getState().show({
        recordId: 'rec-1',
        itemName: 'Organic Strawberries',
        status: 'consumed',
      });
    });

    const { getByTestId, getByText } = renderWithTheme(<UndoToast />, 'expyrico');
    expect(getByTestId('undo-toast-container')).toBeTruthy();
    expect(getByText('"Organic Strawberries" marked as used')).toBeTruthy();
    expect(getByTestId('undo-toast-button')).toBeTruthy();
  });

  it('renders action notification with quantity and discarded status for split items', () => {
    act(() => {
      useUndoToastStore.getState().show({
        recordId: 'rec-split-1',
        parentId: 'rec-1',
        isSplit: true,
        quantity: 2,
        unit: 'cans',
        itemName: 'Tomato Soup',
        status: 'discarded',
        discardReason: 'spoiled',
      });
    });

    const { getByTestId, getByText } = renderWithTheme(<UndoToast />, 'expyrico');
    expect(getByTestId('undo-toast-container')).toBeTruthy();
    expect(getByText('2 cans marked as discarded')).toBeTruthy();
  });

  it('tapping Undo calls restoreLocalRecord with recordId and split context', async () => {
    act(() => {
      useUndoToastStore.getState().show({
        recordId: 'rec-split-1',
        parentId: 'rec-1',
        isSplit: true,
        quantity: 3,
        unit: 'pcs',
        itemName: 'Avocados',
        status: 'consumed',
      });
    });

    const { getByTestId } = renderWithTheme(<UndoToast />, 'expyrico');
    const undoBtn = getByTestId('undo-toast-button');

    await act(async () => {
      fireEvent.press(undoBtn);
    });

    expect(restoreLocalRecord).toHaveBeenCalledWith(
      'rec-split-1',
      ['hh-1'],
      {
        isSplit: true,
        parentId: 'rec-1',
        quantity: 3,
      },
    );
  });

  it('tapping dismiss button hides toast', () => {
    act(() => {
      useUndoToastStore.getState().show({
        recordId: 'rec-1',
        itemName: 'Milk',
        status: 'consumed',
      });
    });

    const { getByTestId, queryByTestId } = renderWithTheme(<UndoToast />, 'expyrico');
    expect(getByTestId('undo-toast-container')).toBeTruthy();

    act(() => {
      fireEvent.press(getByTestId('undo-toast-dismiss'));
    });

    expect(queryByTestId('undo-toast-container')).toBeNull();
  });

  it('rapid successive show calls update to the latest action and resets timer', () => {
    act(() => {
      useUndoToastStore.getState().show({
        recordId: 'rec-1',
        itemName: 'Item A',
        status: 'consumed',
      });
    });

    const { getByText, queryByText } = renderWithTheme(<UndoToast />, 'expyrico');
    expect(getByText('"Item A" marked as used')).toBeTruthy();

    // Rapidly trigger item B before 6 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
      useUndoToastStore.getState().show({
        recordId: 'rec-2',
        itemName: 'Item B',
        status: 'discarded',
      });
    });

    expect(queryByText('"Item A" marked as used')).toBeNull();
    expect(getByText('"Item B" marked as discarded')).toBeTruthy();
  });

  it('auto-dismisses after 6 seconds elapses', () => {
    act(() => {
      useUndoToastStore.getState().show({
        recordId: 'rec-1',
        itemName: 'Bread',
        status: 'consumed',
      });
    });

    const { queryByTestId } = renderWithTheme(<UndoToast />, 'expyrico');
    expect(queryByTestId('undo-toast-container')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(queryByTestId('undo-toast-container')).toBeNull();
  });
});
