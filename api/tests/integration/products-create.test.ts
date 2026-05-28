import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authedUser() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/products', () => {
  it('creates a user-sourced product', async () => {
    const app = await buildServer();
    const { user, headers } = await authedUser();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products',
      headers,
      payload: { name: 'Homemade Jam', brand: 'Mom', defaultShelfLifeDays: 60 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.source).toBe('user');
    expect(body.name).toBe('Homemade Jam');
    const row = await getPrisma().product.findUnique({ where: { id: body.id } });
    expect(row?.createdByUserId).toBe(user.id);
    await app.close();
  });

  it('409 when barcode already exists', async () => {
    const app = await buildServer();
    const { headers } = await authedUser();
    await app.inject({
      method: 'POST',
      url: '/v1/products',
      headers,
      payload: { barcode: '1234567890123', name: 'A' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products',
      headers,
      payload: { barcode: '1234567890123', name: 'B' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('conflict');
    await app.close();
  });

  it('400 on empty name', async () => {
    const app = await buildServer();
    const { headers } = await authedUser();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products',
      headers,
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
