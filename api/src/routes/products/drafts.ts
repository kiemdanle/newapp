import type { FastifyInstance } from 'fastify';
import {
  productDraftCreateRequestSchema,
  productDraftsQuerySchema,
  productDraftsPageSchema,
  productSchema,
} from '@expyrico/shared';
import { createOrResumeDraft, listDrafts } from '../../services/products/product-drafts.js';

export async function draftsRoute(app: FastifyInstance) {
  app.post(
    '/drafts',
    { onRequest: app.requireAuth, config: { idempotent: 'required' } },
    async (req, reply) => {
      const input = productDraftCreateRequestSchema.parse(req.body);
      const { product, resumed } = await createOrResumeDraft({ id: req.user!.id, role: req.user!.role }, input);
      // Schema-pinned response, matching every other product-mutation route
      // (reviewer-p7 M7 fixed this same gap on the submit route).
      return reply.status(resumed ? 200 : 201).send({ product: productSchema.parse(product), resumed });
    },
  );

  app.get('/drafts', { onRequest: app.requireAuth }, async (req, reply) => {
    const query = productDraftsQuerySchema.parse(req.query);
    const page = await listDrafts(req.user!.id, query);
    return reply.send(productDraftsPageSchema.parse(page));
  });
}
