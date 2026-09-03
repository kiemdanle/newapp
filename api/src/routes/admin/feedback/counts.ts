import type { FastifyInstance } from 'fastify';
import { getAdminFeedbackCounts } from '../../../services/feedback/repository.js';

export async function adminFeedbackCountsRoute(app: FastifyInstance) {
  app.get('/counts', async () => {
    return await getAdminFeedbackCounts();
  });
}
