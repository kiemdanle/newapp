import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productDraftReorderRequestSchema, productSchema } from '@expyrico/shared';
import { reorderProductPhotos } from '../../services/products/product-photos.js';
import { assertProductCreationEligible } from '../../services/products/product-creation-eligibility.js';

const paramSchema = z.object({ productId: z.string().uuid() });

export async function photoOrderRoute(app: FastifyInstance) {
  app.patch('/:productId/photos/order', { onRequest: app.requireAuth }, async (req, reply) => {
    const { productId } = paramSchema.parse(req.params);
    const input = productDraftReorderRequestSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    // `reorderProductPhotos` only ever admits a non-admin onto a
    // draft/changes_required product; the mode gate is an orthogonal capability
    // check on top of that. `assertProductCreationEligible` already treats an
    // admin actor as eligible in every mode on its own (no separate `role !==
    // 'admin'` special-case needed here) — the same single policy now used by
    // create/patch/submit, converging what were six independently-decided
    // admin exemptions into one (reviewer-p7 I6).
    await assertProductCreationEligible(actor, 'photo');
    const product = await reorderProductPhotos(actor, {
      productId,
      photoIds: input.photoIds,
      requestMeta: { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
    });
    return reply.status(200).send(productSchema.parse(product));
  });
}
