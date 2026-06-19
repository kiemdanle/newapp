import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function userHeaders(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user' })}`,
  };
}

async function adminHeaders(adminId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: adminId, role: 'admin' })}`,
  };
}

describe('admin households', () => {
  it('non-admin gets 401/403 on GET /v1/admin/households', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'GET', url: '/v1/admin/households',
      headers: await userHeaders(user.id),
    });
    expect([401, 403]).toContain(res.statusCode);
    await app.close();
  });

  it('admin lists households with owner info + member count', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Test Home' });

    const res = await app.inject({
      method: 'GET', url: '/v1/admin/households',
      headers: await adminHeaders(admin.id),
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items as Array<{ id: string; name: string; memberCount: number }>;
    const found = items.find((i: { id: string }) => i.id === hh.id);
    expect(found).toBeTruthy();
    expect(found?.name).toBe('Test Home');
    expect(found?.memberCount).toBeGreaterThanOrEqual(1);
    await app.close();
  });

  it('admin dissolves a household: records survive, household deleted', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'To Dissolve' });
    // Add a member and a shared record.
    const prisma = getPrisma();
    await prisma.householdMember.create({
      data: { householdId: hh.id, userId: member.id, role: 'member' },
    });
    const rec = await prisma.record.create({
      data: {
        userId: member.id, householdId: hh.id, clientId: randomUUID(),
        customName: 'Shared item', expiryDate: new Date('2099-12-31'),
        quantity: 1, unit: 'pcs', notifyAt: [],
      },
    });

    const res = await app.inject({
      method: 'DELETE', url: `/v1/admin/households/${hh.id}`,
      headers: {
        ...await adminHeaders(admin.id),
        'idempotency-key': randomUUID(),
      },
    });
    expect(res.statusCode).toBe(204);

    // Household row gone.
    expect(await prisma.household.findUnique({ where: { id: hh.id } })).toBeNull();
    // Record survives with household_id nulled (FK SetNull).
    const row = await prisma.record.findUnique({ where: { id: rec.id } });
    expect(row).not.toBeNull();
    expect(row?.householdId).toBeNull();
    expect(row?.userId).toBe(member.id);
    // Members cascade-deleted.
    expect(await prisma.householdMember.count({ where: { householdId: hh.id } })).toBe(0);

    await app.close();
  });

  it('non-admin gets 401/403 on DELETE /v1/admin/households', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const owner = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);

    const res = await app.inject({
      method: 'DELETE', url: `/v1/admin/households/${hh.id}`,
      headers: {
        ...await userHeaders(user.id),
        'idempotency-key': randomUUID(),
      },
    });
    expect([401, 403]).toContain(res.statusCode);
    // Household still exists.
    expect(await getPrisma().household.findUnique({ where: { id: hh.id } })).not.toBeNull();
    await app.close();
  });
});
