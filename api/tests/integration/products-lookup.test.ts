import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authHeaders(role: 'user' | 'admin' = 'user') {
  const u = await makeUser({ role, emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

afterEach(() => {
  vi.doUnmock('../../src/services/products/off-client.js');
  vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  vi.resetModules();
});

async function mockExternalMiss() {
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

describe('POST /v1/products/lookup (legacy)', () => {
  it('returns cached product on barcode hit', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    await makeProduct({ barcode: '5449000000996', name: 'Coke' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup',
      headers,
      payload: { barcode: '5449000000996' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().product.name).toBe('Coke');
    await app.close();
  });

  it('returns 404 when nothing found and externals all miss', async () => {
    const app = await mockExternalMiss();
    const { headers } = await authHeaders();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup',
      headers,
      payload: { barcode: '0000000000000' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('not_found');
    await app.close();
  });

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup',
      payload: { barcode: '5449000000996' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('rejects payload with neither barcode nor qr', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup',
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    await app.close();
  });

  it.each(['draft', 'pending', 'changes_required', 'report_hidden', 'merged_into'] as const)(
    'an exact local %s row is a plain 404 with no external call/backfill',
    async (status) => {
      const app = await mockExternalMiss();
      const { user, headers } = await authHeaders();
      const p = await makeProduct({ barcode: '1234500006789', createdByUserId: user.id });
      await getPrisma().product.update({ where: { id: p.id }, data: { status } });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/products/lookup',
        headers,
        payload: { barcode: '1234500006789' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('not_found');
      await app.close();
    },
  );
});

describe('POST /v1/products/lookup-v2', () => {
  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      payload: { barcode: '5449000000996' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('active product -> found', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    await makeProduct({ barcode: '5449000000996', name: 'Coke' });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '5449000000996' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ outcome: 'found' });
    expect(res.json().product.name).toBe('Coke');
    await app.close();
  });

  it("creator's own draft -> editable_private with the product", async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const p = await makeProduct({ barcode: '1230000000001', createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '1230000000001' },
    });
    expect(res.json()).toMatchObject({ outcome: 'editable_private' });
    await app.close();
  });

  it("creator's own pending -> creator_pending", async () => {
    const app = await buildServer();
    const { user, headers } = await authHeaders();
    const p = await makeProduct({ barcode: '1230000000002', createdByUserId: user.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'pending' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '1230000000002' },
    });
    expect(res.json()).toMatchObject({ outcome: 'creator_pending' });
    await app.close();
  });

  it("another user's private draft -> under_review with no metadata", async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const { headers } = await authHeaders();
    const p = await makeProduct({ barcode: '1230000000003', createdByUserId: owner.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '1230000000003' },
    });
    expect(res.json()).toEqual({ outcome: 'under_review' });
    await app.close();
  });

  it('report_hidden -> under_review for an ordinary user', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    const p = await makeProduct({ barcode: '1230000000004' });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'report_hidden' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '1230000000004' },
    });
    expect(res.json()).toEqual({ outcome: 'under_review' });
    await app.close();
  });

  it('admin sees a private draft as a read-only authorized result, not editable_private', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders('admin');
    const owner = await makeUser({ emailVerified: true });
    const p = await makeProduct({ barcode: '1230000000005', createdByUserId: owner.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '1230000000005' },
    });
    expect(res.json()).toMatchObject({ outcome: 'creator_pending' });
    await app.close();
  });

  it('full conclusive miss -> not_found, canCreate false', async () => {
    const app = await mockExternalMiss();
    const { headers } = await authHeaders();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '9990000000001' },
    });
    expect(res.json()).toEqual({ outcome: 'not_found', canCreate: false });
    await app.close();
  });

  it('provider unavailable -> temporarily_unavailable, never a conclusive miss', async () => {
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockResolvedValue({ status: 'unavailable' }),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'unavailable' }),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const { headers } = await authHeaders();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '9990000000002' },
    });
    expect(res.json()).toEqual({ outcome: 'temporarily_unavailable' });
    await app.close();
  });

  it('qr-only local miss is conclusive not_found without any external call', async () => {
    const app = await mockExternalMiss();
    const { headers } = await authHeaders();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { qr: 'unknown-qr-payload' },
    });
    expect(res.json()).toEqual({ outcome: 'not_found', canCreate: false });
    await app.close();
  });

  it('a private draft that wins the create race during the external round trip is never leaked as found', async () => {
    const other = await makeUser({ emailVerified: true });
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockImplementation(async () => {
        await getPrisma().product.create({
          data: {
            barcode: '1230000000009',
            name: 'Race Draft',
            source: 'user',
            createdByUserId: other.id,
            status: 'draft',
          },
        });
        return { status: 'found', data: { barcode: '1230000000009', name: 'External Name', brand: null, category: null, imageUrl: null, source: 'off', sourceId: '1230000000009' } };
      }),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue({ status: 'not_found' }),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const { headers } = await authHeaders();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '1230000000009' },
    });
    // The route always parses the response through productLookupV2ResponseSchema,
    // which pins `status` per outcome — this response must both avoid 'found' at
    // the service level AND pass schema validation (no 500).
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ outcome: 'under_review' });
    await app.close();
  });

  it('merged_into resolves to the active canonical product over HTTP', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    const canonical = await makeProduct({ barcode: '1230000000010', name: 'Canonical Product' });
    const loser = await makeProduct({ barcode: '1230000000011' });
    await getPrisma().product.update({
      where: { id: loser.id },
      data: { status: 'merged_into', mergedIntoProductId: canonical.id },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products/lookup-v2',
      headers,
      payload: { barcode: '1230000000011' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ outcome: 'found' });
    expect(res.json().product.id).toBe(canonical.id);
    await app.close();
  });
});
