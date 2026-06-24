import type { Theme } from '../tokens.js';

// Expyrico brand theme — the default. Built on the §2.10 design-system
// palette: Fresh Sage + Honey on Warm White. A light, warm, pantry-shelf
// aesthetic. Sage = freshness, Honey = the "use soon" urgency signal.
export const expyrico: Theme = {
  id: 'expyrico',
  name: 'Expyrico',
  scheme: 'light',
  colors: {
    bg: '#FAFAF8',            // Warm White — main background
    bgElevated: '#FFFFFF',    // pure white cards on warm white for crisp lift
    bgGlass: '#D6F0E6',       // Mint Mist — soft panels, success highlights
    border: '#F0F0ED',        // Stone — dividers, section backgrounds
    text: '#2C2C28',          // Almost Black — primary text
    textMuted: '#8C8C85',     // Pebble — secondary text, icons
    textInverse: '#2C2C28',   // Almost Black on sage/honey for AA contrast
    primary: '#4BAE8A',       // Fresh Sage — logo, headers, active states
    primaryFg: '#2C2C28',     // Almost Black on sage for AA contrast
    accent: '#F5A623',        // Honey — CTAs, badges, expiring-soon
    success: '#4BAE8A',       // Good = reuses primary
    warning: '#F5A623',       // Expiring soon = reuses accent
    danger: '#E0442A',        // Alert Red — expired status only, never branding
    hero: '#3A8F6F',          // Deep Sage — hero card background
    heroFg: '#2C2C28',        // Almost Black on deep sage for legibility
  },
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
    labelLarge:     { fontSize: 14, lineHeight: 20, fontWeight: '600' },
    labelMedium:    { fontSize: 12, lineHeight: 16, fontWeight: '500' },
    labelSmall:     { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  },
  animation: { fast: 120, base: 220, slow: 320, themeSwitch: 200 },
};
