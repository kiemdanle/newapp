export * from './tokens.js';
export { expyricoColors, expyricoDarkColors, expyricoPalette } from './palette.js';
export { expyrico, expyricoDark } from './themes/expyrico.js';
export { bento } from './themes/bento.js';
export { clay } from './themes/clay.js';
export { material } from './themes/material.js';

import type { Theme, ThemeId } from './tokens.js';
import { expyrico, expyricoDark } from './themes/expyrico.js';
import { bento } from './themes/bento.js';
import { clay } from './themes/clay.js';
import { material } from './themes/material.js';

export const themes: Record<ThemeId, Theme> = {
  expyrico,
  expyricoDark,
  bento,
  clay,
  material,
};

export const themeList: Theme[] = [expyrico, expyricoDark, bento, clay, material];
