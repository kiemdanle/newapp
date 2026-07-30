import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authedUser(role: 'user' | 'admin' = 'user') {
  const u = await makeUser({ role, emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/products (legacy, retired)', () => {
  it.each(['off', 'internal', 'all'] as const)(
    'always returns typed upgrade_required in %s mode and inserts nothing',
    async (mode) => {
      const app = await buildServer();
      const { headers } = await authedUser();
      await getPrisma().setting.upsert({
        where: { key: 'product_creation' },
        update: { value: { mode } },
        create: { key: 'product_creation', value: { mode } },
      });
      const before = await getPrisma().product.count();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/products',
        headers,
        payload: { name: 'Homemade Jam', brand: 'Mom', defaultShelfLifeDays: 60 },
      });
      expect(res.statusCode).toBe(410);
      expect(res.json().code).toBe('upgrade_required');
      const after = await getPrisma().product.count();
      expect(after).toBe(before);
      await app.close();
    },
  );

  it('blocks admins too', async () => {
    const app = await buildServer();
    const { headers } = await authedUser('admin');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products',
      headers,
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe('upgrade_required');
    await app.close();
  });

  it('still validates the payload before rejecting (400 on empty name)', async () => {
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

  it('requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/products',
      payload: { name: 'X' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
