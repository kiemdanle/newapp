import type { FastifyInstance } from 'fastify';
import { queueHealthSchema } from '@pantry/shared';
import { getAllQueues } from '../../../queues/index.js';

export async function adminSystemQueueHealthRoute(app: FastifyInstance) {
  app.get('/queue-health', async () => {
    const queues = getAllQueues();
    const stats = await Promise.all(queues.map(async ({ name, queue }) => {
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return {
        name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      };
    }));
    return queueHealthSchema.parse({ queues: stats });
  });
}
