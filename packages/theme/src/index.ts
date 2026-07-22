export * from './tokens.js';
export { expyricoColors, expyricoDarkColors, expyricoPalette } from './palette.js';
export { expyrico, expyricoDark } from './themes/expyrico.js';

import type { Theme, ThemeId } from './tokens.js';
import { expyrico, expyricoDark } from './themes/expyrico.js';

export const themes: Record<ThemeId, Theme> = {
  expyrico,
  expyricoDark,
};

export const themeList: Theme[] = [expyrico, expyricoDark];
