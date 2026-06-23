import type { FastifyInstance } from 'fastify';
import { recordSyncBatchSchema, recordSyncResponseSchema } from '@expyrico/shared';
import { syncRecords } from '../../services/records/sync.js';
import { toApiRecord } from '../../services/records/repository.js';

export async function syncRecordsRoute(app: FastifyInstance) {
  app.post('/sync', { onRequest: app.requireAuth }, async (req, reply) => {
    const batch = recordSyncBatchSchema.parse(req.body);
    const result = await syncRecords(req.user!.id, batch);
    return reply.send(
      recordSyncResponseSchema.parse({
        serverTime: result.serverTime.toISOString(),
        changes: result.changes.map(toApiRecord),
        deletedIds: result.deletedIds,
        conflicts: result.conflicts,
      }),
    );
  });
}
