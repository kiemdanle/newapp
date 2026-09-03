import type { FastifyInstance } from 'fastify';
import { feedbackListQuerySchema } from '@expyrico/shared';
import { listUserFeedbackTickets } from '../../services/feedback/repository.js';

export async function listFeedbackRoute(app: FastifyInstance) {
  app.get(
    '/feedback',
    { onRequest: [app.requireAuth] },
    async (req, reply) => {
      const query = feedbackListQuerySchema.parse(req.query);
      const page = await listUserFeedbackTickets(req.user!.id, query);
      return reply.send(page);
    },
  );
}
