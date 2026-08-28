import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminUserReset2faRequestSchema,
  adminUserReset2faResponseSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { clearPendingEnrollment } from '../../auth/totp.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminUsersReset2faRoute(app: FastifyInstance) {
  app.post('/:id/reset-2fa', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminUserReset2faRequestSchema.optional().parse(req.body ?? {}) ?? {};
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'User not found',
      });
    }

    if (!user.totpSecret && !user.totpEnabledAt) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.CANNOT_RESET_UNENROLLED_2FA,
        title: 'User does not have 2FA enabled',
      });
    }

    if (req.user?.id === id && input.confirmSelfReset !== true) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.SELF_2FA_RESET_CONFIRMATION_REQUIRED,
        title: 'Explicit confirmation required to reset own 2FA',
      });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          totpSecret: null,
          totpEnabledAt: null,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.totpRecoveryCode.deleteMany({
        where: { userId: id },
      }),
      prisma.adminTrustedDevice.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.totpChallenge.deleteMany({
        where: { userId: id },
      }),
    ]);

    clearPendingEnrollment(id);

    await req.auditLog(
      'user.2fa_reset',
      { type: 'user', id },
      {
        before: { totpEnabledAt: user.totpEnabledAt?.toISOString() ?? null },
        after: { totpEnabledAt: null },
      },
    );

    return adminUserReset2faResponseSchema.parse({
      ok: true,
      userId: id,
      message: 'Two-factor authentication has been reset. User will be prompted to re-enroll on next sign in.',
    });
  });
}
