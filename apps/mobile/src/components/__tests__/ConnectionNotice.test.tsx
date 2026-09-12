jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConnectionNotice } from '../ConnectionNotice';
import { useConnectionStore } from '../../store/connectionStore';

describe('ConnectionNotice', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset();
  });

  it('renders offline title and description when status is offline', () => {
    useConnectionStore.setState({
      status: 'offline',
      clientOnline: false,
      serverReady: false,
    });

    const { getByText, getByTestId } = render(<ConnectionNotice />);
    expect(getByText('No Internet Connection')).toBeTruthy();
    expect(getByText(/Please check your Wi-Fi or mobile network/)).toBeTruthy();
    expect(getByText('Offline • Check network settings')).toBeTruthy();
    expect(getByTestId('connection-retry-button')).toBeTruthy();
  });

  it('renders server unreachable title when status is server_unreachable', () => {
    useConnectionStore.setState({
      status: 'server_unreachable',
      clientOnline: true,
      serverReady: false,
    });

    const { getByText } = render(<ConnectionNotice />);
    expect(getByText("Can't Connect to Server")).toBeTruthy();
    expect(getByText(/We are unable to reach the Expyrico server right now/)).toBeTruthy();
    expect(getByText('Internet Active • Server Unreachable')).toBeTruthy();
  });

  it('triggers retry when Try Again button is pressed', () => {
    const retrySpy = jest.fn();
    useConnectionStore.setState({
      status: 'offline',
      retry: retrySpy,
    });

    const { getByTestId } = render(<ConnectionNotice />);
    const retryButton = getByTestId('connection-retry-button');
    fireEvent.press(retryButton);

    expect(retrySpy).toHaveBeenCalledTimes(1);
  });

  it('shows checking connection spinner when isRetrying is true', () => {
    useConnectionStore.setState({
      status: 'offline',
      isRetrying: true,
    });

    const { getByText } = render(<ConnectionNotice />);
    expect(getByText('Checking Connection...')).toBeTruthy();
  });
});
