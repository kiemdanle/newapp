import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { randomUUID } from 'node:crypto';

afterEach(() => {
  vi.doUnmock('../../src/services/products/off-client.js');
  vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  vi.resetModules();
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
      payload: { name: 'Grandma\'s Salsa', description: 'Spicy and smooth', brand: 'Grandma' },
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
      payload: { name: 'New Name' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().description).toBe('Keep me');
    await app.close();
  });

  it('rejects control characters in the description', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { description: 'bad\x07value' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('cannot change the immutable barcode/qrPayload identifier', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id, barcode: '2223334440001' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/drafts/${p.id}`,
      headers,
      payload: { barcode: '9999999999999' },
    });
    expect(res.statusCode).toBe(400);
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.barcode).toBe('2223334440001');
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
      payload: { name: 'Hijack' },
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
      payload: { name: 'Too late' },
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
      payload: { name: 'Fixed per feedback' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});

describe('POST /v1/products/drafts/:id/submit', () => {
  it('is unconditionally feature-disabled and never transitions to pending', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'anything' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('feature_disabled');
    const row = await getPrisma().product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.status).toBe('draft');
    await app.close();
  });

  it('non-enumerating 404 for another user\'s draft', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authedUser();
    const p = await makeProduct({ createdByUserId: owner.id });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/products/drafts/${p.id}/submit`,
      headers: idemHeaders(headers),
      payload: { version: p.version, abuseToken: 'x' },
    });
    expect(res.statusCode).toBe(404);
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
});
