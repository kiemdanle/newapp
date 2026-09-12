import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import { updatePantryLimits } from '../../src/services/admin/settings.js';
import { ERROR_CODES } from '@expyrico/shared';

async function userHeadersFor(userId: string, extra: Record<string, string> = {}) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
    ...extra,
  };
}

describe('Pantry Quota Multi-Vector Transitions & Enforcement', () => {
  it('enforces limit on POST /records for active items but allows terminal items at capacity', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();

    // Set user limit to 2
    await updatePantryLimits({ defaultUserPantryLimit: 2 }, admin.id);

    // Create 2 active items directly
    for (let i = 0; i < 2; i++) {
      await prisma.record.create({
        data: {
          userId: user.id,
          clientId: randomUUID(),
          customName: `ActiveItem-${i}`,
          expiryDate: new Date('2026-10-01'),
          quantity: 1,
          unit: 'pcs',
          status: 'active',
          notifyAt: [],
        },
      });
    }

    // 3rd active create should fail with 409
    const activeRes = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      payload: {
        clientId: randomUUID(),
        customName: 'OverflowActive',
        expiryDate: '2026-10-01',
      },
    });
    expect(activeRes.statusCode).toBe(409);
    expect(activeRes.json().code).toBe(ERROR_CODES.ITEM_LIMIT_REACHED);

    // Consumed create should succeed even at capacity
    const consumedRes = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      payload: {
        clientId: randomUUID(),
        customName: 'ConsumedHistory',
        expiryDate: '2026-10-01',
        status: 'consumed',
        consumedAt: new Date().toISOString(),
      },
    });
    expect(consumedRes.statusCode).toBe(201);
    expect(consumedRes.json().status).toBe('consumed');

    await app.close();
  });

  it('allows idempotent replay of committed POST /records under lock without quota error', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const clientId = randomUUID();

    // Set limit to 1
    await updatePantryLimits({ defaultUserPantryLimit: 1 }, admin.id);

    // First request fills the only slot
    const res1 = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      payload: {
        clientId,
        customName: 'SoleItem',
        expiryDate: '2026-10-01',
      },
    });
    expect(res1.statusCode).toBe(201);

    // Replay with the same clientId (e.g. dropped network response)
    const res2 = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      payload: {
        clientId,
        customName: 'SoleItem',
        expiryDate: '2026-10-01',
      },
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().id).toBe(res1.json().id);

    await app.close();
  });

  it('rejects POST /records/:id/duplicate when at capacity', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();

    await updatePantryLimits({ defaultUserPantryLimit: 1 }, admin.id);

    const source = await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'Duplicable',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'active',
        notifyAt: [],
      },
    });

    // At capacity (1/1): duplicate must fail with 409
    const dupRes = await app.inject({
      method: 'POST',
      url: `/v1/records/${source.id}/duplicate`,
      headers,
      payload: {
        expiryDate: '2026-11-01',
      },
    });
    expect(dupRes.statusCode).toBe(409);
    expect(dupRes.json().code).toBe(ERROR_CODES.ITEM_LIMIT_REACHED);

    await app.close();
  });

  it('PATCH /records/:id rejects reactivation at capacity but allows quota-neutral updates', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();

    await updatePantryLimits({ defaultUserPantryLimit: 1 }, admin.id);

    // Create 1 active record (fills capacity)
    const activeRecord = await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'ActiveItem',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'active',
        notifyAt: [],
      },
    });

    // Create 1 consumed record
    const consumedRecord = await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'ConsumedItem',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'consumed',
        notifyAt: [],
      },
    });

    // 1. Quota-neutral update on activeRecord (change notes) succeeds
    const patchNotesRes = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${activeRecord.id}`,
      headers,
      payload: { notes: 'Updated notes' },
    });
    expect(patchNotesRes.statusCode).toBe(200);

    // 2. Reactivating consumedRecord fails with 409
    const reactivateRes = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${consumedRecord.id}`,
      headers,
      payload: { status: 'active' },
    });
    expect(reactivateRes.statusCode).toBe(409);
    expect(reactivateRes.json().code).toBe(ERROR_CODES.ITEM_LIMIT_REACHED);

    // 3. Consume the active item, freeing space
    const consumeRes = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${activeRecord.id}`,
      headers,
      payload: { status: 'consumed' },
    });
    expect(consumeRes.statusCode).toBe(200);

    // 4. Now reactivate consumedRecord succeeds
    const reactivateSuccessRes = await app.inject({
      method: 'PATCH',
      url: `/v1/records/${consumedRecord.id}`,
      headers,
      payload: { status: 'active' },
    });
    expect(reactivateSuccessRes.statusCode).toBe(200);
    expect(reactivateSuccessRes.json().status).toBe('active');

    await app.close();
  });

  it('POST /giveaways/:id/cancel rolls back when owner is at capacity and serializes double-cancel race', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const giver = await makeUser({ emailVerified: true });
    const claimsUser = await makeUser({ emailVerified: true });
    const giverHeaders = await userHeadersFor(giver.id);
    const prisma = getPrisma();

    // Set giver limit to 1
    await updatePantryLimits({ defaultUserPantryLimit: 1 }, admin.id);

    // Create a record that is consumed because it was given away (quantity 0)
    const record = await prisma.record.create({
      data: {
        userId: giver.id,
        clientId: randomUUID(),
        customName: 'GivenAwayItem',
        expiryDate: new Date('2026-10-01'),
        quantity: 0,
        unit: 'pcs',
        status: 'consumed',
        notifyAt: [],
      },
    });

    // Create a second active item that fills giver's capacity (1/1)
    await prisma.record.create({
      data: {
        userId: giver.id,
        clientId: randomUUID(),
        customName: 'BlockingActiveItem',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'active',
        notifyAt: [],
      },
    });

    // Create a claimed giveaway pointing at the consumed record
    const giveaway = await prisma.giveaway.create({
      data: {
        giverUserId: giver.id,
        recordId: record.id,
        title: 'Free Food',
        locationText: 'Main Street',
        quantity: 1,
        status: 'claimed',
      },
    });

    // Cancel giveaway when giver is full: should fail with 409 ITEM_LIMIT_REACHED and leave giveaway claimed
    const cancelFailRes = await app.inject({
      method: 'POST',
      url: `/v1/giveaways/${giveaway.id}/cancel`,
      headers: giverHeaders,
    });
    expect(cancelFailRes.statusCode).toBe(409);
    expect(cancelFailRes.json().code).toBe(ERROR_CODES.ITEM_LIMIT_REACHED);

    const checkGiveaway = await prisma.giveaway.findUnique({ where: { id: giveaway.id } });
    expect(checkGiveaway?.status).toBe('claimed');
    const checkRecord = await prisma.record.findUnique({ where: { id: record.id } });
    expect(checkRecord?.status).toBe('consumed');

    // Free up space by expanding limit to 5
    await updatePantryLimits({ defaultUserPantryLimit: 5 }, admin.id);

    // Test concurrent double-cancel race
    const [race1, race2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/giveaways/${giveaway.id}/cancel`,
        headers: giverHeaders,
      }),
      app.inject({
        method: 'POST',
        url: `/v1/giveaways/${giveaway.id}/cancel`,
        headers: giverHeaders,
      }),
    ]);

    const statuses = [race1.statusCode, race2.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    const finalRecord = await prisma.record.findUnique({ where: { id: record.id } });
    expect(finalRecord?.status).toBe('active');
    expect(Number(finalRecord?.quantity)).toBe(1);

    await app.close();
  });

  it('releases idempotency reservation key on 409 quota error, allowing retry after space is freed', async () => {
    const app = await buildServer();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();
    const idempotencyKey = randomUUID();
    const clientId = randomUUID();

    await updatePantryLimits({ defaultUserPantryLimit: 1 }, admin.id);

    // Create 1 active record to fill capacity
    const filler = await prisma.record.create({
      data: {
        userId: user.id,
        clientId: randomUUID(),
        customName: 'Filler',
        expiryDate: new Date('2026-10-01'),
        quantity: 1,
        unit: 'pcs',
        status: 'active',
        notifyAt: [],
      },
    });

    // Request with Idempotency-Key fails with 409 ITEM_LIMIT_REACHED
    const resFail = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
      payload: {
        clientId,
        customName: 'NewItem',
        expiryDate: '2026-10-01',
      },
    });
    expect(resFail.statusCode).toBe(409);
    expect(resFail.json().code).toBe(ERROR_CODES.ITEM_LIMIT_REACHED);

    // Delete filler to free space
    await prisma.record.delete({ where: { id: filler.id } });

    // Retry with the EXACT same Idempotency-Key: must NOT receive cached 409, but succeed with 201
    const resRetry = await app.inject({
      method: 'POST',
      url: '/v1/records',
      headers: { ...headers, 'Idempotency-Key': idempotencyKey },
      payload: {
        clientId,
        customName: 'NewItem',
        expiryDate: '2026-10-01',
      },
    });
    expect(resRetry.statusCode).toBe(201);
    expect(resRetry.json().customName).toBe('NewItem');

    await app.close();
  });
});
