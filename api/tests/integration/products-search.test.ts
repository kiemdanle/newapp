import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function authHeaders() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { authorization: `Bearer ${token}` };
}

describe('GET /v1/products/search', () => {
  it('returns fuzzy matches above similarity 0.3', async () => {
    const app = await buildServer();
    const h = await authHeaders();
    await makeProduct({ name: 'Coca-Cola Classic', brand: 'Coca-Cola' });
    await makeProduct({ name: 'Pepsi Max', brand: 'Pepsi' });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/search?q=coca',
      headers: h,
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].name).toContain('Coca');
    await app.close();
  });

  it('rejects empty q', async () => {
    const app = await buildServer();
    const h = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/search?q=',
      headers: h,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('respects limit cap of 50', async () => {
    const app = await buildServer();
    const h = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/search?q=x&limit=500',
      headers: h,
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
