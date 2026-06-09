import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyticsRangeSchema, analyticsReviewsSchema } from '@pantry/shared';
import { reviewsDaily } from '../../../services/admin/analytics.js';

export async function adminAnalyticsReviewsRoute(app: FastifyInstance) {
  app.get('/reviews', async (req) => {
    const { range } = z.object({ range: analyticsRangeSchema.default('7d') }).parse(req.query);
    return analyticsReviewsSchema.parse(await reviewsDaily(range));
  });
}
