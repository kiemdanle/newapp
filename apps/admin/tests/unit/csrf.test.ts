import { describe, expect, it } from 'vitest';
import { generateCsrfToken, isCsrfValid } from '@/lib/csrf';

describe('csrf', () => {
  it('generateCsrfToken returns a 43+ char url-safe string', () => {
    const t = generateCsrfToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(generateCsrfToken()).not.toBe(t);
  });

  it('isCsrfValid returns true when cookie equals header (constant-time)', () => {
    const t = generateCsrfToken();
    expect(isCsrfValid(t, t)).toBe(true);
  });

  it('isCsrfValid returns false on mismatch', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(isCsrfValid(a, b)).toBe(false);
  });

  it('isCsrfValid returns false on missing values', () => {
    expect(isCsrfValid(undefined, 'x')).toBe(false);
    expect(isCsrfValid('x', undefined)).toBe(false);
    expect(isCsrfValid('', '')).toBe(false);
  });
});
