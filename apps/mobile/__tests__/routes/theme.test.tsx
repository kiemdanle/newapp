// apps/mobile/__tests__/routes/theme.test.tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, useColorScheme } from 'react-native';
import ThemeSettings from '../../app/(app)/settings/theme';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { __reset } from '../../tests/mocks/react-native-keychain';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<ThemeSettings />', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'system', hydrated: false });
    await initThemeStore();
  });

  it('renders only System, Light, and Dark appearance cards', () => {
    const { getByTestId, queryByTestId } = render(wrap(<ThemeSettings />));
    expect(getByTestId('theme-card-system')).toBeTruthy();
    expect(getByTestId('theme-card-expyrico')).toBeTruthy();
    expect(getByTestId('theme-card-expyricoDark')).toBeTruthy();
    expect(queryByTestId('theme-card-bento')).toBeNull();
    expect(queryByTestId('theme-card-clay')).toBeNull();
    expect(queryByTestId('theme-card-material')).toBeNull();
  });

  it('lays out System above a non-wrapping flexible Light and Dark pair', () => {
    const { getByTestId } = render(wrap(<ThemeSettings />));
    const systemStyle = StyleSheet.flatten(getByTestId('theme-card-system').props.style);
    const lightStyle = StyleSheet.flatten(getByTestId('theme-card-expyrico').props.style);
    const darkStyle = StyleSheet.flatten(getByTestId('theme-card-expyricoDark').props.style);

    expect(systemStyle).toMatchObject({ width: '100%', minHeight: 48 });
    expect(lightStyle).toMatchObject({ flexBasis: 0, flexGrow: 1, minHeight: 48 });
    expect(darkStyle).toMatchObject({ flexBasis: 0, flexGrow: 1, minHeight: 48 });
    expect(lightStyle.width).toBeUndefined();
    expect(darkStyle.width).toBeUndefined();
  });

  it('tapping a card sets the active theme in the store', async () => {
    const { getByTestId } = render(wrap(<ThemeSettings />));
    await act(async () => {
      fireEvent.press(getByTestId('theme-card-expyricoDark'));
    });
    expect(useThemeStore.getState().themeId).toBe('expyricoDark');
  });

  it('accurately displays Device dark or Device light based on system color scheme', async () => {
    const colorSchemeSpy = jest.spyOn(require('react-native'), 'useColorScheme').mockReturnValue('dark');
    const { getByText, rerender } = render(wrap(<ThemeSettings />));

    expect(getByText('Device dark')).toBeTruthy();

    // Select Light theme in-app
    await act(async () => {
      useThemeStore.getState().setTheme('expyrico');
    });
    rerender(wrap(<ThemeSettings />));

    // System card MUST still display "Device dark" because device OS is in dark mode
    expect(getByText('Device dark')).toBeTruthy();

    // Now mock system scheme as light
    colorSchemeSpy.mockReturnValue('light');
    rerender(wrap(<ThemeSettings />));
    expect(getByText('Device light')).toBeTruthy();

    colorSchemeSpy.mockRestore();
  });
});
