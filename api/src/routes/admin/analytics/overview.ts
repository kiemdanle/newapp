import type { FastifyInstance } from 'fastify';
import { analyticsOverviewSchema } from '@pantry/shared';
import { overview } from '../../../services/admin/analytics.js';

export async function adminAnalyticsOverviewRoute(app: FastifyInstance) {
  app.get('/overview', async () => analyticsOverviewSchema.parse(await overview()));
}
