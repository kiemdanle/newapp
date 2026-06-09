import type { FastifyInstance } from 'fastify';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { getAllQueues } from '../../../queues/index.js';

export async function adminBullBoardRoute(app: FastifyInstance) {
  const serverAdapter = new FastifyAdapter();
  serverAdapter.setBasePath('/v1/admin/bullboard');
  createBullBoard({
    queues: getAllQueues().map(({ queue }) => new BullMQAdapter(queue)) as never,
    serverAdapter,
  });
  await app.register(serverAdapter.registerPlugin(), { prefix: '/bullboard', basePath: '' });
}
