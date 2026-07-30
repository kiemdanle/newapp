import type { FastifyInstance } from 'fastify';
import { productCreateRequestSchema } from '@expyrico/shared';
import { AppError } from '../../errors.js';

// Legacy direct product creation is permanently retired: it published active
// products straight to the catalog, bypassing conclusive-lookup and moderation
// entirely. Blocked in every rollout mode — parse the body first so malformed
// requests still get a validation error, not a false sense that this ever works.
export async function createProductRoute(app: FastifyInstance) {
  app.post('/', { onRequest: app.requireAuth }, async (req) => {
    productCreateRequestSchema.parse(req.body);
    throw new AppError({
      status: 410,
      code: 'upgrade_required',
      title: 'Direct product creation has been retired; use the draft creation flow',
    });
  });
}
