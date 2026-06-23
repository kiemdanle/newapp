import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import AddPasskey from '../../app/(app)/settings/add-passkey';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { useSessionStore } from '../../src/auth/session-store';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';
import { Passkey } from 'react-native-passkey';
import { secureStore } from '../../src/auth/secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<AddPasskey />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: null, accessToken: 'a', refreshToken: 'r', hydrated: true });
    await secureStore.setAccessToken('a');
  });

  it('on success: requests options, registers, verifies, shows confirmation', async () => {
    (Passkey.create as unknown as jest.Mock).mockResolvedValueOnce({ id: 'cred-1' });
    queueFetch(
      jsonResponse({ challenge: 'abc', rp: { id: 'localhost' } }), // register/options
      jsonResponse({ ok: true }), // register/verify
    );
    const { getByTestId, findByText } = render(wrap(<AddPasskey />));
    await act(async () => {
      fireEvent.press(getByTestId('add-passkey-submit'));
    });
    await waitFor(() => expect(Passkey.create).toHaveBeenCalledTimes(1));
    expect(await findByText(/passkey added/i)).toBeTruthy();
  });

  it('on register/options error: surfaces the message and never calls Passkey.create', async () => {
    queueFetch(problemResponse('passkey_not_allowed', 400, 'Passkeys are not allowed here'));
    const { getByTestId, findByText } = render(wrap(<AddPasskey />));
    await act(async () => {
      fireEvent.press(getByTestId('add-passkey-submit'));
    });
    expect(await findByText('Passkeys are not allowed here')).toBeTruthy();
    expect(Passkey.create).not.toHaveBeenCalled();
  });
});
