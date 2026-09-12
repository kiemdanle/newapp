import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { buildServer } from '../../src/server.js';
import { makeUser } from '../helpers/factories.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { getPrisma } from '../../src/db.js';
import type { RecordSyncResponse } from '@expyrico/shared';

async function userHeadersFor(userId: string) {
  return {
    authorization: `Bearer ${await issueAccessToken({ sub: userId, role: 'user', tokenVersion: 0 })}`,
  };
}

describe('Delta Sync Composite Cursor Pagination Integration Test', () => {
  it('paginates deterministically across identical-timestamp page boundaries with zero dropped or duplicate records', async () => {
    const app = await buildServer();
    const user = await makeUser({ emailVerified: true });
    const headers = await userHeadersFor(user.id);
    const prisma = getPrisma();

    const TOTAL_RECORDS = 1005;
    const PAGE_LIMIT = 1000;
    const commonTimestamp = new Date('2026-10-01T12:00:00.000Z');

    // Seed 1,005 records with the exact same updatedAt timestamp
    const recordData = Array.from({ length: TOTAL_RECORDS }, (_, i) => ({
      userId: user.id,
      clientId: randomUUID(),
      customName: `PaginationItem-${String(i).padStart(4, '0')}`,
      expiryDate: new Date('2026-12-31'),
      quantity: 1,
      unit: 'pcs',
      status: 'active' as const,
      notifyAt: [],
      createdAt: commonTimestamp,
      updatedAt: commonTimestamp,
    }));

    await prisma.record.createMany({
      data: recordData,
    });

    // Page 1: initial pull
    const page1Res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        since: new Date(0).toISOString(),
        cursor: null,
        upserts: [],
        deletes: [],
      },
    });

    expect(page1Res.statusCode).toBe(200);
    const page1Data: RecordSyncResponse = page1Res.json();
    expect(page1Data.changes.length).toBe(PAGE_LIMIT);
    expect(page1Data.hasMore).toBe(true);
    expect(page1Data.nextCursor).toBeDefined();
    expect(page1Data.nextCursor?.updatedAt).toBe(commonTimestamp.toISOString());
    expect(page1Data.nextCursor?.id).toBe(page1Data.changes[PAGE_LIMIT - 1]!.id);

    // Page 2: resume from composite cursor
    const page2Res = await app.inject({
      method: 'POST',
      url: '/v1/records/sync',
      headers,
      payload: {
        since: null,
        cursor: page1Data.nextCursor,
        upserts: [],
        deletes: [],
      },
    });

    expect(page2Res.statusCode).toBe(200);
    const page2Data: RecordSyncResponse = page2Res.json();
    expect(page2Data.changes.length).toBe(TOTAL_RECORDS - PAGE_LIMIT); // 5 records
    expect(page2Data.hasMore).toBe(false);
    expect(page2Data.nextCursor).toBeNull();

    // Verify all 1,005 records are received with 0 dropped and 0 duplicated
    const allReceivedIds = [
      ...page1Data.changes.map((r) => r.id),
      ...page2Data.changes.map((r) => r.id),
    ];
    expect(allReceivedIds.length).toBe(TOTAL_RECORDS);
    const uniqueIds = new Set(allReceivedIds);
    expect(uniqueIds.size).toBe(TOTAL_RECORDS);

    await app.close();
  });
});
