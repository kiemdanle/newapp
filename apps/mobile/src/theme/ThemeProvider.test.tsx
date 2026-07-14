import React from 'react';
import { Text } from 'react-native';
import { render, waitFor, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme, useThemeSwitcher } from './ThemeProvider';
import { useThemeStore, initThemeStore } from './store';
import { __reset } from '../../tests/mocks/expo-secure-store';

function Probe() {
  const theme = useTheme();
  return (
    <Text testID="probe">
      {theme.id}:{theme.name}
    </Text>
  );
}

function SwitcherProbe() {
  const { themeId } = useThemeSwitcher();
  return <Text testID="switcher-probe">{themeId}</Text>;
}

describe('ThemeProvider', () => {
  beforeEach(async () => {
    __reset();
    useThemeStore.setState({ themeId: 'system', hydrated: false });
    await initThemeStore();
  });

  it('provides Expyrico tokens by default', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.children.join('')).toBe('expyrico:Expyrico');
  });

  it('re-renders children when the store theme changes', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await act(async () => {
      await useThemeStore.getState().setTheme('expyricoDark');
    });
    await waitFor(() => {
      expect(getByTestId('probe').props.children.join('')).toContain('expyricoDark:');
    });
  });

  it('honours the `initial` prop on first mount', async () => {
    useThemeStore.setState({ themeId: 'system', hydrated: false });
    const { getByTestId } = render(
      <ThemeProvider initial="expyrico">
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('probe').props.children.join('')).toBe('expyrico:Expyrico');
    });
    expect(useThemeStore.getState().themeId).toBe('expyrico');
  });

  it('does not activate a legacy theme passed through the initial prop', async () => {
    const legacyTheme = 'clay' as unknown as import('../auth/secure-store').ThemePreference;
    const { getByTestId } = render(
      <ThemeProvider initial={legacyTheme}>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(getByTestId('probe').props.children.join('')).toBe('expyrico:Expyrico');
    });
    expect(useThemeStore.getState().themeId).toBe('system');
  });

  it('useThemeSwitcher.setTheme updates the store and themeId reflects the new id', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <SwitcherProbe />
      </ThemeProvider>,
    );
    await act(async () => {
      await useThemeStore.getState().setTheme('expyricoDark');
    });
    await waitFor(() => {
      expect(getByTestId('switcher-probe').props.children).toBe('expyricoDark');
    });
    expect(useThemeStore.getState().themeId).toBe('expyricoDark');
  });
});
