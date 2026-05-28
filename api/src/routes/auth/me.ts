import type { FastifyInstance } from 'fastify';
import { ERROR_CODES } from '@pantry/shared';
import { AppError } from '../../errors.js';
import { findUserById, toApiUser } from '../../services/users/repository.js';

export async function meRoute(app: FastifyInstance) {
  app.get('/me', { onRequest: [app.requireAuth] }, async (req) => {
    const u = await findUserById(req.user!.id);
    if (!u) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        title: 'Unauthorized',
      });
    }
    return toApiUser(u);
  });
}
