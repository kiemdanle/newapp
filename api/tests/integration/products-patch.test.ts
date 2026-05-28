import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('PATCH /v1/products/:id', () => {
  it('creates a pending product_edits row, does NOT mutate the product', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const p = await makeProduct({ name: 'Old Name' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: { name: 'New Name', brand: 'Acme' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().status).toBe('pending');

    const fresh = await getPrisma().product.findUnique({ where: { id: p.id } });
    expect(fresh?.name).toBe('Old Name'); // unchanged

    const edits = await getPrisma().productEdit.findMany({ where: { productId: p.id } });
    expect(edits).toHaveLength(1);
    expect(edits[0]!.submittedBy).toBe(user.id);
    expect(edits[0]!.status).toBe('pending');
    expect((edits[0]!.proposed as { name?: string }).name).toBe('New Name');
    await app.close();
  });

  it('404 on unknown product', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/products/00000000-0000-0000-0000-000000000000',
      headers,
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('400 on empty patch', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const p = await makeProduct({});
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
