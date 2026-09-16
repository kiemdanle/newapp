import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeRecord, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

async function adminHeaders(adminId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({
      sub: adminId,
      role: 'admin',
      tokenVersion: 0,
    })}`,
  };
}

async function userHeaders(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({
      sub: userId,
      role: 'user',
      tokenVersion: 0,
    })}`,
  };
}

describe('Sync & Admin Deletion Interaction', () => {
  it('propagates hard-deleted record IDs to owner delta pull via RecordTombstone', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const user = await makeUser({ emailVerified: true });

    // 1. User creates a record
    const record = await makeRecord(user.id, {
      customName: 'Avocado',
      quantity: 4,
      status: 'active',
      expiryDate: new Date('2026-10-10'),
    });

    const syncCheckpoint = new Date(Date.now() - 5000).toISOString();

    // 2. Admin hard-deletes the record
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/pantry-items/${record.id}`,
      headers: await adminHeaders(admin.id),
    });
    expect(delRes.statusCode).toBe(204);

    // 3. User makes incremental sync delta pull
    const syncRes = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers: await userHeaders(user.id),
      payload: {
        since: syncCheckpoint,
        upserts: [],
        deletes: [],
      },
    });

    expect(syncRes.statusCode).toBe(200);
    const syncBody = syncRes.json();
    expect(syncBody.deletedIds).toContain(record.id);
    expect(syncBody.changes).toHaveLength(0);

    await app.close();
  });

  it('rejects stale offline upsert for tombstoned clientId and prevents zombie resurrection', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const user = await makeUser({ emailVerified: true });
    const prisma = getPrisma();

    // 1. Initial record exists on server
    const record = await makeRecord(user.id, {
      customName: 'Canned Beans',
      quantity: 2,
      status: 'active',
    });

    // 2. Admin deletes it on server
    await app.inject({
      method: 'DELETE',
      url: `/v1/admin/pantry-items/${record.id}`,
      headers: await adminHeaders(admin.id),
    });

    // 3. Offline client attempts to upsert using the original clientId
    const syncRes = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers: await userHeaders(user.id),
      payload: {
        since: new Date(Date.now() - 10000).toISOString(),
        upserts: [
          {
            clientId: record.clientId,
            customName: 'Canned Beans Modified Offline',
            quantity: 5,
            unit: 'can',
            expiryDate: '2026-11-01',
            updatedAt: new Date().toISOString(),
          },
        ],
        deletes: [],
      },
    });

    expect(syncRes.statusCode).toBe(200);
    const syncBody = syncRes.json();

    // The tombstone instructs the client to delete its local copy
    expect(syncBody.deletedIds).toContain(record.id);

    // Verify database remains clean with zero resurrected zombie records
    const resurrected = await prisma.record.findUnique({
      where: { clientId: record.clientId },
    });
    expect(resurrected).toBeNull();

    await app.close();
  });

  it('strictly serializes concurrent admin delete and client sync upsert via lockUserPantryQuota', async () => {
    const app = await buildServer();
    const admin = await makeUser({ emailVerified: true, role: 'admin' });
    const user = await makeUser({ emailVerified: true });
    const prisma = getPrisma();

    const record = await makeRecord(user.id, {
      customName: 'Concurrent Test Milk',
      quantity: 1,
      status: 'active',
    });

    // Fire delete and sync upsert concurrently with Promise.all
    const [delRes, syncRes] = await Promise.all([
      app.inject({
        method: 'DELETE',
        url: `/v1/admin/pantry-items/${record.id}`,
        headers: await adminHeaders(admin.id),
      }),
      app.inject({
        method: 'POST',
        url: '/v1/records/sync',
        headers: await userHeaders(user.id),
        payload: {
          since: new Date(Date.now() - 5000).toISOString(),
          upserts: [
            {
              clientId: record.clientId,
              customName: 'Concurrent Test Milk (Modified)',
              quantity: 2,
              unit: 'bottle',
              expiryDate: '2026-11-15',
              updatedAt: new Date().toISOString(),
            },
          ],
          deletes: [],
        },
      }),
    ]);

    expect(delRes.statusCode).toBe(204);
    expect(syncRes.statusCode).toBe(200);

    // Regardless of arrival order, the deleted record must NOT exist as a zombie in records table
    const liveRow = await prisma.record.findUnique({
      where: { clientId: record.clientId },
    });
    expect(liveRow).toBeNull();

    // And the tombstone must exist
    const tombstone = await prisma.recordTombstone.findUnique({
      where: { clientId: record.clientId },
    });
    expect(tombstone).not.toBeNull();

    await app.close();
  });
});
