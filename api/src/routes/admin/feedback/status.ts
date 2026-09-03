import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateFeedbackStatusSchema } from '@expyrico/shared';
import { updateAdminFeedbackStatus } from '../../../services/feedback/repository.js';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function adminFeedbackStatusRoute(app: FastifyInstance) {
  app.patch('/:id/status', async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const input = updateFeedbackStatusSchema.parse(req.body);
    const ticket = await updateAdminFeedbackStatus(req.user!.id, id, input);
    return reply.send(ticket);
  });
}
