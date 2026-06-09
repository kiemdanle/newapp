import { describe, expect, it } from 'vitest';
import { generateReferralCode } from '../../src/services/referrals/referral-code.js';

describe('generateReferralCode', () => {
  it('produces an 8-char URL-safe code', () => {
    expect(generateReferralCode()).toMatch(/^[A-Z2-9]{8}$/);
  });

  it('excludes ambiguous characters 0, O, 1, I', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReferralCode()).not.toMatch(/[01OI]/);
    }
  });

  it('is overwhelmingly unique across many calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateReferralCode());
    expect(seen.size).toBe(1000);
  });
});
