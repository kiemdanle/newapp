import type { FastifyInstance } from 'fastify';
import { forgotPasswordSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';
import { hashToken, randomSixDigitCode } from '../../utils/random.js';
import { sendPasswordResetCodeEmail } from '../../services/auth/email.js';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_EMAILS_PER_HOUR = 3;

export async function forgotPasswordRoute(app: FastifyInstance) {
  app.post('/forgot-password', async (req, reply) => {
    const input = forgotPasswordSchema.parse(req.body);
    const prisma = getPrisma();
    // Look the user up unconditionally so the request path does the same work
    // regardless of account existence (timing enumeration guard, RT-4).
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (user && user.status === 'active') {
      // Per-account throttle independent of IP (RT-3): the /v1/auth/* limiter
      // keys on IP, which rotation defeats. Cap code emails per account/hour.
      const redis = getRedis();
      const throttleKey = `rl:pwreset:${user.id}`;
      const count = await redis.incr(throttleKey);
      if (count === 1) await redis.expire(throttleKey, 60 * 60);

      if (count <= MAX_EMAILS_PER_HOUR) {
        const code = randomSixDigitCode();
        try {
          await prisma.$transaction([
            // Exactly one active row per user (RT-9): drop any prior codes.
            prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
            prisma.passwordReset.create({
              data: {
                userId: user.id,
                codeHash: hashToken(`${user.id}:${code}`),
                expiresAt: new Date(Date.now() + CODE_TTL_MS),
              },
            }),
          ]);
          await sendPasswordResetCodeEmail(user.email, code);
        } catch (err) {
          // SMTP or DB failure must not leak account existence (RT-7): swallow
          // and still return 204. Log server-side for observability.
          logger.error({ err, userId: user.id }, 'password reset code dispatch failed');
        }
      }
    }

    return reply.status(204).send();
  });
}
