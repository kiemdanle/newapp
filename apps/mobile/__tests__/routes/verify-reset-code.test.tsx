import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VerifyResetCode from '../../app/(auth)/verify-reset-code';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { router, __setSearchParams } from '../../tests/mocks/expo-router';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<VerifyResetCode />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    __setSearchParams({});
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('submits the code and pushes to reset-password with the ticket', async () => {
    const fetchMock = queueFetch(jsonResponse({ resetTicket: 'tkt-123' }));
    __setSearchParams({ email: 'a@b.co' });

    const { getByLabelText } = render(wrap(<VerifyResetCode />));
    await act(async () => {
      fireEvent.changeText(getByLabelText('Reset code'), '123456');
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ email: 'a@b.co', code: '123456' });
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/reset-password',
      params: { ticket: 'tkt-123' },
    });
  });

  it('shows a request-a-new-code path after a failed verify', async () => {
    queueFetch(problemResponse('invalid_token', 400, 'Invalid or expired code'));
    __setSearchParams({ email: 'a@b.co' });

    const { getByLabelText, findByText } = render(wrap(<VerifyResetCode />));
    await act(async () => {
      fireEvent.changeText(getByLabelText('Reset code'), '000000');
    });

    expect(await findByText('Invalid or expired code')).toBeTruthy();
    expect(await findByText("That code didn't work. Request a new one below.")).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('resend requests a new code and reports it replaces the old one', async () => {
    const fetchMock = queueFetch(new Response(null, { status: 204 }));
    __setSearchParams({ email: 'a@b.co' });

    const { getByTestId, findByText } = render(wrap(<VerifyResetCode />));
    await act(async () => {
      fireEvent.press(getByTestId('verify-reset-resend'));
    });

    await findByText('New code sent. It replaces any earlier code.');
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ email: 'a@b.co' });
  });
});
