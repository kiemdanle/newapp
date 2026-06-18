export * from './tokens.js';
export { expyrico } from './themes/expyrico.js';
export { bento } from './themes/bento.js';
export { clay } from './themes/clay.js';
export { material } from './themes/material.js';

import type { Theme, ThemeId } from './tokens.js';
import { expyrico } from './themes/expyrico.js';
import { bento } from './themes/bento.js';
import { clay } from './themes/clay.js';
import { material } from './themes/material.js';

export const themes: Record<ThemeId, Theme> = {
  expyrico,
  bento,
  clay,
  material,
};

export const themeList: Theme[] = [expyrico, bento, clay, material];
