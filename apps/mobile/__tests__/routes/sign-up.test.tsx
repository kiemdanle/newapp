import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import SignUp from '../../app/(auth)/sign-up';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { useThemeStore, initThemeStore } from '../../src/theme/store';
import { useSessionStore } from '../../src/auth/session-store';
import { router } from '../../tests/mocks/expo-router';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<SignUp />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: true });
  });

  it('shows validation errors when fields are empty', async () => {
    const { getByTestId, findAllByText } = render(wrap(<SignUp />));
    fireEvent.press(getByTestId('sign-up-submit'));
    // Empty form fails several field rules at once, so assert at least one shows.
    expect((await findAllByText(/required|invalid|at least/i)).length).toBeGreaterThan(0);
  });

  it('on success: stores tokens and routes to verify-email', async () => {
    queueFetch(
      jsonResponse(
        {
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
          tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
        },
        201,
      ),
    );
    const { getByTestId, getByLabelText } = render(wrap(<SignUp />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    fireEvent.changeText(getByLabelText('First name'), 'A');
    fireEvent.changeText(getByLabelText('Last name'), 'B');
    await act(async () => {
      fireEvent.press(getByTestId('sign-up-submit'));
    });
    await waitFor(() => expect(useSessionStore.getState().accessToken).toBe('a'));
    expect(router.replace).toHaveBeenCalledWith('/(auth)/verify-email');
  });

  it('on duplicate email: surfaces the error message', async () => {
    queueFetch(problemResponse('email_already_registered', 409, 'Email already registered'));
    const { getByTestId, getByLabelText, findByText } = render(wrap(<SignUp />));
    fireEvent.changeText(getByLabelText('Email'), 'dupe@b.co');
    fireEvent.changeText(getByLabelText('Password'), 'correct-horse-battery-staple');
    fireEvent.changeText(getByLabelText('First name'), 'A');
    fireEvent.changeText(getByLabelText('Last name'), 'B');
    await act(async () => {
      fireEvent.press(getByTestId('sign-up-submit'));
    });
    expect(await findByText('Email already registered')).toBeTruthy();
  });
});
