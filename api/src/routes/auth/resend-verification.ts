import type { FastifyInstance } from 'fastify';
import { resendVerificationSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { logger } from '../../logger.js';
import { hashToken, randomSixDigitCode } from '../../utils/random.js';
import { sendVerificationEmail } from '../../services/auth/email.js';

export async function resendVerificationRoute(app: FastifyInstance) {
  app.post('/resend-verification', async (req, reply) => {
    const input = resendVerificationSchema.parse(req.body);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Always 204 — don't leak whether email exists.
    if (user && !user.emailVerifiedAt) {
      const plain = randomSixDigitCode();
      await prisma.$transaction([
        prisma.emailToken.updateMany({
          where: { userId: user.id, purpose: 'verify_email', usedAt: null },
          data: { usedAt: new Date() },
        }),
        prisma.emailToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(`${user.id}:${plain}`),
            purpose: 'verify_email',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        }),
      ]);
      try {
        await sendVerificationEmail(user.email, plain);
      } catch (err) {
        logger.error({ err, userId: user.id }, 'verification email resend failed');
      }
    }
    return reply.status(204).send();
  });
}
