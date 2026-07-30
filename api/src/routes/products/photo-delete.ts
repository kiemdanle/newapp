import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productSchema } from '@expyrico/shared';
import { removeProductPhoto } from '../../services/products/product-photos.js';
import { assertProductCreationEligible } from '../../services/products/product-creation-eligibility.js';

const paramSchema = z.object({ productId: z.string().uuid(), photoId: z.string().uuid() });

export async function photoDeleteRoute(app: FastifyInstance) {
  app.delete('/:productId/photos/:photoId', { onRequest: app.requireAuth }, async (req, reply) => {
    const { productId, photoId } = paramSchema.parse(req.params);
    const actor = { id: req.user!.id, role: req.user!.role };
    // `removeProductPhoto` only ever admits a non-admin onto a
    // draft/changes_required product; the mode gate is an orthogonal capability
    // check on top of that. `assertProductCreationEligible` already treats an
    // admin actor as eligible in every mode on its own — one converged policy
    // across all six call sites, same as photo-order.ts.
    await assertProductCreationEligible(actor, 'photo');
    const product = await removeProductPhoto(actor, {
      productId,
      photoId,
      requestMeta: { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
    });
    return reply.status(200).send(productSchema.parse(product));
  });
}
