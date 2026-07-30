import type { FastifyInstance } from 'fastify';
import { operationalHealthSchema } from '@expyrico/shared';
import { getOperationalHealth } from '../../../services/products/product-operational-health.js';

export async function adminSystemOperationalHealthRoute(app: FastifyInstance) {
  app.get('/operational-health', async () => {
    const health = await getOperationalHealth();
    return operationalHealthSchema.parse(health);
  });
}
