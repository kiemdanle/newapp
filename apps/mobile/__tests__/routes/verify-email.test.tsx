import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import VerifyEmail from '../../app/(auth)/verify-email';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { useSessionStore } from '../../src/auth/session-store';
import { router, __setSearchParams } from '../../tests/mocks/expo-router';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<VerifyEmail />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    __setSearchParams({});
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({
      user: {
        id: 'u1',
        email: 'a@b.co',
        emailVerified: false,
        firstName: 'A',
        lastName: 'B',
        country: null,
        avatarUrl: null,
        role: 'user',
        status: 'active',
        themePreference: 'expyrico',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      accessToken: 'a',
      refreshToken: 'r',
      hydrated: true,
    });
  });

  it('submits the 6-digit code and routes to home', async () => {
    const fetchMock = queueFetch(jsonResponse({ verified: true }));
    __setSearchParams({ email: 'a@b.co' });

    const { getByLabelText } = render(wrap(<VerifyEmail />));
    await act(async () => {
      fireEvent.changeText(getByLabelText('Verification code'), '123456');
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ email: 'a@b.co', code: '123456' });
    expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)/home');
  });

  it('surfaces an invalid code error', async () => {
    queueFetch(problemResponse('invalid_token', 400, 'Invalid or expired code'));
    __setSearchParams({ email: 'a@b.co' });

    const { getByLabelText, findByText } = render(wrap(<VerifyEmail />));
    fireEvent.changeText(getByLabelText('Verification code'), '000000');

    expect(await findByText('Invalid or expired code')).toBeTruthy();
  });

  it('resends a verification code', async () => {
    const fetchMock = queueFetch(new Response(null, { status: 204 }));
    __setSearchParams({ email: 'a@b.co' });

    const { getByTestId, findByText } = render(wrap(<VerifyEmail />));
    await act(async () => {
      fireEvent.press(getByTestId('verify-resend'));
    });

    await findByText('Verification code sent. Check your inbox.');
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ email: 'a@b.co' });
  });
});
