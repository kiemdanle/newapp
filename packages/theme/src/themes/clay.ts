import type { Theme } from '../tokens.js';
import { expyricoColors } from '../palette.js';

export const clay: Theme = {
  id: 'clay',
  name: 'Soft Clay',
  scheme: 'light',
  colors: expyricoColors,
  radii: { none: 0, sm: 10, md: 16, lg: 22, xl: 28, pill: 999 },
  shadows: {
    none: 'none',
    sm: '0 2px 6px rgba(180,83,9,0.06)',
    md: '6px 6px 16px rgba(180,83,9,0.1)',
    lg: '8px 8px 24px rgba(180,83,9,0.15)',
    glow: '0 0 0 0 transparent',
  },
  typography: {
    fontFamily: 'System',
    fontFamilyDisplay: 'System',
    weightRegular: 500,
    weightMedium: 600,
    weightBold: 800,
    letterSpacingTight: -0.5,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 32 },
  elevation: {
    clay: {
      rim: 'inset 0 2px 0 rgba(255,255,255,0.60), inset 0 -2px 0 rgba(58,42,32,0.06)',
      base: '0 8px 16px rgba(58,42,32,0.12)',
      ambient: '0 2px 6px rgba(58,42,32,0.08)',
    },
    md3: {
      level0: 'none',
      level1: '0 1px 2px rgba(58,42,32,0.06)',
      level2: '0 2px 6px rgba(58,42,32,0.08)',
      level3: '0 6px 12px rgba(58,42,32,0.10)',
      level4: '0 10px 18px rgba(58,42,32,0.12)',
      level5: '0 14px 24px rgba(58,42,32,0.14)',
    },
  },
  typeRamp: {
    displayLarge:   { fontSize: 52, lineHeight: 60, fontWeight: '800' },
    displayMedium:  { fontSize: 44, lineHeight: 52, fontWeight: '800' },
    displaySmall:   { fontSize: 36, lineHeight: 44, fontWeight: '800' },
    headlineLarge:  { fontSize: 30, lineHeight: 40, fontWeight: '700' },
    headlineMedium: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
    headlineSmall:  { fontSize: 22, lineHeight: 30, fontWeight: '700' },
    titleLarge:     { fontSize: 20, lineHeight: 28, fontWeight: '700' },
    titleMedium:    { fontSize: 16, lineHeight: 24, fontWeight: '700' },
    titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    bodyLarge:      { fontSize: 17, lineHeight: 26, fontWeight: '500' },
    bodyMedium:     { fontSize: 15, lineHeight: 22, fontWeight: '500' },
    bodySmall:      { fontSize: 13, lineHeight: 18, fontWeight: '500' },
    labelLarge:     { fontSize: 15, lineHeight: 22, fontWeight: '700' },
    labelMedium:    { fontSize: 13, lineHeight: 18, fontWeight: '700' },
    labelSmall:     { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  },
  animation: { fast: 150, base: 250, slow: 350, themeSwitch: 200 },
};
