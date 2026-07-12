import { describe, expect, it } from 'vitest';
import { randomSixDigitCode } from '../../src/utils/random.js';

describe('random utilities', () => {
  it('generates a zero-padded 6-digit code', () => {
    expect(randomSixDigitCode()).toMatch(/^\d{6}$/);
  });
});
