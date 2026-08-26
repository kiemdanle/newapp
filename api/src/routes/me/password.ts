import type { FastifyInstance } from 'fastify';
import { changePasswordSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { hashPassword, verifyPassword } from '../../services/auth/passwords.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';

const FAILED_ATTEMPTS_LIMIT = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes

export async function passwordRoute(app: FastifyInstance) {
  app.put(
    '/password',
    {
      onRequest: [app.requireAuth],
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    },
    async (req, reply) => {
      const input = changePasswordSchema.parse(req.body);
      const userId = req.user!.id;
      const prisma = getPrisma();
      const redis = getRedis();

      // Check failed attempts rate limit
      const failKey = `rl:pwfail:${userId}`;
      const failedCount = await redis.get(failKey);
      if (failedCount && Number.parseInt(failedCount, 10) >= FAILED_ATTEMPTS_LIMIT) {
        throw new AppError({
          status: 429,
          code: ERROR_CODES.RATE_LIMITED,
          title: 'Too many failed password attempts. Please try again in 15 minutes.',
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.status !== 'active') {
        throw new AppError({
          status: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          title: 'User not found or inactive',
        });
      }

      // If user already has a password, verify current password
      if (user.passwordHash !== null) {
        if (!input.currentPassword) {
          throw new AppError({
            status: 400,
            code: ERROR_CODES.VALIDATION,
            title: 'Current password is required to change your password',
          });
        }

        const isCurrentValid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!isCurrentValid) {
          const currentFails = await redis.incr(failKey);
          if (currentFails === 1) {
            await redis.expire(failKey, RATE_LIMIT_WINDOW_SECONDS);
          }
          throw new AppError({
            status: 400,
            code: 'invalid_current_password',
            title: 'The current password you entered is incorrect',
          });
        }
      }

      // Clear any failed attempt counters upon successful verification
      await redis.del(failKey).catch(() => {});

      const newPasswordHash = await hashPassword(input.newPassword);

      // Atomically update password, increment tokenVersion, and record credential
      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash: newPasswordHash,
            tokenVersion: { increment: 1 },
          },
        });

        // Ensure password credential exists
        const existingCredential = await tx.authCredential.findFirst({
          where: { userId, type: 'password' },
        });
        if (!existingCredential) {
          await tx.authCredential.create({
            data: { userId, type: 'password' },
          });
        }

        return u;
      });

      // Issue refreshed tokens with new tokenVersion so current device stays authenticated
      const accessToken = await issueAccessToken({
        sub: updatedUser.id,
        role: updatedUser.role,
        tokenVersion: updatedUser.tokenVersion,
      });

      const { refreshToken } = await createSession(updatedUser.id, {
        ip: req.ip,
      });

      const cfg = getConfig();

      return reply.status(200).send({
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: cfg.jwt.accessTtlSeconds,
        },
        user: toApiUser(updatedUser),
      });
    },
  );
}
