import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRedis } from '../../redis.js';
import {
  listActiveMediaLeaseKeys,
  resetMediaFreezePolicyForTests,
  setMediaFreezePolicy,
  withMediaMutationLease,
} from './product-media-coordinator.js';

afterEach(() => {
  resetMediaFreezePolicyForTests();
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('withMediaMutationLease', () => {
  it('runs the operation and passes a lease with a stable id/kind', async () => {
    const result = await withMediaMutationLease('upload', async (lease) => {
      expect(lease.kind).toBe('upload');
      expect(typeof lease.id).toBe('string');
      expect(lease.id.length).toBeGreaterThan(0);
      return 'ok';
    });
    expect(result).toBe('ok');
  });

  it('registers the lease as active while the operation runs, and releases it after success', async () => {
    let sawActive: string[] = [];
    await withMediaMutationLease('publish_public', async () => {
      sawActive = await listActiveMediaLeaseKeys();
    });
    expect(sawActive).toHaveLength(1);
    expect(sawActive[0]).toContain('publish_public');
    const afterRelease = await listActiveMediaLeaseKeys();
    expect(afterRelease).toHaveLength(0);
  });

  it('releases the lease even when the operation throws', async () => {
    await expect(
      withMediaMutationLease('delete_private', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await listActiveMediaLeaseKeys()).toHaveLength(0);
  });

  it('sets an initial Redis TTL on the lease key', async () => {
    let ttl = -99;
    await withMediaMutationLease('promote_private', async () => {
      const keys = await listActiveMediaLeaseKeys();
      ttl = await getRedis().ttl(keys[0]!);
    });
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
  });

  it('heartbeats the lease, renewing its TTL while a long operation runs', async () => {
    const redis = getRedis();
    let key = '';
    await withMediaMutationLease(
      'publish_public',
      async () => {
        const keys = await listActiveMediaLeaseKeys();
        key = keys[0]!;
        // A short-TTL lease with a heartbeat well inside that TTL: if the heartbeat
        // didn't renew it, the key would expire out from under us during the wait.
        await redis.expire(key, 1);
        await sleep(1_500);
        expect(await redis.exists(key)).toBe(1);
        expect(await redis.ttl(key)).toBeGreaterThan(0);
      },
      { ttlSeconds: 3, heartbeatIntervalMs: 200 },
    );
  }, 10_000);

  it('runs multiple concurrent leases of the same kind independently', async () => {
    const barrier = new Promise<void>((resolve) => setTimeout(resolve, 20));
    const [a, b] = await Promise.all([
      withMediaMutationLease('delete_public', async (lease) => {
        await barrier;
        return lease.id;
      }),
      withMediaMutationLease('delete_public', async (lease) => {
        await barrier;
        return lease.id;
      }),
    ]);
    expect(a).not.toBe(b);
    expect(await listActiveMediaLeaseKeys()).toHaveLength(0);
  });

  it('rejects acquisition when the freeze policy blocks it, before running the operation', async () => {
    setMediaFreezePolicy(async (kind) => {
      throw new Error(`frozen: ${kind}`);
    });
    const operation = vi.fn();
    await expect(withMediaMutationLease('enqueue_cleanup', operation)).rejects.toThrow('frozen: enqueue_cleanup');
    expect(operation).not.toHaveBeenCalled();
    expect(await listActiveMediaLeaseKeys()).toHaveLength(0);
  });
});
