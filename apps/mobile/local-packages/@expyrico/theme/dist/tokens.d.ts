/**
 * Theme token shape. Every theme must implement this exact contract.
 */
export type ThemeId = 'expyrico' | 'expyricoDark';
export type ClayElevation = {
    rim: string;
    base: string;
    ambient: string;
};
export type MD3Elevation = {
    level0: string;
    level1: string;
    level2: string;
    level3: string;
    level4: string;
    level5: string;
};
export type TypeRampEntry = {
    fontSize: number;
    lineHeight: number;
    fontWeight: string;
};
export type TypeRamp = {
    displayLarge: TypeRampEntry;
    displayMedium: TypeRampEntry;
    displaySmall: TypeRampEntry;
    headlineLarge: TypeRampEntry;
    headlineMedium: TypeRampEntry;
    headlineSmall: TypeRampEntry;
    titleLarge: TypeRampEntry;
    titleMedium: TypeRampEntry;
    titleSmall: TypeRampEntry;
    bodyLarge: TypeRampEntry;
    bodyMedium: TypeRampEntry;
    bodySmall: TypeRampEntry;
    labelLarge: TypeRampEntry;
    labelMedium: TypeRampEntry;
    labelSmall: TypeRampEntry;
};
export interface ColorTokens {
    bg: string;
    bgElevated: string;
    bgGlass: string;
    border: string;
    text: string;
    textMuted: string;
    textInverse: string;
    primary: string;
    primaryDark: string;
    primaryLight: string;
    primaryFg: string;
    accent: string;
    accentLight: string;
    neutralLight: string;
    neutralMid: string;
    neutralDark: string;
    success: string;
    warning: string;
    danger: string;
    good: string;
    expiringSoon: string;
    expired: string;
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
    elevation: {
        clay: ClayElevation;
        md3: MD3Elevation;
    };
    typography: TypographyTokens;
    typeRamp: TypeRamp;
    spacing: SpacingTokens;
    animation: AnimationTokens;
}
//# sourceMappingURL=tokens.d.ts.map