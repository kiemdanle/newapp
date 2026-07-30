import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authHeaders(role: 'user' | 'admin' = 'user') {
  const u = await makeUser({ role, emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('GET /v1/products/:id visibility', () => {
  it('active product is visible to any authenticated user', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    const p = await makeProduct({ name: 'Visible Thing' });
    const res = await app.inject({ method: 'GET', url: `/v1/products/${p.id}`, headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Visible Thing');
    await app.close();
  });

  it.each(['draft', 'pending', 'changes_required'] as const)(
    'creator sees their own %s product',
    async (status) => {
      const app = await buildServer();
      const { user, headers } = await authHeaders();
      const p = await makeProduct({ createdByUserId: user.id });
      await getPrisma().product.update({ where: { id: p.id }, data: { status } });
      const res = await app.inject({ method: 'GET', url: `/v1/products/${p.id}`, headers });
      expect(res.statusCode).toBe(200);
      await app.close();
    },
  );

  it.each(['draft', 'pending', 'changes_required'] as const)(
    'another user gets a non-enumerating 404 for someone else\'s %s product',
    async (status) => {
      const app = await buildServer();
      const owner = await makeUser({ emailVerified: true });
      const { headers } = await authHeaders();
      const p = await makeProduct({ createdByUserId: owner.id });
      await getPrisma().product.update({ where: { id: p.id }, data: { status } });
      const res = await app.inject({ method: 'GET', url: `/v1/products/${p.id}`, headers });
      expect(res.statusCode).toBe(404);
      await app.close();
    },
  );

  it('ordinary user gets 404 for a report_hidden product', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    const p = await makeProduct();
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'report_hidden' } });
    const res = await app.inject({ method: 'GET', url: `/v1/products/${p.id}`, headers });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it.each(['draft', 'pending', 'changes_required', 'report_hidden'] as const)(
    'admin sees a %s product',
    async (status) => {
      const app = await buildServer();
      const { headers } = await authHeaders('admin');
      const p = await makeProduct();
      await getPrisma().product.update({ where: { id: p.id }, data: { status } });
      const res = await app.inject({ method: 'GET', url: `/v1/products/${p.id}`, headers });
      expect(res.statusCode).toBe(200);
      await app.close();
    },
  );

  it('404 for a nonexistent product id', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/00000000-0000-0000-0000-000000000099',
      headers,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('GET /v1/products/search visibility', () => {
  it('never returns a non-active product', async () => {
    const app = await buildServer();
    const { headers } = await authHeaders();
    const p = await makeProduct({ name: 'Hidden Search Item' });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/products/search?q=Hidden%20Search%20Item',
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
    await app.close();
  });
});
