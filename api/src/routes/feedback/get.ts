import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserFeedbackTicketDetail } from '../../services/feedback/repository.js';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function getFeedbackRoute(app: FastifyInstance) {
  app.get(
    '/feedback/:id',
    { onRequest: [app.requireAuth] },
    async (req, reply) => {
      const { id } = idParamSchema.parse(req.params);
      const ticket = await getUserFeedbackTicketDetail(req.user!.id, id);
      return reply.send(ticket);
    },
  );
}
