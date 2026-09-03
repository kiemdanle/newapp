import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { feedbackReplySchema } from '@expyrico/shared';
import { addUserFeedbackMessage } from '../../services/feedback/repository.js';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function feedbackMessagesRoute(app: FastifyInstance) {
  app.post(
    '/feedback/:id/messages',
    {
      onRequest: [app.requireAuth],
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const { id } = idParamSchema.parse(req.params);
      const input = feedbackReplySchema.parse(req.body);
      const message = await addUserFeedbackMessage(req.user!.id, id, input);
      return reply.status(201).send(message);
    },
  );
}
