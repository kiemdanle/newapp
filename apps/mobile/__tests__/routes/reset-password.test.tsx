import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ResetPassword from '../../app/(auth)/reset-password';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { navigation, __setRouteParams } from '../../tests/mocks/react-navigation';
import { queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/react-native-keychain';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<ResetPassword />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    __setRouteParams({});
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('submits the ticket + new password and shows the done state', async () => {
    const fetchMock = queueFetch(new Response(null, { status: 204 }));
    __setRouteParams({ ticket: 'tkt-123' });

    const { getByLabelText, getByTestId, findByText } = render(wrap(<ResetPassword />));
    await act(async () => {
      fireEvent.changeText(getByLabelText('New password'), 'a-new-correct-horse-1234');
    });
    await act(async () => {
      fireEvent.press(getByTestId('reset-submit'));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ resetTicket: 'tkt-123', password: 'a-new-correct-horse-1234' });
    expect(await findByText('Sign in with your new password.')).toBeTruthy();
  });

  it('shows a start-over CTA when the ticket is missing', async () => {
    __setRouteParams({});

    const { getByTestId, queryByLabelText } = render(wrap(<ResetPassword />));
    // No password field is offered without a ticket.
    expect(queryByLabelText('New password')).toBeNull();

    fireEvent.press(getByTestId('reset-start-over'));
    expect(navigation.replace).toHaveBeenCalledWith('ForgotPassword');
  });
});
