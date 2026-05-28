import { describe, expect, it } from 'vitest';
import { makeBreaker } from '../../src/lib/breaker.js';

describe('makeBreaker', () => {
  it('opens after consecutive failures', async () => {
    let calls = 0;
    const breaker = makeBreaker(
      async () => {
        calls += 1;
        throw new Error('boom');
      },
      {
        name: 'test-fail',
        timeout: 100,
        errorThresholdPercentage: 50,
        resetTimeout: 1000,
        volumeThreshold: 2,
      },
    );

    await expect(breaker.fire()).rejects.toThrow();
    await expect(breaker.fire()).rejects.toThrow();
    await expect(breaker.fire()).rejects.toThrow();
    expect(breaker.opened).toBe(true);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('returns value on success', async () => {
    const breaker = makeBreaker(async (n: number) => n * 2, {
      name: 'mul',
      timeout: 100,
      errorThresholdPercentage: 50,
      resetTimeout: 1000,
      volumeThreshold: 2,
    });
    await expect(breaker.fire(3)).resolves.toBe(6);
  });
});
