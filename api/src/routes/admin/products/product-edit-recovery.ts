import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productEditRecoverRequestSchema } from '@expyrico/shared';
import { recoverProductEdit } from '../../../services/products/product-edits.js';

const paramsSchema = z.object({ editId: z.string().uuid() });

/** Admin-only recovery for a stale open revision (`product.version !==
 * edit.baseProductVersion`): `rebase` (reviewed desired-photo mapping, returns to
 * pending) or `supersede` (terminal `rejected`, frees the one-open-edit slot). */
export async function adminProductEditRecoveryRoute(app: FastifyInstance) {
  app.post('/edits/:editId/recover', async (req) => {
    const { editId } = paramsSchema.parse(req.params);
    const input = productEditRecoverRequestSchema.parse(req.body);
    const edit = await recoverProductEdit(
      { id: req.user!.id, role: 'admin' },
      { requestId: (req.headers['x-request-id'] as string) ?? req.id, ip: req.ip },
      { ...input, editId },
    );
    return edit;
  });
}
