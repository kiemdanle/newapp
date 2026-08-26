import { describe, expect, it, vi, beforeEach } from 'vitest';

const { addBulkMock } = vi.hoisted(() => ({
  addBulkMock: vi.fn(async () => []),
}));

vi.mock('../../src/queues/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/queues/index.js')>();
  return {
    ...original,
    notificationScheduleQueue: () => ({
      addBulk: addBulkMock,
    }),
  };
});

import { syncRecords } from '../../src/services/records/sync.js';
import { makeUser } from '../helpers/factories.js';
import { randomUUID } from 'node:crypto';
describe('syncRecords notification scheduling', () => {
  beforeEach(() => {
    addBulkMock.mockReset();
    addBulkMock.mockResolvedValue([]);
  });

  it('enqueues notification schedule jobs via addBulk for synchronized records', async () => {
    const user = await makeUser({});
    const clientId = randomUUID();
    const result = await syncRecords(user.id, {
      upserts: [
        {
          clientId,
          customName: 'Synced Apples',
          expiryDate: '2099-12-31',
          quantity: 2,
          unit: 'pcs',
          updatedAt: new Date().toISOString(),
        },
      ],
      deletes: [],
    });

    expect(result.changes).toHaveLength(1);
    expect(addBulkMock).toHaveBeenCalledTimes(1);
    expect(addBulkMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'schedule',
          data: { recordId: result.changes[0]!.id },
          opts: expect.objectContaining({ jobId: `schedule__${result.changes[0]!.id}` }),
        }),
      ]),
    );
  });
});
