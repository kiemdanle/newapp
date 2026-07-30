import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { resetConfigForTests } from '../../src/config.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { isProductCreationEligible } from '../../src/services/products/product-creation-eligibility.js';

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  resetConfigForTests();
  vi.doUnmock('../../src/services/products/off-client.js');
  vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  vi.resetModules();
});

type Mode = 'off' | 'internal' | 'all';

async function setMode(mode: Mode): Promise<void> {
  await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode } } });
}

async function authHeadersFor(userId: string, tokenVersion: number): Promise<{ authorization: string }> {
  const token = await issueAccessToken({ sub: userId, role: 'user', tokenVersion });
  return { authorization: `Bearer ${token}` };
}

/** Mocks both external providers as a conclusive miss and returns a fresh
 * `buildServer` instance picked up post-`resetModules` — mirrors the pattern
 * `products-lookup.test.ts` already uses, so lookup-v2 tests here never make a
 * real network call. */
async function buildServerWithExternalMiss() {
  vi.doMock('../../src/services/products/off-client.js', () => ({
    lookupOff: vi.fn().mockResolvedValue({ status: 'not_found' }),
  }));
  vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
    lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'not_found' }),
  }));
  vi.resetModules();
  const { buildServer: build2 } = await import('../../src/server.js');
  return build2();
}

describe('GET/PATCH /v1/admin/settings/product-creation', () => {
  it('the Phase 1 migration already supplies a parseable { mode: "off" } row with no seed-admin run', async () => {
    // Proves the migration's INSERT ... ON CONFLICT DO NOTHING seed is real and
    // parseable by the schema this route validates against — not asserted only
    // against the migration SQL text.
    const row = await getPrisma().setting.findUnique({ where: { key: 'product_creation' } });
    expect(row).not.toBeNull();
    expect(row!.value).toEqual({ mode: 'off' });
  });

  it('GET returns the current mode to an admin', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({ method: 'GET', url: '/v1/admin/settings/product-creation', headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ mode: 'off' });
    await app.close();
  });

  it('rejects a non-admin caller', async () => {
    const app = await buildServer();
    const user = await makeUserForAdmin();
    const { issueAccessToken } = await import('../../src/services/auth/tokens.js');
    const token = await issueAccessToken({ sub: user.id, role: 'user', tokenVersion: user.tokenVersion });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/settings/product-creation',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('PATCH updates the mode and records an audit log entry', async () => {
    const app = await buildServer();
    const { headers, admin } = await makeAdmin();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/product-creation',
      headers,
      payload: { mode: 'internal' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ mode: 'internal' });

    const row = await getPrisma().setting.findUniqueOrThrow({ where: { key: 'product_creation' } });
    expect(row.value).toEqual({ mode: 'internal' });
    expect(row.updatedBy).toBe(admin.id);

    const audit = await getPrisma().adminAuditLog.findFirst({
      where: { action: 'settings.product_creation.update' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit!.adminId).toBe(admin.id);
    await app.close();
  });

  it('rejects an invalid mode value', async () => {
    const app = await buildServer();
    const { headers } = await makeAdmin();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/settings/product-creation',
      headers,
      payload: { mode: 'nonsense' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});

describe('isProductCreationEligible — mode × cohort matrix', () => {
  it('off: no one is eligible, not even an admin actor', async () => {
    await setMode('off');
    const admin = await makeAdmin();
    const user = await makeUserForAdmin();
    expect(await isProductCreationEligible({ id: admin.admin.id, role: 'admin' })).toBe(false);
    expect(await isProductCreationEligible({ id: user.id, role: 'user' })).toBe(false);
  });

  it('internal: admins are eligible even with an empty allowlist', async () => {
    await setMode('internal');
    const admin = await makeAdmin();
    expect(await isProductCreationEligible({ id: admin.admin.id, role: 'admin' })).toBe(true);
  });

  it('internal: an allowlisted non-admin user is eligible', async () => {
    const user = await makeUserForAdmin();
    process.env.PRODUCT_CREATION_INTERNAL_ALLOWLIST = user.id;
    resetConfigForTests();
    await setMode('internal');
    expect(await isProductCreationEligible({ id: user.id, role: 'user' })).toBe(true);
  });

  it('internal: a non-allowlisted non-admin user is not eligible', async () => {
    const user = await makeUserForAdmin();
    process.env.PRODUCT_CREATION_INTERNAL_ALLOWLIST = '';
    resetConfigForTests();
    await setMode('internal');
    expect(await isProductCreationEligible({ id: user.id, role: 'user' })).toBe(false);
  });

  it('all: every actor is eligible', async () => {
    await setMode('all');
    const user = await makeUserForAdmin();
    expect(await isProductCreationEligible({ id: user.id, role: 'user' })).toBe(true);
  });
});

describe('POST /v1/products/lookup-v2 canCreate — mode gates the read-side capability flag', () => {
  it('is false under off even for an otherwise-conclusive miss', async () => {
    await setMode('off');
    const app = await buildServerWithExternalMiss();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ outcome: 'not_found', canCreate: false });
    await app.close();
  });

  it('is true under all for an otherwise-conclusive miss', async () => {
    await setMode('all');
    const app = await buildServerWithExternalMiss();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ outcome: 'not_found', canCreate: true });
    await app.close();
  });
});
