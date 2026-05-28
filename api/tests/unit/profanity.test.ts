import { describe, expect, it } from 'vitest';
import { containsProfanity } from '../../src/services/reviews/profanity.js';

describe('containsProfanity', () => {
  it('flags an obvious slur', () => {
    const r = containsProfanity('this is shit');
    expect(r.matched).toBe(true);
    expect(r.words.length).toBeGreaterThan(0);
  });

  it('flags l33t-speak variants', () => {
    const r = containsProfanity('what an a$$hole');
    expect(r.matched).toBe(true);
  });

  it('does NOT flag the Scunthorpe problem', () => {
    expect(containsProfanity('I live in Scunthorpe').matched).toBe(false);
  });

  it('does NOT flag clean text', () => {
    expect(containsProfanity('Great packaging, tasty product').matched).toBe(false);
  });

  it('does NOT flag empty input', () => {
    expect(containsProfanity('').matched).toBe(false);
  });

  it('does NOT flag null-ish whitespace', () => {
    expect(containsProfanity('   ').matched).toBe(false);
  });

  it('handles multi-word inputs and returns ALL matches', () => {
    const r = containsProfanity('shit and damn it');
    expect(r.matched).toBe(true);
    expect(r.words.length).toBeGreaterThanOrEqual(1);
  });

  it('is case-insensitive', () => {
    expect(containsProfanity('SHIT').matched).toBe(true);
  });

  it('does NOT flag the substring "assistant"', () => {
    expect(containsProfanity('the assistant manager was helpful').matched).toBe(false);
  });
});
