import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import SettingsIndex from '../../app/(app)/settings/index';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { router } from '../../tests/mocks/expo-router';
import { __reset } from '../../tests/mocks/expo-secure-store';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<SettingsIndex />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('renders grouped rows for household, appearance, and passkeys', () => {
    const { getByTestId } = render(wrap(<SettingsIndex />));
    expect(getByTestId('settings-row-theme')).toBeTruthy();
    expect(getByTestId('settings-row-household')).toBeTruthy();
    expect(getByTestId('settings-row-add-passkey')).toBeTruthy();
  });

  it('tapping Theme routes to the theme screen', () => {
    const { getByTestId } = render(wrap(<SettingsIndex />));
    fireEvent.press(getByTestId('settings-row-theme'));
    expect(router.push).toHaveBeenCalledWith('/(app)/settings/theme');
  });
});
