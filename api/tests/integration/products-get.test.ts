import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';

async function authHeaders() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { authorization: `Bearer ${token}` };
}

describe('GET /v1/products/:id', () => {
  it('returns the product with empty topReviews in M1', async () => {
    const app = await buildServer();
    const h = await authHeaders();
    const p = await makeProduct({ name: 'Yogurt' });
    const res = await app.inject({ method: 'GET', url: `/v1/products/${p.id}`, headers: h });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(p.id);
    expect(body.topReviews).toEqual([]);
    await app.close();
  });

  it('404 on unknown id', async () => {
    const app = await buildServer();
    const h = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/00000000-0000-0000-0000-000000000000',
      headers: h,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
