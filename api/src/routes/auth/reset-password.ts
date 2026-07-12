import type { FastifyInstance } from 'fastify';
import { resetPasswordSchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';
import { hashPassword } from '../../services/auth/passwords.js';

export async function resetPasswordRoute(app: FastifyInstance) {
  app.post('/reset-password', async (req, reply) => {
    const input = resetPasswordSchema.parse(req.body);
    const prisma = getPrisma();
    // Hash up front so the expensive KDF runs outside the DB transaction.
    const passwordHash = await hashPassword(input.password);
    const ticketHash = hashToken(input.resetTicket);

    // The whole reset is one transaction: atomically consume the ticket, set the
    // password, bump tokenVersion (invalidates outstanding access tokens at
    // requireAuth — RT-11), and revoke refresh sessions. Consuming via a
    // conditional UPDATE (WHERE consumedAt IS NULL ... RETURNING) closes the
    // TOCTOU that a read-then-update would leave: two concurrent submits of the
    // same ticket serialize on the row lock and only one flips consumedAt.
    // expiresAt/consumedAt are `timestamp` columns storing naive UTC, so compare
    // against now() AT TIME ZONE 'UTC' to match how Prisma reads them.
    const userId = await prisma.$transaction(async (tx) => {
      const consumed = await tx.$queryRaw<Array<{ userId: string }>>`
        UPDATE password_resets
           SET "consumedAt" = (now() AT TIME ZONE 'UTC')
         WHERE "ticketHash" = ${ticketHash}
           AND "consumedAt" IS NULL
           AND "verifiedAt" IS NOT NULL
           AND "ticketExpiresAt" > (now() AT TIME ZONE 'UTC')
        RETURNING "userId"
      `;
      const winner = consumed[0];
      if (!winner) return null;
      await tx.user.update({
        where: { id: winner.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId: winner.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return winner.userId;
    });

    if (!userId) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid or expired token',
      });
    }
    return reply.status(204).send();
  });
}
