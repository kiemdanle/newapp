import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';
import { getRedis } from '../redis.js';
import { getOperationalHealthStatus } from '../services/products/product-operational-health.js';

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

  // Unauthenticated liveness variant of the operational health payload —
  // Task 7 requires "UptimeRobot/systemd checks alert non-2xx or stale
  // timestamps", but the full payload is (correctly) admin-gated, and
  // UptimeRobot cannot present an admin bearer token to reach it. Exposes
  // only the bare overall status, never capacity/pending/backup/rate detail
  // or any filesystem/connection information.
  // `getOperationalHealthStatus` (not `getOperationalHealth`) skips the
  // quarantine directory walk — its result never affects `status`, so this
  // route was paying for a filesystem walk it then discarded on every
  // single poll.
  app.get('/health/operational', async (_req, reply) => {
    const status = await getOperationalHealthStatus();
    if (status === 'critical') void reply.status(503);
    return { status };
  });
}
