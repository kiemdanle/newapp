import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRedis } from '../../src/redis.js';
import {
  acquireMediaFreeze,
  installMediaFreezePolicy,
  isMediaFreezeActive,
  releaseMediaFreeze,
} from '../../src/services/products/product-media-freeze.js';
import {
  resetMediaFreezePolicyForTests,
  withMediaMutationLease,
} from '../../src/services/products/product-media-coordinator.js';

afterEach(async () => {
  await releaseMediaFreeze();
  resetMediaFreezePolicyForTests();
});

describe('installMediaFreezePolicy', () => {
  beforeEach(() => {
    installMediaFreezePolicy();
  });

  it('allows media mutations through when no freeze is active', async () => {
    await expect(withMediaMutationLease('upload', async () => 'ok')).resolves.toBe('ok');
  });

  it('rejects new media mutations once the freeze flag is set, with a retryable typed error', async () => {
    await getRedis().set('media:freeze:active', '1', 'EX', 60);
    await expect(withMediaMutationLease('upload', async () => 'ok')).rejects.toMatchObject({
      status: 503,
      code: 'temporarily_unavailable',
    });
  });

  it('resumes admitting mutations once the freeze flag is cleared', async () => {
    await getRedis().set('media:freeze:active', '1', 'EX', 60);
    await expect(withMediaMutationLease('upload', async () => 'ok')).rejects.toThrow();
    await releaseMediaFreeze();
    await expect(withMediaMutationLease('upload', async () => 'ok')).resolves.toBe('ok');
  });
});

describe('acquireMediaFreeze / releaseMediaFreeze', () => {
  it('sets the flag immediately and reports drained when nothing is in flight', async () => {
    const result = await acquireMediaFreeze(2000);
    expect(result).toEqual({ drained: true, remainingLeases: 0 });
    expect(await isMediaFreezeActive()).toBe(true);
  });

  it('waits for an in-flight lease to release before reporting drained', async () => {
    installMediaFreezePolicy();
    let releaseLease: (() => void) | undefined;
    const inFlight = withMediaMutationLease('upload', async () => {
      await new Promise<void>((resolve) => {
        releaseLease = resolve;
      });
      return 'done';
    });

    // Give the lease a moment to actually register before acquiring the freeze.
    await new Promise((r) => setTimeout(r, 50));
    const freezePromise = acquireMediaFreeze(5000);

    // Still draining — the lease above hasn't finished yet.
    await new Promise((r) => setTimeout(r, 300));
    expect(await isMediaFreezeActive()).toBe(true);

    releaseLease?.();
    await inFlight;
    const result = await freezePromise;
    expect(result.drained).toBe(true);
    expect(result.remainingLeases).toBe(0);
  });

  it('reports drained: false when the timeout elapses with a lease still outstanding', async () => {
    installMediaFreezePolicy();
    let releaseLease: (() => void) | undefined;
    const inFlight = withMediaMutationLease('upload', async () => {
      await new Promise<void>((resolve) => {
        releaseLease = resolve;
      });
    });
    await new Promise((r) => setTimeout(r, 50));

    const result = await acquireMediaFreeze(300);
    expect(result.drained).toBe(false);
    expect(result.remainingLeases).toBeGreaterThan(0);

    releaseLease?.();
    await inFlight;
  });

  it('release is idempotent — safe to call with no freeze active', async () => {
    await expect(releaseMediaFreeze()).resolves.toBeUndefined();
    await expect(releaseMediaFreeze()).resolves.toBeUndefined();
    expect(await isMediaFreezeActive()).toBe(false);
  });
});
