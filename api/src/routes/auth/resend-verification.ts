import type { FastifyInstance } from 'fastify';
import { resendVerificationSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { hashToken, randomToken } from '../../utils/random.js';
import { sendVerificationEmail } from '../../services/auth/email.js';

export async function resendVerificationRoute(app: FastifyInstance) {
  app.post('/resend-verification', async (req, reply) => {
    const input = resendVerificationSchema.parse(req.body);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Always 204 — don't leak whether email exists.
    if (user && !user.emailVerifiedAt) {
      const plain = randomToken(32);
      await prisma.emailToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(plain),
          purpose: 'verify_email',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await sendVerificationEmail(user.email, plain);
    }
    return reply.status(204).send();
  });
}
