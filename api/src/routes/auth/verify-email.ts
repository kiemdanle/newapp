import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, verifyEmailSchema } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';

export async function verifyEmailRoute(app: FastifyInstance) {
  app.post('/verify-email', async (req, reply) => {
    const input = verifyEmailSchema.parse(req.body);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    const row = user
      ? await prisma.emailToken.findFirst({
          where: {
            userId: user.id,
            tokenHash: hashToken(`${user.id}:${input.code}`),
            purpose: 'verify_email',
          },
        })
      : null;
    if (
      !row ||
      row.usedAt ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid or expired code',
      });
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      prisma.emailToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
    return reply.send({ verified: true });
  });

  app.get('/verify-email', async (_req, _reply) => {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.INVALID_TOKEN,
      title: 'Enter the verification code from your email',
    });
  });
}
