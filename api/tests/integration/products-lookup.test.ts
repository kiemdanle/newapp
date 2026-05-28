import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function authHeaders(role: 'user' | 'admin' = 'user') {
  const u = await makeUser({ role, emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { authorization: `Bearer ${token}` };
}

afterEach(() => {
  vi.doUnmock('../../src/services/products/off-client.js');
  vi.doUnmock('../../src/services/products/upcitemdb-client.js');
  vi.resetModules();
});

describe('POST /v1/products/lookup', () => {
  it('returns cached product on barcode hit', async () => {
    const app = await buildServer();
    const headers = await authHeaders();
    await makeProduct({ barcode: '5449000000996', name: 'Coke', source: 'off' });
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
    vi.doMock('../../src/services/products/off-client.js', () => ({
      lookupOff: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock('../../src/services/products/upcitemdb-client.js', () => ({
      lookupUpcitemdb: vi.fn().mockResolvedValue(null),
    }));
    vi.resetModules();
    const { buildServer: build2 } = await import('../../src/server.js');
    const app = await build2();
    const headers = await authHeaders();
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
    const headers = await authHeaders();
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
});
