import { hex } from 'wcag-contrast';
import { expyrico, bento, clay, material } from '@expyrico/theme';

// WCAG AA contrast assertions.
//
// KNOWN FAILURES (recorded in apps/mobile/docs/theme-audit.md, pending palette sign-off):
// - expyrico: text on bgElevated, textMuted on bg/bgElevated, danger on bgElevated,
//   success on bgElevated, border on bg/bgElevated, accent on bgElevated, primary on bgElevated
// - bento: textMuted on bg, textInverse on accent, danger on bg/bgElevated,
//   success on bg/bgElevated, border on bg/bgElevated, accent on bg/bgElevated
// - clay: textMuted on bg/bgElevated, textInverse on primary/accent,
//   success on bg/bgElevated, border on bg/bgElevated, accent on bg/bgElevated
// - material: border on bg/bgElevated
//
// Do not retune theme hex without explicit sign-off per M4 Task F1.

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
  it('expyrico: status colors on background', () => {
    expect(contrast(expyrico.colors.danger, expyrico.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(expyrico.colors.success, expyrico.colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('expyrico: accent and primary on background (non-text)', () => {
    expect(contrast(expyrico.colors.accent, expyrico.colors.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(expyrico.colors.primary, expyrico.colors.bg)).toBeGreaterThanOrEqual(3);
  });

  it('bento: primary text on background', () => {
    expect(contrast(bento.colors.text, bento.colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('bento: primary and accent on background (non-text)', () => {
    expect(contrast(bento.colors.primary, bento.colors.bg)).toBeGreaterThanOrEqual(3);
  });

  it('clay: primary text on background', () => {
    expect(contrast(clay.colors.text, clay.colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('clay: primary on background (non-text)', () => {
    expect(contrast(clay.colors.primary, clay.colors.bg)).toBeGreaterThanOrEqual(3);
  });

  it('material: primary text on background', () => {
    expect(contrast(material.colors.text, material.colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('material: inverse text on primary/accent', () => {
    expect(contrast(material.colors.textInverse, material.colors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(material.colors.textInverse, material.colors.accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('material: status colors on background', () => {
    expect(contrast(material.colors.danger, material.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(material.colors.success, material.colors.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('material: accent and primary on background (non-text)', () => {
    expect(contrast(material.colors.accent, material.colors.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(material.colors.primary, material.colors.bg)).toBeGreaterThanOrEqual(3);
  });
});
