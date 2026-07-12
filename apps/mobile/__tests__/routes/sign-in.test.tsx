import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import SignIn from '../../app/(auth)/sign-in';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { useSessionStore } from '../../src/auth/session-store';
import { router } from '../../tests/mocks/expo-router';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';

const USER = {
  id: 'u1',
  email: 'a@b.co',
  emailVerified: true,
  firstName: 'A',
  lastName: 'B',
  country: null,
  avatarUrl: null,
  role: 'user' as const,
  status: 'active' as const,
  themePreference: 'expyrico' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<SignIn />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: true });
  });

  it('on success: signs in and routes to home', async () => {
    queueFetch(
      jsonResponse({ user: USER, tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 } }),
    );
    const { getByTestId, getByLabelText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    await waitFor(() => expect(useSessionStore.getState().accessToken).toBe('a'));
    expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)/home');
  });

  it('on invalid credentials: surfaces an error', async () => {
    queueFetch(problemResponse('invalid_credentials', 401, 'Invalid email or password'));
    const { getByTestId, getByLabelText, findByText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    expect(await findByText('Invalid email or password')).toBeTruthy();
  });

  it('on email_not_verified: routes to verify-email', async () => {
    queueFetch(problemResponse('email_not_verified', 403, 'Verify your email first'));
    const { getByTestId, getByLabelText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/(auth)/verify-email',
        params: { email: 'a@b.co' },
      }),
    );
  });

  it('on TOTP challenge: surfaces the admin-web hint and does not sign in', async () => {
    queueFetch(jsonResponse({ requiresTotp: true, challengeToken: 'tok-123' }));
    const { getByTestId, getByLabelText, findByText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'admin@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-submit'));
    });
    expect(await findByText(/admin TOTP/i)).toBeTruthy();
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(router.replace).not.toHaveBeenCalledWith('/(app)/(tabs)/home');
  });
});
