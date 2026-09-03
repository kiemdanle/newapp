import type { FastifyInstance } from 'fastify';
import { createFeedbackTicketSchema } from '@expyrico/shared';
import { createFeedbackTicket } from '../../services/feedback/repository.js';

export async function createFeedbackRoute(app: FastifyInstance) {
  app.post(
    '/feedback',
    {
      onRequest: [app.requireAuth],
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const input = createFeedbackTicketSchema.parse(req.body);
      const ticket = await createFeedbackTicket(req.user!.id, input);
      return reply.status(201).send(ticket);
    },
  );
}
