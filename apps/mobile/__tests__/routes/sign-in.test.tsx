import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import SignIn from '../../app/(auth)/sign-in';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { useSessionStore } from '../../src/auth/session-store';
import { navigation } from '../../tests/mocks/react-navigation';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/react-native-keychain';
import { Passkey } from 'react-native-passkey';

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
    expect(navigation.replace).not.toHaveBeenCalled();
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
      expect(navigation.navigate).toHaveBeenCalledWith('VerifyEmail', { email: 'a@b.co' }),
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
    expect(navigation.replace).not.toHaveBeenCalledWith('Home');
  });

  it('keeps the Google-branded sign-in action', () => {
    const { getByTestId, getByLabelText } = render(wrap(<SignIn />));
    expect(getByTestId('sign-in-google')).toBeTruthy();
    expect(getByLabelText('Google')).toBeTruthy();
  });

  it('on 1-tap passkey: signs in with discoverable passkey without entering email', async () => {
    (Passkey.get as unknown as jest.Mock).mockResolvedValueOnce({ id: 'cred-123', rawId: 'cred-123' });
    queueFetch(
      jsonResponse({ challenge: 'chal-123', rpId: 'expyrico.invalid' }), // passkeyLoginOptions
      jsonResponse({ user: USER, tokens: { accessToken: 'tok-passkey', refreshToken: 'tok-ref', expiresIn: 900 } }), // passkeyLoginVerify
    );
    const { getByTestId } = render(wrap(<SignIn />));
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-passkey'));
    });
    await waitFor(() => expect(useSessionStore.getState().accessToken).toBe('tok-passkey'));
    expect(Passkey.get).toHaveBeenCalledTimes(1);
  });

  it('on passkey with pre-typed email: passes email as hint', async () => {
    (Passkey.get as unknown as jest.Mock).mockResolvedValueOnce({ id: 'cred-123', rawId: 'cred-123' });
    queueFetch(
      jsonResponse({ challenge: 'chal-123', rpId: 'expyrico.invalid', allowCredentials: [{ id: 'cred-123' }] }),
      jsonResponse({ user: USER, tokens: { accessToken: 'tok-hint', refreshToken: 'tok-ref', expiresIn: 900 } }),
    );
    const { getByTestId, getByLabelText } = render(wrap(<SignIn />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-passkey'));
    });
    await waitFor(() => expect(useSessionStore.getState().accessToken).toBe('tok-hint'));
  });

  it('on passkey cancellation: displays mild notice without error banner', async () => {
    (Passkey.get as unknown as jest.Mock).mockRejectedValueOnce({
      error: 'UserCancelled',
      message: 'The operation was cancelled by the user',
    });
    queueFetch(jsonResponse({ challenge: 'chal-123', rpId: 'expyrico.invalid' }));
    const { getByTestId, findByText } = render(wrap(<SignIn />));
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-passkey'));
    });
    expect(await findByText('Passkey sign-in was cancelled.')).toBeTruthy();
    expect(useSessionStore.getState().accessToken).toBeNull();
  });

  it('on Android GetCredentialCancellationException: displays mild notice', async () => {
    (Passkey.get as unknown as jest.Mock).mockRejectedValueOnce({
      error: 'RequestFailed',
      message: 'androidx.credentials.exceptions.GetCredentialCancellationException: User canceled',
    });
    queueFetch(jsonResponse({ challenge: 'chal-123', rpId: 'expyrico.invalid' }));
    const { getByTestId, findByText } = render(wrap(<SignIn />));
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-passkey'));
    });
    expect(await findByText('Passkey sign-in was cancelled.')).toBeTruthy();
  });

  it('on passkey NoCredentials: displays recovery guidance', async () => {
    (Passkey.get as unknown as jest.Mock).mockRejectedValueOnce({
      error: 'NoCredentials',
      message: 'The request failed. No Credentials were returned.',
    });
    queueFetch(jsonResponse({ challenge: 'chal-123', rpId: 'expyrico.invalid' }));
    const { getByTestId, findByText } = render(wrap(<SignIn />));
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-passkey'));
    });
    expect(await findByText(/No matching passkey is available/i)).toBeTruthy();
  });

  it('prevents rapid double-tapping on passkey button', async () => {
    let resolveGet: (val: unknown) => void = () => {};
    (Passkey.get as unknown as jest.Mock).mockImplementationOnce(
      () => new Promise((resolve) => { resolveGet = resolve; }),
    );
    queueFetch(jsonResponse({ challenge: 'chal-123', rpId: 'expyrico.invalid' }));
    const { getByTestId } = render(wrap(<SignIn />));
    await act(async () => {
      fireEvent.press(getByTestId('sign-in-passkey'));
      fireEvent.press(getByTestId('sign-in-passkey'));
    });
    expect(Passkey.get).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveGet({ id: 'cred-123' });
    });
  });
});
