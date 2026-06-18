import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, refreshSchema } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { findActiveSessionByToken, rotateSession } from '../../services/auth/sessions.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { findUserById, toApiUser } from '../../services/users/repository.js';

export async function refreshRoute(app: FastifyInstance) {
  app.post('/refresh', async (req, reply) => {
    const input = refreshSchema.parse(req.body);
    const session = await findActiveSessionByToken(input.refreshToken);
    if (!session) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid token',
      });
    }
    const user = await findUserById(session.userId);
    if (!user || user.status !== 'active') {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid token',
      });
    }
    const next = await rotateSession(input.refreshToken);
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    return reply.send({
      user: toApiUser(user),
      tokens: {
        accessToken,
        refreshToken: next.refreshToken,
        expiresIn: getConfig().jwt.accessTtlSeconds,
      },
    });
  });
}
