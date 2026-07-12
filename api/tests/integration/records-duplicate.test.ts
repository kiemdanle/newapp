import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeProduct } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function authed() {
  const u = await makeUser({ emailVerified: true });
  const token = await issueAccessToken({ sub: u.id, role: u.role, tokenVersion: 0 });
  return { user: u, headers: { authorization: `Bearer ${token}` } };
}

describe('POST /v1/records/:id/duplicate', () => {
  it('duplicates a record with a new expiryDate', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const p = await makeProduct({ name: 'Milk' });
    const src = await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(),
        productId: p.id, customName: 'Milk',
        category: 'dairy', price: 2.50, store: 'Supermart',
        expiryDate: new Date('2099-01-01'), quantity: 2, unit: 'L',
        notes: 'fridge', status: 'active', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'POST', url: `/v1/records/${src.id}/duplicate`,
      headers, payload: { expiryDate: '2099-06-01' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.expiryDate).toBe('2099-06-01');
    expect(body.customName).toBe('Milk');
    expect(body.quantity).toBe(2);
    expect(body.id).not.toBe(src.id);
    expect(body.clientId).not.toBe(src.clientId);
    await app.close();
  });

  it('400 when expiryDate is missing', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const src = await getPrisma().record.create({
      data: {
        userId: user.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-01-01'), quantity: 1, unit: 'pcs',
        status: 'active', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'POST', url: `/v1/records/${src.id}/duplicate`,
      headers, payload: {},
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('404 on another user record', async () => {
    const app = await buildServer();
    const { headers } = await authed();
    const other = await makeUser({});
    const src = await getPrisma().record.create({
      data: {
        userId: other.id, clientId: randomUUID(), customName: 'X',
        expiryDate: new Date('2099-01-01'), quantity: 1, unit: 'pcs',
        status: 'active', notifyAt: [],
      },
    });
    const res = await app.inject({
      method: 'POST', url: `/v1/records/${src.id}/duplicate`,
      headers, payload: { expiryDate: '2099-06-01' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('409 at item cap', async () => {
    const app = await buildServer();
    const { user, headers } = await authed();
    const prisma = getPrisma();
    for (let i = 0; i < 50; i++) {
      await prisma.record.create({
        data: {
          userId: user.id, clientId: randomUUID(), customName: `R${i}`,
          expiryDate: new Date('2099-12-31'), quantity: 1, unit: 'pcs',
          status: 'active', notifyAt: [],
        },
      });
    }
    const src = await prisma.record.findFirst({ where: { userId: user.id } });
    const res = await app.inject({
      method: 'POST', url: `/v1/records/${src!.id}/duplicate`,
      headers, payload: { expiryDate: '2099-06-01' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('item_limit_reached');
    await app.close();
  });
});
