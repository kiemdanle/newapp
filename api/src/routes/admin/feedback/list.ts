import type { FastifyInstance } from 'fastify';
import { adminFeedbackQuerySchema } from '@expyrico/shared';
import { listAdminFeedbackTickets } from '../../../services/feedback/repository.js';

export async function adminFeedbackListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const query = adminFeedbackQuerySchema.parse(req.query);
    return await listAdminFeedbackTickets(query);
  });
}
