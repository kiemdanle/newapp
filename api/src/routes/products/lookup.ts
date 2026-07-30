import type { FastifyInstance } from 'fastify';
import {
  productLookupRequestSchema,
  productLookupResponseSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { lookupProduct } from '../../services/products/lookup.js';
import { toApiProduct } from '../../services/products/serializer.js';
import { enqueueLookupBackfill } from '../../services/products/lookup-backfill.js';

export async function lookupRoute(app: FastifyInstance) {
  app.post('/lookup', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = productLookupRequestSchema.parse(req.body);
    const { product, privateReservation } = await lookupProduct({
      ...(input.barcode !== undefined ? { barcode: input.barcode } : {}),
      ...(input.qr !== undefined ? { qr: input.qr } : {}),
    });
    if (!product) {
      // An exact non-active local reservation (draft/pending/changes_required/
      // report_hidden/merged_into) short-circuits to the same 404 envelope without
      // ever having called external providers or enqueued backfill above — the
      // only remaining side effect to skip is backfill for that case.
      if (input.barcode && !privateReservation) {
        await enqueueLookupBackfill(input.barcode, req.user!.id);
      }
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Product not found',
      });
    }
    return reply.send(
      productLookupResponseSchema.parse({
        product: toApiProduct(product, { id: req.user!.id, role: req.user!.role }),
      }),
    );
  });
}
