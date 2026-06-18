/**
 * Theme token shape. Every theme must implement this exact contract.
 */
export type ThemeId = 'expyrico' | 'bento' | 'clay' | 'material';

export interface ColorTokens {
  bg: string;
  bgElevated: string;
  bgGlass: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryFg: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  /** Used by the home expiry hero card */
  hero: string;
  heroFg: string;
}

export interface RadiusTokens {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

export interface ShadowTokens {
  none: string;
  sm: string;
  md: string;
  lg: string;
  glow: string;
}

export interface TypographyTokens {
  fontFamily: string;
  fontFamilyDisplay: string;
  weightRegular: number;
  weightMedium: number;
  weightBold: number;
  letterSpacingTight: number;
}

export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface AnimationTokens {
  fast: number;
  base: number;
  slow: number;
  themeSwitch: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  radii: RadiusTokens;
  shadows: ShadowTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  animation: AnimationTokens;
}
