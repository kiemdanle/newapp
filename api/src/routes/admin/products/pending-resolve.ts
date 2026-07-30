import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductEditResolveSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { resolveProductEdit } from '../../../services/products/product-edits.js';

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Admin decision on a pending revision. Delegates to `resolveProductEdit`, which
 * owns the real transactional/audit/photo-publish invariants — this route only
 * adds the contract-preserving pieces: this endpoint's request shape has no
 * client-supplied edit version (unlike the creator-facing submit/metadata
 * endpoints), so it reads the edit fresh and passes its current version through
 * as the optimistic-concurrency token. A genuinely stale read still surfaces as a
 * `version_conflict` if the edit changed between this read and the write.
 */
export async function adminProductsPendingResolveRoute(app: FastifyInstance) {
  app.patch('/pending/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductEditResolveSchema.parse(req.body);
    const edit = await getPrisma().productEdit.findUnique({ where: { id } });
    if (!edit) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Edit not found' });
    if (edit.status !== 'pending') throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already resolved' });

    const result = await resolveProductEdit(
      { id: req.user!.id, role: 'admin' },
      { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
      {
        editId: id,
        action: input.decision === 'approve' ? 'approve' : 'request_changes',
        version: edit.version,
        notes: input.notes,
      },
    );
    return result;
  });
}
