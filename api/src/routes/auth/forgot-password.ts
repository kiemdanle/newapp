import type { FastifyInstance } from 'fastify';
import { forgotPasswordSchema } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { hashToken, randomToken } from '../../utils/random.js';
import { sendPasswordResetEmail } from '../../services/auth/email.js';

export async function forgotPasswordRoute(app: FastifyInstance) {
  app.post('/forgot-password', async (req, reply) => {
    const input = forgotPasswordSchema.parse(req.body);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (user && user.status === 'active') {
      const plain = randomToken(32);
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(plain),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
        },
      });
      await sendPasswordResetEmail(user.email, plain);
    }
    return reply.status(204).send();
  });
}
