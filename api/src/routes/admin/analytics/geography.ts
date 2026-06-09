import type { FastifyInstance } from 'fastify';
import { analyticsGeographySchema } from '@pantry/shared';
import { geography } from '../../../services/admin/analytics.js';

export async function adminAnalyticsGeographyRoute(app: FastifyInstance) {
  app.get('/geography', async () => analyticsGeographySchema.parse(await geography()));
}
