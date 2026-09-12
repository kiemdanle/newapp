import type { FastifyInstance } from 'fastify';
import { getPantryLimits } from '../../services/admin/settings.js';

export async function pantryLimitsClientRoute(app: FastifyInstance) {
  app.get('/settings/pantry-limits', async () => getPantryLimits());
}
