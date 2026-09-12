import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ConnectionNoticeModal } from '../ConnectionNoticeModal';
import { useConnectionStore } from '../../store/connectionStore';
import { useConnectionGuardStore } from '../../store/connectionGuardStore';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}));

describe('ConnectionNoticeModal', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
    useConnectionGuardStore.getState().closeModal();
  });

  it('renders modal with action title when isModalVisible is true', () => {
    useConnectionStore.setState({ status: 'offline' });
    useConnectionGuardStore.setState({
      isModalVisible: true,
      actionName: 'Add Pantry Item',
    });

    const { getByText, getByTestId } = render(<ConnectionNoticeModal />);
    expect(getByText('Connection Required for Add Pantry Item')).toBeTruthy();
    expect(getByText(/This action requires an active server connection/)).toBeTruthy();
    expect(getByText('Offline • Check network settings')).toBeTruthy();
    expect(getByTestId('modal-retry-button')).toBeTruthy();
    expect(getByTestId('modal-dismiss-button')).toBeTruthy();
  });

  it('dismisses modal when Keep Browsing is pressed', () => {
    useConnectionStore.setState({ status: 'offline' });
    useConnectionGuardStore.setState({
      isModalVisible: true,
      actionName: 'Add Pantry Item',
    });

    const { getByTestId } = render(<ConnectionNoticeModal />);
    fireEvent.press(getByTestId('modal-dismiss-button'));

    expect(useConnectionGuardStore.getState().isModalVisible).toBe(false);
  });

  it('retries and executes pending action when Try Again resolves to ready', async () => {
    const callback = jest.fn();
    const retryMock = jest.fn().mockResolvedValue({
      status: 'ready',
      clientOnline: true,
      serverReady: true,
    });

    useConnectionStore.setState({
      status: 'offline',
      retry: retryMock,
    });
    useConnectionGuardStore.setState({
      isModalVisible: true,
      actionName: 'Add Pantry Item',
      pendingCallback: callback,
    });

    const { getByTestId } = render(<ConnectionNoticeModal />);
    fireEvent.press(getByTestId('modal-retry-button'));

    expect(retryMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
      expect(useConnectionGuardStore.getState().isModalVisible).toBe(false);
    });
  });
});
