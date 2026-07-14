import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, useColorScheme, View } from 'react-native';
import { themes, type Theme, type ThemeId } from '@expyrico/theme';
import { useThemeStore } from './store';
import { isThemePreference, type ThemePreference } from '../auth/secure-store';

export const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Optional initial theme id — applied to the store on first mount. */
  initial?: ThemePreference;
}

export function ThemeProvider({ children, initial }: ThemeProviderProps) {
  // Apply the initial prop exactly once on mount (before paint via layout effect would be ideal,
  // but useEffect is fine here because the store starts in a hydrated=false state).
  useEffect(() => {
    if (initial && isThemePreference(initial)) {
      useThemeStore.setState({ themeId: initial, hydrated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const themeId = useThemeStore((s) => s.themeId);
  const colorScheme = useColorScheme();
  const resolvedThemeId: ThemeId =
    themeId === 'system' ? (colorScheme === 'dark' ? 'expyricoDark' : 'expyrico') : themeId;
  const theme = themes[resolvedThemeId];
  const fade = useRef(new Animated.Value(1)).current;
  const prevId = useRef(resolvedThemeId);

  useEffect(() => {
    if (prevId.current === resolvedThemeId) return;
    prevId.current = resolvedThemeId;
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: theme.animation.themeSwitch, // 200ms per spec §2.10
      useNativeDriver: true,
    }).start();
  }, [resolvedThemeId, fade, theme.animation.themeSwitch]);

  const value = useMemo(() => theme, [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <Animated.View style={[styles.root, { opacity: fade, backgroundColor: theme.colors.bg }]}>
        <View style={styles.fill}>{children}</View>
      </Animated.View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function useThemeSwitcher() {
  return useThemeStore((s) => ({ themeId: s.themeId, setTheme: s.setTheme }));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
