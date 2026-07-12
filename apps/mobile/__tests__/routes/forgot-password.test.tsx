import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import ForgotPassword from '../../app/(auth)/forgot-password';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { router, __setSearchParams } from '../../tests/mocks/expo-router';
import { queueFetch } from '../../tests/mocks/fetch';
import { __reset } from '../../tests/mocks/expo-secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<ForgotPassword />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    __setSearchParams({});
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('submits email and navigates to the code screen with the email param', async () => {
    const fetchMock = queueFetch(new Response(null, { status: 204 }));

    const { getByLabelText, getByTestId } = render(wrap(<ForgotPassword />));
    fireEvent.changeText(getByLabelText('Email'), 'a@b.co');
    await act(async () => {
      fireEvent.press(getByTestId('forgot-submit'));
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(request).toEqual({ email: 'a@b.co' });
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/(auth)/verify-reset-code',
      params: { email: 'a@b.co' },
    });
  });
});
