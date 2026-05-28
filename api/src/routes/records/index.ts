import type { FastifyInstance } from 'fastify';
import { createRecordRoute } from './create.js';
import { listRecordsRoute } from './list.js';
import { patchRecordRoute } from './patch.js';
import { deleteRecordRoute } from './delete.js';
import { syncRecordsRoute } from './sync.js';

export async function recordRoutes(app: FastifyInstance) {
  await app.register(listRecordsRoute);
  await app.register(createRecordRoute);
  await app.register(patchRecordRoute);
  await app.register(deleteRecordRoute);
  await app.register(syncRecordsRoute);
}
