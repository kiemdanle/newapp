import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserContributions } from '../../services/products/contributions.js';
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  status: z.enum(['all', 'active', 'pending', 'changes_required']).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'name_asc', 'name_desc']).default('newest').optional(),
});

export async function meContributionsRoute(app: FastifyInstance) {
  app.get('/contributions', { onRequest: app.requireAuth }, async (req, reply) => {
    const query = querySchema.parse(req.query);
    const contributions = await getUserContributions(req.user!.id, query);
    return reply.status(200).send(contributions);
  });
}
