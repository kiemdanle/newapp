import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';
import { getRedis } from '../redis.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_req, reply) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      await getRedis().ping();
      return { status: 'ready' };
    } catch {
      void reply.status(503).type('application/problem+json').send({
        title: 'Not ready',
        status: 503,
        code: 'not_ready',
      });
      return;
    }
  });
}
