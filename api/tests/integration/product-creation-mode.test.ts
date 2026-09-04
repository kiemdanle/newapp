import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { resetConfigForTests } from '../../src/config.js';
import { makeAdmin, makeUserForAdmin } from '../helpers/admin.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { isProductCreationEligible } from '../../src/services/products/product-creation-eligibility.js';
import {
  setProductCreationAssessmentClientForTests,
  resetProductCreationAssessmentBreakerForTests,
} from '../../src/services/abuse/product-creation-assessment.js';

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  resetConfigForTests();
  vi.doUnmock('../../src/services/products/off-client.js');
  vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  vi.resetModules();
  setProductCreationAssessmentClientForTests(undefined);
  resetProductCreationAssessmentBreakerForTests();
});

function idemHeaders(base: Record<string, string>) {
  return { ...base, 'idempotency-key': randomUUID() };
}

function stubAssessmentClient(score = 0.9, action = 'submit_product') {
  setProductCreationAssessmentClientForTests({
    projectPath: (p: string) => `projects/${p}`,
    createAssessment: async () => [
      { tokenProperties: { valid: true, action }, riskAnalysis: { score, reasons: [] } },
    ],
  } as never);
}

/** Same shape as `buildServerWithExternalMiss` but also hands back the mock
 * functions themselves, so a test can assert on call counts — the load-bearing
 * proof for reviewer-p7 I5 ("mode gate must run before the expensive external
 * lookup", not merely "before the write"). */
async function buildServerWithTrackedExternalMiss() {
  const offMock = vi.fn().mockResolvedValue({ status: 'not_found' });
  const upcMock = vi.fn().mockResolvedValue({ status: 'not_found' });
  vi.doMock('../../src/services/products/off-client.js', () => ({ lookupOff: offMock }));
  vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({ lookupUpcitemdb: upcMock }));
  vi.resetModules();
  const { buildServer: build2 } = await import('../../src/server.js');
  return { app: await build2(), offMock, upcMock };
}

type Mode = 'off' | 'internal' | 'all';

async function setMode(mode: Mode, requireApproval = true): Promise<void> {
  await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode, requireApproval } } });
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
    expect(res.json()).toEqual({ mode: 'off', requireApproval: false });
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
    expect(res.json()).toEqual({ mode: 'internal', requireApproval: false });

    const row = await getPrisma().setting.findUniqueOrThrow({ where: { key: 'product_creation' } });
    expect(row.value).toEqual({ mode: 'internal', requireApproval: false });
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

describe('POST /v1/products/drafts — mode gate runs before the external lookup (reviewer-p7 I5)', () => {
  it('under off, a genuine not_found create attempt is rejected without ever calling either external provider', async () => {
    await setMode('off');
    const { app, offMock, upcMock } = await buildServerWithTrackedExternalMiss();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13) },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('feature_disabled');
    expect(offMock).not.toHaveBeenCalled();
    expect(upcMock).not.toHaveBeenCalled();
    await app.close();
  });

  it('under all, the same request is admitted and does reach both external providers', async () => {
    await setMode('all');
    const { app, offMock, upcMock } = await buildServerWithTrackedExternalMiss();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13) },
    });
    expect(res.statusCode).toBe(201);
    expect(offMock).toHaveBeenCalledTimes(1);
    expect(upcMock).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('resuming the caller\'s own existing draft never calls an external provider, in any mode', async () => {
    await setMode('off');
    const { app, offMock, upcMock } = await buildServerWithTrackedExternalMiss();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const barcode = `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13);
    await getPrisma().product.create({
      data: { barcode, name: 'Existing', source: 'user', createdByUserId: user.id, status: 'draft' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().resumed).toBe(true);
    expect(offMock).not.toHaveBeenCalled();
    expect(upcMock).not.toHaveBeenCalled();
    await app.close();
  });
});

describe('Admin cohort under internal mode — one converged policy (reviewer-p7 I6)', () => {
  it('an internal-mode admin can create, patch, and submit their own draft end to end', async () => {
    await setMode('internal');
    const { app } = await buildServerWithTrackedExternalMiss();
    const { headers, admin } = await makeAdmin();
    const barcode = `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode },
    });
    expect(created.statusCode).toBe(201);
    const draft = created.json();
    expect(draft.product.status).toBe('draft');

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${draft.product.id}`,
      headers,
      payload: { version: draft.product.version, name: 'Admin Own Draft' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().name).toBe('Admin Own Draft');

    // buildServerWithTrackedExternalMiss's own vi.resetModules() left the
    // top-level `stubAssessmentClient` import pointed at a stale module
    // instance decoupled from what the freshly-built app actually resolves
    // — re-import the current instance to stub the same one the app uses.
    const assessmentModule = await import('../../src/services/abuse/product-creation-assessment.js');
    assessmentModule.setProductCreationAssessmentClientForTests({
      projectPath: (p: string) => `projects/${p}`,
      createAssessment: async () => [
        { tokenProperties: { valid: true, action: 'submit_product' }, riskAnalysis: { score: 0.9, reasons: [] } },
      ],
    } as never);
    const submitted = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${draft.product.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: patched.json().version, abuseToken: 'tok', platform: 'android' },
    });
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().status).toBe('pending');
    assessmentModule.resetProductCreationAssessmentBreakerForTests();
    assessmentModule.setProductCreationAssessmentClientForTests(undefined);

    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: draft.product.id } });
    expect(row.createdByUserId).toBe(admin.id);
    expect(row.status).toBe('pending');
    await app.close();
  });

  it('a non-allowlisted regular user is still blocked from all three mutations under internal mode', async () => {
    await setMode('internal');
    const app = await buildServer();
    const user = await makeUserForAdmin();
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const barcode = `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('feature_disabled');
    await app.close();
  });
});

describe('POST /v1/products/drafts/:id/submit — completeness validation (reviewer-p7 I8)', () => {
  it('rejects submitting a draft that was never given a name, leaving it in draft status', async () => {
    await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'all' } } });
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const draft = await getPrisma().product.create({
      data: {
        barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13),
        name: '',
        source: 'user',
        createdByUserId: user.id,
        status: 'draft',
      },
    });
    stubAssessmentClient();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${draft.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: draft.version, abuseToken: 'tok', platform: 'android' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.status).toBe('draft');
    await app.close();
  });

  it('rejects a whitespace-only name identically to an empty one', async () => {
    await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'all' } } });
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const draft = await getPrisma().product.create({
      data: {
        barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13),
        name: '   ',
        source: 'user',
        createdByUserId: user.id,
        status: 'draft',
      },
    });
    stubAssessmentClient();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${draft.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: draft.version, abuseToken: 'tok', platform: 'android' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('accepts submitting a draft once a real name was set via PATCH', async () => {
    await setMode('all', true);
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const headers = await authHeadersFor(user.id, user.tokenVersion);
    const draft = await getPrisma().product.create({
      data: {
        barcode: `9${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 13),
        name: '',
        source: 'user',
        createdByUserId: user.id,
        status: 'draft',
      },
    });
    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${draft.id}`,
      headers,
      payload: { version: draft.version, name: 'Real Name' },
    });
    expect(patched.statusCode).toBe(200);
    stubAssessmentClient();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${draft.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: patched.json().version, abuseToken: 'tok', platform: 'android' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('pending');
    await app.close();
  });
});
