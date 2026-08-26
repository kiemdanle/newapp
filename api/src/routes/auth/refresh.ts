import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, refreshSchema } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { findActiveSessionByToken, rotateSession, findRotatedGraceSession } from '../../services/auth/sessions.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { findUserById, toApiUser } from '../../services/users/repository.js';

export async function refreshRoute(app: FastifyInstance) {
  app.post('/refresh', async (req, reply) => {
    const input = refreshSchema.parse(req.body);
    let session = await findActiveSessionByToken(input.refreshToken);
    let nextRefreshToken: string | null = null;

    if (!session) {
      // Check if this token was recently rotated during the 60s grace period window
      const grace = await findRotatedGraceSession(input.refreshToken);
      if (grace) {
        session = grace.session;
        nextRefreshToken = grace.refreshToken;
      }
    }

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

    // If not from grace period, rotate the session now; if from grace period, reuse the active successor token
    if (!nextRefreshToken) {
      const next = await rotateSession(input.refreshToken);
      nextRefreshToken = next.refreshToken;
    }

    const accessToken = await issueAccessToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
    return reply.send({
      user: toApiUser(user),
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        expiresIn: getConfig().jwt.accessTtlSeconds,
      },
    });
  });
}
