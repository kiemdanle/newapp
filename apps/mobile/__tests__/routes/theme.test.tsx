// apps/mobile/__tests__/routes/theme.test.tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ThemeSettings from '../../app/(app)/settings/theme';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../src/theme/store';
import { __reset } from '../../tests/mocks/expo-secure-store';

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

  it('tapping a card sets the active theme in the store', async () => {
    const { getByTestId } = render(wrap(<ThemeSettings />));
    await act(async () => {
      fireEvent.press(getByTestId('theme-card-expyricoDark'));
    });
    expect(useThemeStore.getState().themeId).toBe('expyricoDark');
  });
});
