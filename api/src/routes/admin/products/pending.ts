import type { FastifyInstance } from 'fastify';
import { cursorQuerySchema, adminProductEditsListSchema, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { toProductEditRow } from '../../../services/products/product-edits.js';

// Same include shape `product-edits.ts`'s (unexported) `EDIT_INCLUDE` uses —
// `toProductEditRow` only depends on the shape structurally.
const EDIT_LIST_INCLUDE = {
  photos: { include: { sourceProductPhoto: true }, orderBy: { position: 'asc' as const } },
  product: { select: { name: true, defaultShelfLifeDays: true } },
  submitter: { select: { id: true, email: true, firstName: true, lastName: true } },
};

/** Bounded queue projection with ordered private/public review media (not
 * just the raw `proposed` diff) so an admin can review a revision's photos
 * before opening the single-edit detail view — reuses the same
 * `toProductEditRow` projection every other edit-facing route derives its
 * photo URLs from, so this can never drift from the single-edit view's shape. */
export async function adminProductsPendingListRoute(app: FastifyInstance) {
  app.get('/pending', async (req) => {
    const q = cursorQuerySchema.parse(req.query);
    const cur = decodeCursor(q.cursor);
    const rows = await getPrisma().productEdit.findMany({
      where: {
        status: 'pending',
        ...(cur ? { OR: [{ createdAt: { lt: cur.t } }, { AND: [{ createdAt: cur.t }, { id: { lt: cur.i } }] }] } : {}),
      },
      include: EDIT_LIST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((e) => {
      const row = toProductEditRow(e);
      return {
        id: e.id,
        productId: e.productId,
        productName: e.product?.name,
        submittedBy: e.submittedBy,
        creator: e.submitter
          ? {
              id: e.submitter.id,
              email: e.submitter.email,
              firstName: e.submitter.firstName,
              lastName: e.submitter.lastName,
            }
          : null,
        proposed: e.proposed as Record<string, unknown>,
        name: row.name || e.product?.name,
        coverPhoto: row.photos[0] ?? null,
        status: e.status,
        version: e.version,
        baseProductVersion: e.baseProductVersion,
        moderationNotes: e.moderationNotes,
        submittedAt: e.submittedAt ? e.submittedAt.toISOString() : null,
        resolvedBy: e.resolvedBy,
        resolvedAt: e.resolvedAt ? e.resolvedAt.toISOString() : null,
        createdAt: e.createdAt.toISOString(),
      };
    });
    const last = items.at(-1);
    return adminProductEditsListSchema.parse({
      items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
