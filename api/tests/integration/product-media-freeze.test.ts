import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRedis } from '../../src/redis.js';
import {
  acquireMediaFreeze,
  installMediaFreezePolicy,
  isMediaFreezeActive,
  MediaFreezeAlreadyActiveError,
  releaseMediaFreeze,
  renewMediaFreeze,
  resetMediaFreezeForTests,
} from '../../src/services/products/product-media-freeze.js';
import {
  resetMediaFreezePolicyForTests,
  withMediaMutationLease,
} from '../../src/services/products/product-media-coordinator.js';

afterEach(async () => {
  await resetMediaFreezeForTests();
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
    const { token } = await acquireMediaFreeze(0);
    await expect(withMediaMutationLease('upload', async () => 'ok')).rejects.toThrow();
    await releaseMediaFreeze(token);
    await expect(withMediaMutationLease('upload', async () => 'ok')).resolves.toBe('ok');
  });
});

describe('acquireMediaFreeze / renewMediaFreeze / releaseMediaFreeze', () => {
  it('sets the flag immediately and reports drained when nothing is in flight', async () => {
    const result = await acquireMediaFreeze(2000);
    expect(result.drained).toBe(true);
    expect(result.remainingLeases).toBe(0);
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
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
    await expect(releaseMediaFreeze('never-acquired-token')).resolves.toBeUndefined();
    await expect(releaseMediaFreeze('never-acquired-token')).resolves.toBeUndefined();
    expect(await isMediaFreezeActive()).toBe(false);
  });

  it('rejects a second acquire while a freeze is already held, without resetting the first holder\'s TTL/token (reviewer-p7 II3)', async () => {
    const first = await acquireMediaFreeze(0);
    await expect(acquireMediaFreeze(0)).rejects.toThrow(MediaFreezeAlreadyActiveError);
    // The first holder's own token is still the one in Redis — a second
    // acquire must never have silently overwritten it.
    expect(await getRedis().get('media:freeze:active')).toBe(first.token);
  });

  it('renews the TTL only for the token that actually holds the freeze', async () => {
    const { token } = await acquireMediaFreeze(0);
    await expect(renewMediaFreeze(token)).resolves.toBe(true);
    await expect(renewMediaFreeze('some-other-stale-token')).resolves.toBe(false);
  });

  it('renew reports false once the freeze has been released, never resurrecting it', async () => {
    const { token } = await acquireMediaFreeze(0);
    await releaseMediaFreeze(token);
    await expect(renewMediaFreeze(token)).resolves.toBe(false);
    expect(await isMediaFreezeActive()).toBe(false);
  });

  it('release never deletes a freeze re-acquired by a different holder under a mismatched token', async () => {
    // Simulates: this holder's freeze already expired and was reclaimed by a
    // second, unrelated run before this (now-stale) release call arrives —
    // the release must not delete the second run's freeze out from under it.
    const { token } = await acquireMediaFreeze(0);
    await releaseMediaFreeze(token); // this run's own freeze ends normally
    const second = await acquireMediaFreeze(0); // a different run acquires next
    await releaseMediaFreeze(token); // the first (stale) token tries to release again
    expect(await isMediaFreezeActive()).toBe(true);
    expect(await getRedis().get('media:freeze:active')).toBe(second.token);
  });
});
