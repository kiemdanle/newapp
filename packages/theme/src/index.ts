export * from './tokens.js';
export { aurora } from './themes/aurora.js';
export { bento } from './themes/bento.js';
export { clay } from './themes/clay.js';
export { material } from './themes/material.js';

import type { Theme, ThemeId } from './tokens.js';
import { aurora } from './themes/aurora.js';
import { bento } from './themes/bento.js';
import { clay } from './themes/clay.js';
import { material } from './themes/material.js';

export const themes: Record<ThemeId, Theme> = {
  aurora,
  bento,
  clay,
  material,
};

export const themeList: Theme[] = [aurora, bento, clay, material];
