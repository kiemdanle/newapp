import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminUserChangePasswordRequestSchema,
  adminUserChangePasswordResponseSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { hashPassword } from '../../../services/auth/passwords.js';
import { writeAuditLog } from '../../../services/audit/log.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersChangePasswordRoute(app: FastifyInstance) {
  app.post('/:id/change-password', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminUserChangePasswordRequestSchema.parse(req.body);
    const prisma = getPrisma();

    if (req.user?.id === id) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.CONFLICT,
        title: 'Cannot change your own password from the user directory. Please use account settings.',
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

    // Hash password with Argon2id outside the database transaction
    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });

      // Ensure password AuthCredential exists (e.g. for OAuth users who now have a password)
      const existingCred = await tx.authCredential.findFirst({
        where: { userId: id, type: 'password' },
      });
      if (!existingCred) {
        await tx.authCredential.create({
          data: { userId: id, type: 'password' },
        });
      }

      // Revoke all active refresh sessions and trusted devices immediately
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.adminTrustedDevice.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      });

      // Invalidate any pending password reset tickets and login challenges
      await tx.passwordReset.deleteMany({
        where: { userId: id },
      });
      await tx.totpChallenge.deleteMany({
        where: { userId: id },
      });

      await writeAuditLog(
        {
          adminId: req.user!.id,
          action: 'user.password_change',
          targetType: 'user',
          targetId: id,
          diff: {
            before: { passwordSet: user.passwordHash !== null },
            after: { passwordSet: true, method: 'manual_admin' },
          },
          requestId: (req.headers['x-request-id'] as string) ?? req.id,
          ip: req.ip,
        },
        tx,
      );
    });

    return adminUserChangePasswordResponseSchema.parse({
      ok: true,
      userId: id,
      message: 'Password updated successfully.',
    });
  });
}
