import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership, makeRecord } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('POST /v1/records/bulk-scope', () => {
  it('moves personal records into a household the user belongs to', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(user.id, { name: 'Family Kitchen' });
    const prisma = getPrisma();

    const r1 = await makeRecord(user.id, { customName: 'Apples' });
    const r2 = await makeRecord(user.id, { customName: 'Bananas' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(user.id),
      payload: {
        recordIds: [r1.id, r2.id],
        targetHouseholdId: hh.id,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.updatedCount).toBe(2);
    expect(body.recordIds).toEqual(expect.arrayContaining([r1.id, r2.id]));

    const updatedR1 = await prisma.record.findUniqueOrThrow({ where: { id: r1.id } });
    const updatedR2 = await prisma.record.findUniqueOrThrow({ where: { id: r2.id } });
    expect(updatedR1.householdId).toBe(hh.id);
    expect(updatedR2.householdId).toBe(hh.id);

    await app.close();
  });

  it('moves household records back to personal pantry when user is creator', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(user.id, { name: 'Family Kitchen' });
    const prisma = getPrisma();

    const r1 = await makeRecord(user.id, { customName: 'Milk', householdId: hh.id });
    const r2 = await makeRecord(user.id, { customName: 'Eggs', householdId: hh.id });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(user.id),
      payload: {
        recordIds: [r1.id, r2.id],
        targetHouseholdId: null,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.updatedCount).toBe(2);
    expect(body.recordIds).toEqual(expect.arrayContaining([r1.id, r2.id]));

    const updatedR1 = await prisma.record.findUniqueOrThrow({ where: { id: r1.id } });
    const updatedR2 = await prisma.record.findUniqueOrThrow({ where: { id: r2.id } });
    expect(updatedR1.householdId).toBeNull();
    expect(updatedR2.householdId).toBeNull();

    await app.close();
  });

  it('handles collision: skips items already in target destination', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(user.id, { name: 'Family Kitchen' });
    const prisma = getPrisma();

    const rAlreadyInHh = await makeRecord(user.id, { customName: 'Cheese', householdId: hh.id });
    const rPersonal = await makeRecord(user.id, { customName: 'Bread' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(user.id),
      payload: {
        recordIds: [rAlreadyInHh.id, rPersonal.id],
        targetHouseholdId: hh.id,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.updatedCount).toBe(1);
    expect(body.recordIds).toEqual([rPersonal.id]);

    const updatedPersonal = await prisma.record.findUniqueOrThrow({ where: { id: rPersonal.id } });
    expect(updatedPersonal.householdId).toBe(hh.id);

    await app.close();
  });

  it('returns updatedCount 0 when all selected items are already in target', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(user.id, { name: 'Family Kitchen' });

    const r1 = await makeRecord(user.id, { customName: 'Item 1', householdId: hh.id });
    const r2 = await makeRecord(user.id, { customName: 'Item 2', householdId: hh.id });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(user.id),
      payload: {
        recordIds: [r1.id, r2.id],
        targetHouseholdId: hh.id,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.updatedCount).toBe(0);
    expect(body.recordIds).toEqual([]);

    await app.close();
  });

  it('rejects with 403 if target household is not accessible to caller', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const otherUser = await makeUser({ emailVerified: true });
    const otherHh = await makeHousehold(otherUser.id, { name: 'Stranger House' });

    const r1 = await makeRecord(user.id, { customName: 'My Secret Item' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(user.id),
      payload: {
        recordIds: [r1.id],
        targetHouseholdId: otherHh.id,
      },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('rejects with 403 if non-creator member attempts to move household item to personal', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Shared House' });
    await makeMembership(hh.id, member.id, { role: 'member' });

    // Item created by owner in shared household
    const r1 = await makeRecord(owner.id, { customName: 'Owner Secret Sauce', householdId: hh.id });

    // Member tries to move it to their personal pantry
    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(member.id),
      payload: {
        recordIds: [r1.id],
        targetHouseholdId: null,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().title).toContain('Only the item creator');
    await app.close();
  });

  it('rejects with 404 (no leak) if record belongs to another user personal scope', async () => {
    const app = await buildServer();
    const userA = await makeUser({ emailVerified: true });
    const userB = await makeUser({ emailVerified: true });

    const rA = await makeRecord(userA.id, { customName: 'Private to A' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(userB.id),
      payload: {
        recordIds: [rA.id],
        targetHouseholdId: null,
      },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('rejects with 404 if any requested record does not exist', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const r1 = await makeRecord(user.id, { customName: 'Real Item' });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/records/bulk-scope',
      headers: await headersFor(user.id),
      payload: {
        recordIds: [r1.id, randomUUID()],
        targetHouseholdId: null,
      },
    });

    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
