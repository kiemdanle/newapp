import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';

const querySchema = z.object({ token: z.string().min(1) });

export async function verifyEmailRoute(app: FastifyInstance) {
  app.get('/verify-email', async (req, reply) => {
    const { token } = querySchema.parse(req.query);
    const prisma = getPrisma();
    const row = await prisma.emailToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !row ||
      row.usedAt ||
      row.expiresAt.getTime() < Date.now() ||
      row.purpose !== 'verify_email'
    ) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid or expired token',
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
}
