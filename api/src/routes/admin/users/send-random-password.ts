import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminUserSendRandomPasswordRequestSchema,
  adminUserSendRandomPasswordResponseSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { hashPassword } from '../../../services/auth/passwords.js';
import { randomSecurePassword } from '../../../utils/random.js';
import { sendAdminRandomPasswordEmail } from '../../../services/auth/email.js';
import { writeAuditLog } from '../../../services/audit/log.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersSendRandomPasswordRoute(app: FastifyInstance) {
  app.post('/:id/send-random-password', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    adminUserSendRandomPasswordRequestSchema.optional().parse(req.body ?? {});
    const prisma = getPrisma();

    if (req.user?.id === id) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.CONFLICT,
        title: 'Cannot reset your own password from the user directory. Please use account settings.',
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'User not found',
      });
    }

    const tempPassword = randomSecurePassword(16);
    const passwordHash = await hashPassword(tempPassword);
    const now = new Date();

    try {
      await sendAdminRandomPasswordEmail(user.email, tempPassword);
    } catch (err) {
      throw new AppError({
        status: 502,
        code: ERROR_CODES.INTERNAL,
        title: 'Failed to send temporary password email. Password reset has been cancelled.',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      const existingCred = await tx.authCredential.findFirst({
        where: { userId: id, type: 'password' },
      });
      if (!existingCred) {
        await tx.authCredential.create({
          data: { userId: id, type: 'password' },
        });
      }

      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.adminTrustedDevice.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.passwordReset.deleteMany({
        where: { userId: id },
      });
      await tx.totpChallenge.deleteMany({
        where: { userId: id },
      });

      await writeAuditLog(
        {
          adminId: req.user!.id,
          action: 'user.password_reset_email',
          targetType: 'user',
          targetId: id,
          diff: {
            before: { passwordSet: user.passwordHash !== null },
            after: { passwordSet: true, method: 'random_email' },
          },
          requestId: (req.headers['x-request-id'] as string) ?? req.id,
          ip: req.ip,
        },
        tx,
      );
    });
    return adminUserSendRandomPasswordResponseSchema.parse({
      ok: true,
      userId: id,
      message: 'A temporary random password has been generated and sent to the user email.',
    });
  });
}
