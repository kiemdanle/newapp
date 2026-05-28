import { describe, expect, it } from 'vitest';
import { wilsonLowerBound } from '../../src/services/reviews/wilson.js';

describe('wilsonLowerBound', () => {
  it('returns 0 when there are no votes', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it('returns a value < 1 even with all upvotes', () => {
    const s = wilsonLowerBound(100, 0);
    expect(s).toBeGreaterThan(0.9);
    expect(s).toBeLessThan(1);
  });

  it('returns a small value with all downvotes', () => {
    const s = wilsonLowerBound(0, 100);
    expect(s).toBeLessThan(0.05);
    expect(s).toBeGreaterThanOrEqual(0);
  });

  it('returns approximately 0.2 for equal up/down at n=10', () => {
    // Classic z=1.96 Wilson lower bound for 5/10 ≈ 0.2366
    const s = wilsonLowerBound(5, 5);
    expect(s).toBeGreaterThan(0.2);
    expect(s).toBeLessThan(0.3);
  });

  it('is monotonic in upvote share at fixed total', () => {
    const a = wilsonLowerBound(6, 4);
    const b = wilsonLowerBound(7, 3);
    const c = wilsonLowerBound(8, 2);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it('penalises small samples', () => {
    // 1 upvote out of 1 should score lower than 100 upvotes out of 100
    expect(wilsonLowerBound(1, 0)).toBeLessThan(wilsonLowerBound(100, 0));
  });

  it('clamps within [0, 1]', () => {
    for (const [u, d] of [
      [1, 1],
      [3, 7],
      [10, 0],
      [0, 10],
    ] as const) {
      const s = wilsonLowerBound(u, d);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});
