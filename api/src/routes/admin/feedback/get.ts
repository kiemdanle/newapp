import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getAdminFeedbackTicketDetail } from '../../../services/feedback/repository.js';

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function adminFeedbackGetRoute(app: FastifyInstance) {
  app.get('/:id', async (req) => {
    const { id } = idParamSchema.parse(req.params);
    return await getAdminFeedbackTicketDetail(id);
  });
}
