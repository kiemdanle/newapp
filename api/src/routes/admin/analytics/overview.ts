import type { FastifyInstance } from 'fastify';
import { analyticsOverviewSchema } from '@expyrico/shared';
import { overview } from '../../../services/admin/analytics.js';

export async function adminAnalyticsOverviewRoute(app: FastifyInstance) {
  app.get('/overview', async () => analyticsOverviewSchema.parse(await overview()));
}
