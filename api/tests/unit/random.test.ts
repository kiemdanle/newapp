import { describe, expect, it } from 'vitest';
import { randomSixDigitCode, randomSecurePassword } from '../../src/utils/random.js';

describe('random utilities', () => {
  it('generates a zero-padded 6-digit code', () => {
    expect(randomSixDigitCode()).toMatch(/^\d{6}$/);
  });

  it('generates a cryptographically strong random password meeting password policy', () => {
    const pw = randomSecurePassword(16);
    expect(pw).toHaveLength(16);
    expect(/[A-Z]/.test(pw)).toBe(true);
    expect(/[a-z]/.test(pw)).toBe(true);
    expect(/[0-9]/.test(pw)).toBe(true);
    expect(/[!@#$%^&*()-_=+[\]{}]/.test(pw)).toBe(true);
  });

  it('supports custom password lengths >= 10', () => {
    const pw20 = randomSecurePassword(20);
    expect(pw20).toHaveLength(20);
  });
});
