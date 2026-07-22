import { hex } from 'wcag-contrast';
import { expyrico } from '@expyrico/theme';

// WCAG AA contrast assertions for the Expyrico theme. These are the combinations
// that currently pass against the source-of-truth palette in packages/theme.

function normalizeToHex(value: string): string {
  if (value.startsWith('#')) return value;
  throw new Error(`Non-hex color ${value} cannot be compared with wcag-contrast hex()`);
}

function contrast(fg: string, bg: string): number {
  return hex(normalizeToHex(fg), normalizeToHex(bg));
}

describe('WCAG AA contrast (text 4.5:1, non-text/borders 3:1)', () => {
  it('expyrico: primary text on background', () => {
    expect(contrast(expyrico.colors.text, expyrico.colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('expyrico: inverse text on primary/accent', () => {
    expect(contrast(expyrico.colors.textInverse, expyrico.colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(expyrico.colors.textInverse, expyrico.colors.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
