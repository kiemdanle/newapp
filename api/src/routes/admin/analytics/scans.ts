import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyticsRangeSchema, analyticsScansSchema } from '@pantry/shared';
import { scansDaily } from '../../../services/admin/analytics.js';

export async function adminAnalyticsScansRoute(app: FastifyInstance) {
  app.get('/scans', async (req) => {
    const { range } = z.object({ range: analyticsRangeSchema.default('7d') }).parse(req.query);
    return analyticsScansSchema.parse(await scansDaily(range));
  });
}
