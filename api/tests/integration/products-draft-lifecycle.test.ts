import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { resetConfigForTests } from '../../src/config.js';
import { randomUUID } from 'node:crypto';
import {
  setProductCreationAssessmentClientForTests,
  resetProductCreationAssessmentBreakerForTests,
} from '../../src/services/abuse/product-creation-assessment.js';

function stubAssessmentClient(score = 0.9, action = 'submit_product') {
  setProductCreationAssessmentClientForTests({
    projectPath: (p: string) => `projects/${p}`,
    createAssessment: async () => [
      { tokenProperties: { valid: true, action }, riskAnalysis: { score, reasons: [] } },
    ],
  } as never);
}

// This file exercises draft create/patch mechanics, not the `product_creation`
// mode gate itself (covered separately in product-creation-mode.test.ts) — set
// mode to `all` so a non-allowlisted regular user isn't incidentally blocked.
beforeEach(async () => {
  await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'all' } } });
});

afterEach(() => {
  vi.doUnmock('../../src/services/products/off-client.js');
  vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  vi.resetModules();
  setProductCreationAssessmentClientForTests(undefined);
  resetProductCreationAssessmentBreakerForTests();
});

async function authedUser() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

function idemHeaders(base: Record<string, string>) {
  return { ...base, 'idempotency-key': randomUUID() };
}

describe('POST /v1/products/drafts', () => {
  it('creates a new draft on a server-rechecked conclusive miss', async () => {
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockResolvedValue({ status: 'not_found' }),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'not_found' }),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const { user, headers } = await authedUser();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: '1112223330001' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.resumed).toBe(false);
    expect(body.product.status).toBe('draft');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: body.product.id } });
    expect(row.createdByUserId).toBe(user.id);
    expect(row.name).toBe('');
    await app.close();
  });

  it('does not offer creation when a source is unavailable (temporarily_unavailable, no draft)', async () => {
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockResolvedValue({ status: 'unavailable' }),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'unavailable' }),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const { headers } = await authedUser();
    const before = await getPrisma().product.count();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: '1112223330002' },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe('temporarily_unavailable');
    expect(await getPrisma().product.count()).toBe(before);
    await app.close();
  });

  it("resumes the creator's own existing draft for the same identifier", async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const existing = await makeProduct({ barcode: '1112223330003', createdByUserId: user.id, name: 'My Jam' });
    await getPrisma().product.update({ where: { id: existing.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: '1112223330003' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resumed).toBe(true);
    expect(body.product.id).toBe(existing.id);
    expect(body.product.name).toBe('My Jam');
    await app.close();
  });

  it("resumes the creator's own changes_required product too", async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const existing = await makeProduct({ barcode: '1112223330004', createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: existing.id }, data: { status: 'changes_required' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: '1112223330004' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().resumed).toBe(true);
    await app.close();
  });

  it('conflicts (409) when the identifier already resolves to the creator\'s own pending product', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const existing = await makeProduct({ barcode: '1112223330005', createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: existing.id }, data: { status: 'pending' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: '1112223330005' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().canonicalProduct?.id).toBe(existing.id);
    await app.close();
  });

  it('conflicts (409) with no product when the identifier is reserved by another user (under_review, non-enumerating)', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authedUser();
    const reserved = await makeProduct({ barcode: '1112223330006', createdByUserId: owner.id });
    await getPrisma().product.update({ where: { id: reserved.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: '1112223330006' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().canonicalProduct).toBeUndefined();
    await app.close();
  });

  it('conflicts (409) with the canonical product when the identifier already resolves to an active product', async () => {
    const app = await buildServer();
    const { headers } = await authedUser();
    const active = await makeProduct({ barcode: '1112223330007', name: 'Existing Active' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: { barcode: '1112223330007' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().canonicalProduct?.id).toBe(active.id);
    await app.close();
  });

  it('a concurrent create race for the same identifier by the same actor still resumes exactly one draft', async () => {
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockResolvedValue({ status: 'not_found' }),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'not_found' }),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const { headers } = await authedUser();
    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/v1/products/drafts',
        headers: idemHeaders(headers),
        payload: { barcode: '1112223330008' },
      }),
      app.inject({
        method: 'POST',
        url: '/v1/products/drafts',
        headers: idemHeaders(headers),
        payload: { barcode: '1112223330008' },
      }),
    ]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 201]);
    const count = await getPrisma().product.count({ where: { barcode: '1112223330008' } });
    expect(count).toBe(1);
    await app.close();
  });

  it('never lets concurrent creates by the same actor overshoot the active-draft cap (reviewer-p7 M1)', async () => {
    process.env.PRODUCT_CREATION_MAX_ACTIVE_DRAFTS_PER_USER = '3';
    resetConfigForTests();
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockResolvedValue({ status: 'not_found' }),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'not_found' }),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const { user, headers } = await authedUser();
    // 9 + a 9-digit timestamp tail + a 3-digit index is always exactly 13
    // digits and unique per call within this test — `Date.now()` alone (13
    // digits) truncated to 13 chars after prefixing/suffixing would silently
    // drop the differentiating suffix and collide.
    const barcodeFor = (i: number) => `9${Date.now().toString().slice(-9)}${String(i).padStart(3, '0')}`;
    // Already at the cap minus one — a single admitted create must fill the
    // last slot; a plain count-then-create under READ COMMITTED would have
    // let several of these concurrent, distinctly-barcoded requests all read
    // the same "1 under cap" count and all succeed.
    await getPrisma().product.create({
      data: { barcode: barcodeFor(900), name: 'Existing', source: 'user', createdByUserId: user.id, status: 'draft' },
    });
    await getPrisma().product.create({
      data: { barcode: barcodeFor(901), name: 'Existing', source: 'user', createdByUserId: user.id, status: 'changes_required' },
    });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/v1/products/drafts',
          headers: idemHeaders(headers),
          payload: { barcode: barcodeFor(i) },
        }),
      ),
    );
    const created = results.filter((r) => r.statusCode === 201).length;
    const rejected = results.filter((r) => r.statusCode === 409).length;
    expect(created).toBe(1);
    expect(created + rejected).toBe(5);
    const activeCount = await getPrisma().product.count({
      where: { createdByUserId: user.id, status: { in: ['draft', 'changes_required'] } },
    });
    expect(activeCount).toBe(3);
    await app.close();
    delete process.env.PRODUCT_CREATION_MAX_ACTIVE_DRAFTS_PER_USER;
    resetConfigForTests();
  });

  it('rejects a payload with neither barcode nor qrPayload', async () => {
    const app = await buildServer();
    const { headers } = await authedUser();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers: idemHeaders(headers),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('requires an Idempotency-Key', async () => {
    const app = await buildServer();
    const { headers } = await authedUser();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      headers,
      payload: { barcode: '1112223330009' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/drafts',
      payload: { barcode: '1112223330010' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('PATCH /v1/products/drafts/:id', () => {
  it("updates the creator's own draft metadata and increments version", async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, name: 'Grandma\'s Salsa', description: 'Spicy and smooth', brand: 'Grandma' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.name).toBe("Grandma's Salsa");
    expect(body.description).toBe('Spicy and smooth');
    expect(body.version).toBe(p.version + 1);
    await app.close();
  });

  it('omitted description leaves the existing value unchanged (no silent nulling)', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft', description: 'Keep me' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, name: 'New Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().description).toBe('Keep me');
    await app.close();
  });

  it('rejects control characters in the description', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, description: 'bad\x07value' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('cannot change the immutable barcode/qrPayload identifier', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id, barcode: '2223334440001' });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, barcode: '9999999999999' },
    });
    expect(res.statusCode).toBe(400);
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.barcode).toBe('2223334440001');
    await app.close();
  });

  it('requires version', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { name: 'Missing version' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('a stale version is rejected with 409 version_conflict and the current version', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    // Apply one patch so the stored version has already moved past `p.version`.
    await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, name: 'First edit' },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, name: 'Stale edit' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('version_conflict');
    expect(res.json().currentVersion).toBe(p.version + 1);
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.name).toBe('First edit');
    await app.close();
  });

  it('two concurrent patches at the same version: exactly one 200 and one 409', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/v1/products/drafts/${p.id}`,
        headers,
        payload: { version: p.version, name: 'Writer A' },
      }),
      app.inject({
        method: 'PATCH',
        url: `/v1/products/drafts/${p.id}`,
        headers,
        payload: { version: p.version, name: 'Writer B' },
      }),
    ]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409]);
    await app.close();
  });

  it('another user cannot patch someone else\'s draft (non-enumerating 404)', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: owner.id });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, name: 'Hijack' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('cannot patch an already-pending product as a draft', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'pending' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, name: 'Too late' },
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it('can patch a changes_required product (resubmit-editing path)', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required' } });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { version: p.version, name: 'Fixed per feedback' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('POST /v1/products/drafts/:id/submit', () => {
  it('transitions a draft to pending on a valid abuse assessment', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'valid-token', platform: 'android' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('pending');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('pending');
    expect(row.submittedAt).not.toBeNull();
    // One durable notification event is committed in the same transaction, keyed
    // on the post-transition version.
    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: p.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.kind).toBe('new_product');
    expect(events[0]!.submissionVersion).toBe(row.version);
    expect(events[0]!.batchId).toBeNull();
    await app.close();
  });

  it('rolls back the pending transition when the notification event insert fails', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    // Force the transaction's event insert to violate the occurrence key after
    // the guarded product update has run. The transaction must roll both writes
    // back rather than leave a pending product without a batchable event.
    await getPrisma().moderationNotificationEvent.create({
      data: {
        kind: 'new_product',
        sourceId: p.id,
        submissionVersion: p.version + 1,
        submittedAt: new Date(),
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'valid-token', platform: 'android' },
    });
    expect(res.statusCode).toBe(500);
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('draft');
    expect(row.version).toBe(p.version);
    await app.close();
  });

  it('records no notification event when a stale version submit is rejected', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version + 99, abuseToken: 'valid-token', platform: 'android' },
    });
    expect(res.statusCode).toBe(409);
    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: p.id } });
    expect(events).toHaveLength(0);
    await app.close();
  });

  it('records no notification event when the abuse assessment rejects the submit', async () => {
    stubAssessmentClient(0.1);
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'valid-token', platform: 'android' },
    });
    expect(res.statusCode).toBe(403);
    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: p.id } });
    expect(events).toHaveLength(0);
    await app.close();
  });

  it('two concurrent valid submits at the same version record exactly one notification event', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const [a, b] = await Promise.all([
      app.inject({ method: 'POST', url: `/v1/products/drafts/${p.id}/submit`, headers: idemHeaders(headers), payload: { version: p.version, abuseToken: 'valid-token', platform: 'android' } }),
      app.inject({ method: 'POST', url: `/v1/products/drafts/${p.id}/submit`, headers: idemHeaders(headers), payload: { version: p.version, abuseToken: 'valid-token', platform: 'android' } }),
    ]);
    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: p.id } });
    expect(events).toHaveLength(1);
    await app.close();
  });

  it('a resubmission after changes_required records a second event at the new version', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const first = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'valid-token', platform: 'android' },
    });
    expect(first.statusCode).toBe(200);
    // Admin requests changes, then the creator resubmits at the new version.
    const afterFirst = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required', version: { increment: 1 } } });
    const resubmitVersion = afterFirst.version + 1;
    const second = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: resubmitVersion, abuseToken: 'valid-token', platform: 'android' },
    });
    expect(second.statusCode).toBe(200);
    const events = await getPrisma().moderationNotificationEvent.findMany({ where: { sourceId: p.id }, orderBy: { submissionVersion: 'asc' } });
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.submissionVersion)).toEqual([afterFirst.version, resubmitVersion + 1]);
    await app.close();
  });

  it('non-enumerating 404 for another user\'s draft', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: owner.id });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'x', platform: 'android' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('refuses under product_creation mode off, even with a genuinely valid token, and never writes anything', async () => {
    await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'off' } } });
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'valid-token', platform: 'android' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('feature_disabled');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('draft');
    await app.close();
  });

  it('rejects a token whose score is below threshold, and never transitions the draft', async () => {
    stubAssessmentClient(0.1);
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'low-score', platform: 'android' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('abuse_check_failed');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('draft');
    await app.close();
  });

  it('a token minted for one platform submitted with the other platform is rejected, never accepted', async () => {
    // The stub client is platform-agnostic (it doesn't know which site key was
    // used), so this proves the request-level contract: the server always
    // asks for the site key matching the *submitted* platform, and a token
    // that was actually minted for the other one fails Google's own
    // action/site-key validation — modeled here as tokenProperties.valid=false,
    // exactly what a real cross-platform token mismatch produces.
    setProductCreationAssessmentClientForTests({
      projectPath: (p: string) => `projects/${p}`,
      createAssessment: async () => [{ tokenProperties: { valid: false }, riskAnalysis: {} }],
    } as never);
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'minted-for-android', platform: 'ios' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('abuse_check_failed');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('draft');
    await app.close();
  });

  it('a provider timeout/error is retryable — 503, never a silent accept, and the idempotency-key retry does not double-submit', async () => {
    setProductCreationAssessmentClientForTests({
      projectPath: (p: string) => `projects/${p}`,
      createAssessment: async () => {
        throw new Error('ECONNREFUSED');
      },
    } as never);
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const idemHeader = idemHeaders(headers);

    const res1 = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeader,
      payload: { version: p.version, abuseToken: 'x', platform: 'android' },
    });
    expect(res1.statusCode).toBe(503);
    const afterFirst = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(afterFirst.status).toBe('draft'); // nothing written on provider failure

    // A >=500 response is never cached by the idempotency plugin, so the retry
    // with the same Idempotency-Key genuinely re-executes rather than
    // replaying a stale response.
    stubAssessmentClient();
    const res2 = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeader,
      payload: { version: p.version, abuseToken: 'x', platform: 'android' },
    });
    expect(res2.statusCode).toBe(200);
    const afterSecond = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(afterSecond.status).toBe('pending');
    await app.close();
  });

  it('a stale version is rejected with 409 version_conflict, never transitioning the draft', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version + 1, abuseToken: 'x', platform: 'android' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('version_conflict');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('draft');
    await app.close();
  });

  it('internal mode: an allowlisted user may submit, a non-allowlisted user may not', async () => {
    await getPrisma().setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'internal' } } });
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    process.env.PRODUCT_CREATION_INTERNAL_ALLOWLIST = user.id;
    resetConfigForTests();

    const allowed = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: allowed.id }, data: { status: 'draft' } });
    const allowedRes = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${allowed.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: allowed.version, abuseToken: 'x', platform: 'android' },
    });
    expect(allowedRes.statusCode).toBe(200);

    const { headers: otherHeaders, user: otherUser } = await authedUser();
    const blocked = await makeProduct({ createdByUserId: otherUser.id });
    await getPrisma().product.update({ where: { id: blocked.id }, data: { status: 'draft' } });
    const blockedRes = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${blocked.id}/submit`,
      headers: idemHeaders(otherHeaders),
      payload: { version: blocked.version, abuseToken: 'x', platform: 'android' },
    });
    expect(blockedRes.statusCode).toBe(403);
    expect(blockedRes.json().code).toBe('feature_disabled');

    delete process.env.PRODUCT_CREATION_INTERNAL_ALLOWLIST;
    resetConfigForTests();
    await app.close();
  });

  it('two concurrent valid submits at the same version: exactly one succeeds, the other gets a version conflict', async () => {
    stubAssessmentClient();
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const [r1, r2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/products/drafts/${p.id}/submit`,
        headers: idemHeaders(headers),
        payload: { version: p.version, abuseToken: 'x', platform: 'android' },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/products/drafts/${p.id}/submit`,
        headers: idemHeaders(headers),
        payload: { version: p.version, abuseToken: 'x', platform: 'android' },
      }),
    ]);
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409]);
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('pending');
    await app.close();
  });
});

describe('GET /v1/products/drafts', () => {
  it('lists only the caller\'s own creator-private rows, cursor-paginated newest first', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const other = await makeUser({ emailVerified: true });
    await makeProduct({ createdByUserId: other.id });

    const p1 = await makeProduct({ createdByUserId: user.id, name: 'One' });
    await getPrisma().product.update({ where: { id: p1.id }, data: { status: 'draft' } });
    await new Promise((r) => setTimeout(r, 5));
    const p2 = await makeProduct({ createdByUserId: user.id, name: 'Two' });
    await getPrisma().product.update({ where: { id: p2.id }, data: { status: 'changes_required' } });
    await new Promise((r) => setTimeout(r, 5));
    const p3 = await makeProduct({ createdByUserId: user.id, name: 'Three' });
    await getPrisma().product.update({ where: { id: p3.id }, data: { status: 'pending' } });
    // Not creator-private — excluded even though owned by the caller.
    const activeOwn = await makeProduct({ createdByUserId: user.id, name: 'ActiveOwnNotDraft' });
    await getPrisma().product.update({ where: { id: activeOwn.id }, data: { status: 'active' } });

    const page1 = await app.inject({
      method: 'GET',
      url: '/v1/products/drafts?limit=2',
      headers,
    });
    expect(page1.statusCode).toBe(200);
    const body1 = page1.json();
    expect(body1.items.map((i: { id: string }) => i.id)).toEqual([p3.id, p2.id]);
    expect(body1.nextCursor).not.toBeNull();

    const page2 = await app.inject({
      method: 'GET',
      url: `/v1/products/drafts?limit=2&cursor=${encodeURIComponent(body1.nextCursor)}`,
      headers,
    });
    const body2 = page2.json();
    expect(body2.items.map((i: { id: string }) => i.id)).toEqual([p1.id]);
    expect(body2.nextCursor).toBeNull();
    await app.close();
  });

  it('filters by status', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'pending' } });
    await makeProduct({ createdByUserId: user.id });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/drafts?status=pending',
      headers,
    });
    const body = res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].id).toBe(p.id);
    await app.close();
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/products/drafts' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it.each([
    Buffer.from(JSON.stringify({ t: 'not-a-date', i: 'not-a-uuid' })).toString('base64url'),
    Buffer.from(JSON.stringify({ t: '2026-01-01T00:00:00.000Z', i: { $ne: null } })).toString('base64url'),
    Buffer.from(JSON.stringify({ t: null, i: null })).toString('base64url'),
  ])('a hostile cursor is a 400 validation error, never a 500', async (hostileCursor) => {
    const app = await buildServer();
    const { headers } = await authedUser();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/products/drafts?cursor=${encodeURIComponent(hostileCursor)}`,
      headers,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
