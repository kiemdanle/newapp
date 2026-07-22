import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VerifyResetCode from '../../app/(auth)/verify-reset-code';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { navigation, __setRouteParams } from '../../tests/mocks/react-navigation';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/react-native-keychain';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<VerifyResetCode />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    __setRouteParams({});
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('submits the code and pushes to reset-password with the ticket', async () => {
    const fetchMock = queueFetch(jsonResponse({ resetTicket: 'tkt-123' }));
    __setRouteParams({ email: 'a@b.co' });

    const { getByLabelText } = render(wrap(<VerifyResetCode />));
    await act(async () => {
      fireEvent.changeText(getByLabelText('Reset code'), '123456');
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ email: 'a@b.co', code: '123456' });
    expect(navigation.navigate).toHaveBeenCalledWith('ResetPassword', { ticket: 'tkt-123' });
  });

  it('shows a request-a-new-code path after a failed verify', async () => {
    queueFetch(problemResponse('invalid_token', 400, 'Invalid or expired code'));
    __setRouteParams({ email: 'a@b.co' });

    const { getByLabelText, findByText } = render(wrap(<VerifyResetCode />));
    await act(async () => {
      fireEvent.changeText(getByLabelText('Reset code'), '000000');
    });

    expect(await findByText('Invalid or expired code')).toBeTruthy();
    expect(await findByText("That code didn't work. Request a new one below.")).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('resend requests a new code and reports it replaces the old one', async () => {
    const fetchMock = queueFetch(new Response(null, { status: 204 }));
    __setRouteParams({ email: 'a@b.co' });

    const { getByTestId, findByText } = render(wrap(<VerifyResetCode />));
    await act(async () => {
      fireEvent.press(getByTestId('verify-reset-resend'));
    });

    await findByText('New code sent. It replaces any earlier code.');
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ email: 'a@b.co' });
  });

  it('uses the shared segmented OTP input with a visible expiry notice and icon-bearing recovery controls', () => {
    __setRouteParams({ email: 'a@b.co' });
    const { getByLabelText, getByText, getByTestId } = render(wrap(<VerifyResetCode />));

    expect(getByLabelText('Reset code')).toBeTruthy();
    expect(getByText('Code expires in 10 minutes')).toBeTruthy();
    expect(getByTestId('verify-reset-resend').findByProps({ name: 'refresh-outline' })).toBeTruthy();
    expect(getByTestId('verify-reset-start-over')).toBeTruthy();
  });
});
