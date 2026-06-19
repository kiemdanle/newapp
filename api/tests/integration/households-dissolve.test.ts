import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser, makeHousehold, makeMembership, makeRecord } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';

async function headersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user' })}`,
    'idempotency-key': randomUUID(),
  };
}

describe('households dissolve', () => {
  it('owner dissolves; FK SetNull reverts shared records to creator-private; records survive', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id, { name: 'Home' });
    await makeMembership(hh.id, member.id, { role: 'member' });
    const rec = await makeRecord(member.id, { householdId: hh.id, customName: 'Shared milk' });

    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${hh.id}`,
      headers: await headersFor(owner.id),
    });
    expect(res.statusCode).toBe(204);

    const row = await getPrisma().record.findUnique({ where: { id: rec.id } });
    expect(row).not.toBeNull();           // item survives
    expect(row?.householdId).toBeNull();  // reverted to personal
    expect(row?.userId).toBe(member.id);  // creator attribution preserved
    expect(await getPrisma().household.findUnique({ where: { id: hh.id } })).toBeNull();
    await app.close();
  });

  it('non-owner cannot dissolve', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${hh.id}`,
      headers: await headersFor(member.id),
    });
    expect(res.statusCode).toBe(403);
    expect(await getPrisma().household.findUnique({ where: { id: hh.id } })).not.toBeNull();
    await app.close();
  });

  it('dissolve cascades: household_members rows deleted', async () => {
    const app = await buildServer();
    const owner = await makeUser({ emailVerified: true });
    const member = await makeUser({ emailVerified: true });
    const hh = await makeHousehold(owner.id);
    await makeMembership(hh.id, member.id, { role: 'member' });

    await app.inject({
      method: 'DELETE', url: `/v1/households/${hh.id}`,
      headers: await headersFor(owner.id),
    });

    const members = await getPrisma().householdMember.findMany({ where: { householdId: hh.id } });
    expect(members).toHaveLength(0);
    await app.close();
  });

  it('dissolving non-existent household returns 404', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const res = await app.inject({
      method: 'DELETE', url: `/v1/households/${randomUUID()}`,
      headers: await headersFor(user.id),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
