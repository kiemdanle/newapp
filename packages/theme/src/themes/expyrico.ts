import type { Theme } from '../tokens.js';
import { expyricoColors, expyricoDarkColors } from '../palette.js';

// Expyrico brand theme — the default. Built on the §2.10 design-system
// palette: Fresh Sage + Honey on Warm White. A light, warm, pantry-shelf
// aesthetic. Sage = freshness, Honey = the "use soon" urgency signal.
export const expyrico: Theme = {
  id: 'expyrico',
  name: 'Expyrico',
  scheme: 'light',
  colors: expyricoColors,
  radii: { none: 0, sm: 10, md: 16, lg: 22, xl: 30, pill: 999 },
  shadows: {
    none: 'none',
    sm: '0 1px 3px rgba(44,44,40,0.06), 0 1px 2px rgba(44,44,40,0.04)',
    md: '0 4px 12px -2px rgba(44,44,40,0.08), 0 2px 6px -2px rgba(44,44,40,0.05)',
    lg: '0 12px 32px -8px rgba(44,44,40,0.12), 0 4px 12px -4px rgba(44,44,40,0.06)',
    glow: '0 0 24px rgba(245,166,35,0.30)',  // Honey glow for urgency hero
  },
  typography: {
    fontFamily: 'System',
    fontFamilyDisplay: 'System',
    weightRegular: 400,
    weightMedium: 500,
    weightBold: 600,
    letterSpacingTight: -0.8,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 32 },
  elevation: {
    clay: {
      rim: 'inset 0 1px 0 rgba(255,255,255,0.8)',
      base: '0 6px 16px rgba(44,44,40,0.10)',
      ambient: '0 2px 6px rgba(44,44,40,0.06)',
    },
    md3: {
      level0: 'none',
      level1: '0 1px 2px rgba(44,44,40,0.06)',
      level2: '0 2px 4px rgba(44,44,40,0.08)',
      level3: '0 4px 8px rgba(44,44,40,0.10)',
      level4: '0 6px 12px rgba(44,44,40,0.12)',
      level5: '0 8px 16px rgba(44,44,40,0.14)',
    },
  },
  typeRamp: {
    displayLarge:   { fontSize: 48, lineHeight: 56, fontWeight: '600' },
    displayMedium:  { fontSize: 38, lineHeight: 46, fontWeight: '600' },
    displaySmall:   { fontSize: 30, lineHeight: 38, fontWeight: '600' },
    headlineLarge:  { fontSize: 28, lineHeight: 36, fontWeight: '600' },
    headlineMedium: { fontSize: 24, lineHeight: 32, fontWeight: '500' },
    headlineSmall:  { fontSize: 20, lineHeight: 28, fontWeight: '500' },
    titleLarge:     { fontSize: 18, lineHeight: 24, fontWeight: '600' },
    titleMedium:    { fontSize: 16, lineHeight: 22, fontWeight: '500' },
    titleSmall:     { fontSize: 14, lineHeight: 20, fontWeight: '500' },
    bodyLarge:      { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    bodyMedium:     { fontSize: 14, lineHeight: 20, fontWeight: '400' },
    bodySmall:      { fontSize: 12, lineHeight: 18, fontWeight: '400' },
    labelLarge:     { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    labelMedium:    { fontSize: 12, lineHeight: 16, fontWeight: '500' },
    labelSmall:     { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  },
  animation: { fast: 120, base: 220, slow: 320, themeSwitch: 200 },
};

export const expyricoDark: Theme = {
  ...expyrico,
  id: 'expyricoDark',
  name: 'Expyrico Dark',
  scheme: 'dark',
  colors: expyricoDarkColors,
  shadows: {
    none: 'none',
    sm: '0 1px 3px rgba(0,0,0,0.22), 0 1px 2px rgba(0,0,0,0.18)',
    md: '0 4px 14px -2px rgba(0,0,0,0.32), 0 2px 8px -2px rgba(0,0,0,0.22)',
    lg: '0 14px 34px -10px rgba(0,0,0,0.44), 0 4px 14px -4px rgba(0,0,0,0.28)',
    glow: '0 0 24px rgba(245,166,35,0.22)',
  },
  elevation: {
    clay: {
      rim: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      base: '0 8px 20px rgba(0,0,0,0.34)',
      ambient: '0 2px 8px rgba(0,0,0,0.24)',
    },
    md3: {
      level0: 'none',
      level1: '0 1px 2px rgba(0,0,0,0.28)',
      level2: '0 2px 5px rgba(0,0,0,0.30)',
      level3: '0 4px 10px rgba(0,0,0,0.34)',
      level4: '0 6px 14px rgba(0,0,0,0.38)',
      level5: '0 8px 18px rgba(0,0,0,0.42)',
    },
  },
};
