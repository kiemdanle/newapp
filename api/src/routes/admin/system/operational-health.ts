import type { FastifyInstance } from 'fastify';
import { operationalHealthSchema } from '@expyrico/shared';
import { getOperationalHealth } from '../../../services/products/product-operational-health.js';

export async function adminSystemOperationalHealthRoute(app: FastifyInstance) {
  app.get('/operational-health', async (_req, reply) => {
    const health = await getOperationalHealth();
    // Always returned 200 even when status: 'critical' — Task 7 requires
    // "systemd checks alert non-2xx or stale timestamps", which a systemd
    // timer polling this endpoint with a credential could only ever honor
    // if the status code itself carries the signal (reviewer-p7 IM6).
    // `warning` stays 200 (advisory, not a binary "down" signal); only
    // `critical` fails the check.
    if (health.status === 'critical') void reply.status(503);
    return operationalHealthSchema.parse(health);
  });
}
