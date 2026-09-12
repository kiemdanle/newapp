import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { updatePantryLimits } from '../../src/services/admin/settings.js';
import { ERROR_CODES } from '@expyrico/shared';

async function userHeadersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
  };
}

describe('Pantry Quota Advisory Lock Concurrency & Serialization', () => {
  it('serializes concurrent POST /records requests and never overshoots quota', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();

    // User limit is 2; 1 item is already active -> exactly 1 slot available
    await updatePantryLimits({ defaultUserPantryLimit: 2 }, admin.id);

    await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'ExistingActive',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'active',
        notifyAt: [],
      },
    });

    // Fire 5 concurrent create requests competing for 1 remaining slot
    const requests = Array.from({ length: 5 }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/v1/records',
        headers: { ...headers, 'Idempotency-Key': randomUUID() },
        payload: {
          clientId: randomUUID(),
          customName: `Competitor-${i}`,
          expiryDate: '2026-10-01',
        },
      }),
    );

    const responses = await Promise.all(requests);
    const statusCodes = responses.map((r) => r.statusCode);
    const successes = statusCodes.filter((s) => s === 201);
    const rejections = statusCodes.filter((s) => s === 409);

    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(4);

    for (const rej of responses.filter((r) => r.statusCode === 409)) {
      expect(rej.json().code).toBe(ERROR_CODES.ITEM_LIMIT_REACHED);
    }

    const finalActiveCount = await prisma.record.count({
      where: { userId: user.id, status: 'active' },
    });
    expect(finalActiveCount).toBe(2);

    await app.close();
  });

  it('serializes concurrent duplicate and create racing for the last slot', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();

    // User limit is 2; 1 item is already active
    await updatePantryLimits({ defaultUserPantryLimit: 2 }, admin.id);

    const source = await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'SourceRecord',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'active',
        notifyAt: [],
      },
    });

    // Compete: duplicate vs. new create
    const [dupRes, createRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/records/${source.id}/duplicate`,
        headers,
        payload: { expiryDate: '2026-11-01' },
      }),
      app.inject({
        method: 'POST',
        url: '/v1/records',
        headers: { ...headers, 'Idempotency-Key': randomUUID() },
        payload: {
          clientId: randomUUID(),
          customName: 'RacingCreate',
          expiryDate: '2026-10-01',
        },
      }),
    ]);

    const statusCodes = [dupRes.statusCode, createRes.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);

    const finalActiveCount = await prisma.record.count({
      where: { userId: user.id, status: 'active' },
    });
    expect(finalActiveCount).toBe(2);

    await app.close();
  });

  it('serializes concurrent PATCH reactivation and POST create racing for the last slot', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();

    await updatePantryLimits({ defaultUserPantryLimit: 2 }, admin.id);

    // 1 active, 1 consumed
    await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'InitialActive',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'active',
        notifyAt: [],
      },
    });

    const consumed = await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'ConsumedTarget',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'consumed',
        notifyAt: [],
      },
    });

    // Compete: reactivate consumed item vs. create new item
    const [reactivateRes, createRes] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/v1/records/${consumed.id}`,
        headers,
        payload: { status: 'active' },
      }),
      app.inject({
        method: 'POST',
        url: '/v1/records',
        headers: { ...headers, 'Idempotency-Key': randomUUID() },
        payload: {
          clientId: randomUUID(),
          customName: 'CompetingNew',
          expiryDate: '2026-10-01',
        },
      }),
    ]);

    const statusCodes = [reactivateRes.statusCode, createRes.statusCode].sort();
    expect([200, 201]).toContain(statusCodes[0]);
    expect(statusCodes[1]).toBe(409);

    const finalActiveCount = await prisma.record.count({
      where: { userId: user.id, status: 'active' },
    });
    expect(finalActiveCount).toBe(2);

    await app.close();
  });
});
