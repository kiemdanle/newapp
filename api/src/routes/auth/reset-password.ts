import type { FastifyInstance } from 'fastify';
import { resetPasswordSchema, ERROR_CODES } from '@pantry/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';
import { hashPassword } from '../../services/auth/passwords.js';
import { revokeAllSessions } from '../../services/auth/sessions.js';

export async function resetPasswordRoute(app: FastifyInstance) {
  app.post('/reset-password', async (req, reply) => {
    const input = resetPasswordSchema.parse(req.body);
    const prisma = getPrisma();
    const row = await prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid or expired token',
      });
    }
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
    ]);
    // Revoke all existing sessions on password reset (security).
    await revokeAllSessions(row.userId);
    return reply.status(204).send();
  });
}
