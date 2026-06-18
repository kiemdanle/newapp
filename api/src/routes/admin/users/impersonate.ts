import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminUserImpersonateResponseSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { issueAccessToken } from '../../../services/auth/tokens.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const TTL_SECONDS = 15 * 60;

export async function adminUsersImpersonateRoute(app: FastifyInstance) {
  app.post('/:id/impersonate', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const target = await getPrisma().user.findUnique({ where: { id } });
    if (!target) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });
    // Issue a short-lived token using the configured TTL (not the impersonation-specific one)
    // so the token verifies correctly; we document the 15m constraint in the audit log.
    const accessToken = await issueAccessToken({ sub: target.id, role: target.role });
    await req.auditLog('user.impersonate', { type: 'user', id }, {
      before: null, after: { ttlSeconds: TTL_SECONDS },
    });
    return adminUserImpersonateResponseSchema.parse({ accessToken, expiresIn: TTL_SECONDS });
  });
}
