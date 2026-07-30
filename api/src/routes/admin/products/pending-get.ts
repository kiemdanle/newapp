import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductEditDetailSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { toProductEditRow } from '../../../services/products/product-edits.js';

const paramsSchema = z.object({ editId: z.string().uuid() });

// Same include shape `product-edits.ts`'s (unexported) `EDIT_INCLUDE` uses —
// `toProductEditRow` only depends on the shape structurally, not on that
// specific type export, so this stays a thin route file with no service change.
const EDIT_DETAIL_INCLUDE = {
  photos: { include: { sourceProductPhoto: true }, orderBy: { position: 'asc' as const } },
};

/**
 * Single-revision detail for the moderation console: the full creator-facing
 * row (complete desired metadata + photo order, same `toProductEditRow`
 * projection every other edit-facing route uses) plus the live product's
 * current version, so the UI can flag a stale revision
 * (`liveProductVersion !== baseProductVersion`) before the admin ever attempts
 * approve/request-changes and hits a `version_conflict`/`edit_base_stale`.
 */
export async function adminProductsPendingGetRoute(app: FastifyInstance) {
  app.get('/pending/:editId', async (req) => {
    const { editId } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const edit = await prisma.productEdit.findUnique({ where: { id: editId }, include: EDIT_DETAIL_INCLUDE });
    if (!edit) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Revision not found' });
    const product = await prisma.product.findUnique({ where: { id: edit.productId }, select: { version: true } });
    if (!product) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });

    const row = toProductEditRow(edit);
    return adminProductEditDetailSchema.parse({
      ...row,
      submittedBy: edit.submittedBy,
      liveProductVersion: product.version,
    });
  });
}
