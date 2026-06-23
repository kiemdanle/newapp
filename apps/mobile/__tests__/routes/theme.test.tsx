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
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('renders a card for each of the four themes', () => {
    const { getByTestId } = render(wrap(<ThemeSettings />));
    expect(getByTestId('theme-card-expyrico')).toBeTruthy();
    expect(getByTestId('theme-card-bento')).toBeTruthy();
    expect(getByTestId('theme-card-clay')).toBeTruthy();
    expect(getByTestId('theme-card-material')).toBeTruthy();
  });

  it('tapping a card sets the active theme in the store', async () => {
    const { getByTestId } = render(wrap(<ThemeSettings />));
    await act(async () => {
      fireEvent.press(getByTestId('theme-card-clay'));
    });
    expect(useThemeStore.getState().themeId).toBe('clay');
  });
});
