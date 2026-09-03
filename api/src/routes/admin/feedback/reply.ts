import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { feedbackReplySchema } from '@expyrico/shared';
import { addAdminFeedbackReply } from '../../../services/feedback/repository.js';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function adminFeedbackReplyRoute(app: FastifyInstance) {
  app.post('/:id/reply', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const input = feedbackReplySchema.parse(req.body);
    const message = await addAdminFeedbackReply(req.user!.id, id, input);
    return reply.status(201).send(message);
  });
}
