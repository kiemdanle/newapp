import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { discardDraft } from '../../services/products/product-drafts.js';

const paramSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({
  emptyOnly: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  expectedVersion: z.coerce.number().int().min(1).optional(),
});

export async function draftDeleteRoute(app: FastifyInstance) {
  app.delete('/drafts/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const query = querySchema.parse(req.query);
    const result = await discardDraft(
      { id: req.user!.id, role: req.user!.role },
      id,
      {
        ...(query.emptyOnly !== undefined ? { emptyOnly: query.emptyOnly } : {}),
        ...(query.expectedVersion !== undefined ? { expectedVersion: query.expectedVersion } : {}),
      },
    );
    return reply.status(200).send(result);
  });
}
