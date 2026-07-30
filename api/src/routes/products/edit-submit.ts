import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productEditSubmitRequestSchema } from '@expyrico/shared';
import { resolveProductEdit } from '../../services/products/product-edits.js';

const paramSchema = z.object({ editId: z.string().uuid() });

export async function editSubmitRoute(app: FastifyInstance) {
  app.post('/:editId/submit', { onRequest: app.requireAuth, config: { idempotent: 'required' } }, async (req, reply) => {
    const { editId } = paramSchema.parse(req.params);
    const input = productEditSubmitRequestSchema.parse(req.body);
    const edit = await resolveProductEdit(
      { id: req.user!.id, role: req.user!.role },
      { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
      { editId, action: 'submit', version: input.version },
    );
    return reply.status(202).send(edit);
  });
}
