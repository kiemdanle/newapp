// Minimal, DB-free reproduction of the config-caching-across-resetModules bug fixed
// by tests/helpers/env.ts. Deliberately does not touch Postgres/Redis so it stays fast
// whether it runs in-suite or is spawned alone as a fresh process (see
// env-load-order.test.ts, which does exactly that to prove the real fix).
//
// The bug: a module reachable from setup.ts's OWN static imports (db.js -> logger.js)
// eagerly calls `getConfig()` at module-evaluation time, before setup.ts's env-loading
// code could run. If that eager call didn't throw (Vite's own `.env` auto-load already
// gave it well-formed-but-wrong values), it permanently cached the wrong config for
// that module instance. A later `vi.resetModules()` + dynamic re-import gets a THIRD,
// freshly-parsed instance — so the two could disagree.
import { describe, expect, it, vi } from 'vitest';
import { getConfig } from '../../src/config.js';

describe('env load order (regression for the config-caching bug)', () => {
  it('getConfig() returns the same values before and after vi.resetModules()', async () => {
    const before = getConfig();
    vi.resetModules();
    const { getConfig: getConfigAfterReset } = await import('../../src/config.js');
    const after = getConfigAfterReset();

    expect(after.jwt.accessSecret).toBe(before.jwt.accessSecret);
    expect(after.databaseUrl).toBe(before.databaseUrl);
    // The specific value matters, not just consistency — this is the literal
    // `.env.test` value, proving neither instance picked up Vite's auto-loaded
    // `api/.env` (dev) secret.
    expect(after.jwt.accessSecret).toBe(process.env.JWT_ACCESS_SECRET);
  });
});
