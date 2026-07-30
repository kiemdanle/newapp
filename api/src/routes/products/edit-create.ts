import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createOrResumeProductEdit } from '../../services/products/product-edits.js';

const paramSchema = z.object({ id: z.string().uuid() });

/** Creates a new open revision for an active product, or resumes the caller's own
 * existing draft/changes_required one. Distinct from `PATCH /v1/products/:id`
 * (which stays a one-shot revise-and-submit call): this is the entry point for the
 * staged-photo editor flow, which needs an edit to exist before it can attach
 * photos to it. */
export async function editCreateRoute(app: FastifyInstance) {
  app.post(
    '/:id/edit',
    { onRequest: app.requireAuth, config: { idempotent: 'required' } },
    async (req, reply) => {
      const { id } = paramSchema.parse(req.params);
      const { edit, resumed } = await createOrResumeProductEdit({ id: req.user!.id, role: req.user!.role }, id);
      return reply.status(resumed ? 200 : 201).send(edit);
    },
  );
}
