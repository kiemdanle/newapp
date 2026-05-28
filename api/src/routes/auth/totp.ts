import type { FastifyInstance } from 'fastify';
import {
  totpEnrollSchema,
  totpVerifyEnrollmentSchema,
  totpChallengeVerifySchema,
  totpRecoveryVerifySchema,
  ERROR_CODES,
} from '@pantry/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildEnrollment, verifyTotp } from '../../services/auth/totp.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { hashToken } from '../../utils/random.js';

interface PendingEnrollment {
  encryptedSecret: string;
  rawSecret: string;
  recoveryCodes: string[];
}

const PENDING_ENROLLMENTS = new Map<string, PendingEnrollment>();

/** Resolve and validate an admin enrollment challenge (purpose 'enroll'). */
async function resolveEnrollmentChallenge(enrollmentChallenge: string) {
  const prisma = getPrisma();
  const challenge = await prisma.totpChallenge.findUnique({
    where: { tokenHash: hashToken(enrollmentChallenge) },
  });
  if (
    !challenge ||
    challenge.purpose !== 'enroll' ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError({
      status: 401,
      code: ERROR_CODES.INVALID_TOKEN,
      title: 'Invalid or expired enrollment challenge',
    });
  }
  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || user.role !== 'admin' || user.status !== 'active') {
    throw new AppError({
      status: 401,
      code: ERROR_CODES.UNAUTHORIZED,
      title: 'Unauthorized',
    });
  }
  return { challenge, user };
}

/** Resolve and validate a login challenge (purpose 'login') for an enabled admin. */
async function resolveLoginChallenge(challengeToken: string) {
  const prisma = getPrisma();
  const challenge = await prisma.totpChallenge.findUnique({
    where: { tokenHash: hashToken(challengeToken) },
  });
  if (
    !challenge ||
    challenge.purpose !== 'login' ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError({
      status: 401,
      code: ERROR_CODES.INVALID_TOKEN,
      title: 'Invalid or expired challenge',
    });
  }
  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || !user.totpSecret || user.status !== 'active') {
    throw new AppError({
      status: 401,
      code: ERROR_CODES.UNAUTHORIZED,
      title: 'Unauthorized',
    });
  }
  return { challenge, user };
}

export async function totpRoutes(app: FastifyInstance) {
  // POST /v1/auth/totp/enroll  — authorized by the enrollment challenge
  app.post('/totp/enroll', async (req) => {
    const input = totpEnrollSchema.parse(req.body);
    const { user } = await resolveEnrollmentChallenge(input.enrollmentChallenge);
    const enrollment = await buildEnrollment(user.email);
    PENDING_ENROLLMENTS.set(user.id, {
      encryptedSecret: enrollment.encryptedSecret,
      rawSecret: enrollment.rawSecret,
      recoveryCodes: enrollment.recoveryCodes,
    });
    return {
      secret: enrollment.rawSecret,
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
      recoveryCodes: enrollment.recoveryCodes,
    };
  });

  // POST /v1/auth/totp/verify-enrollment  — authorized by the enrollment challenge
  app.post('/totp/verify-enrollment', async (req, reply) => {
    const input = totpVerifyEnrollmentSchema.parse(req.body);
    const { challenge, user } = await resolveEnrollmentChallenge(input.enrollmentChallenge);
    const pending = PENDING_ENROLLMENTS.get(user.id);
    if (!pending) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_TOTP,
        title: 'No pending enrollment',
      });
    }
    if (!verifyTotp(pending.encryptedSecret, input.code)) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOTP,
        title: 'Invalid TOTP code',
      });
    }
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: pending.encryptedSecret, totpEnabledAt: new Date() },
      }),
      prisma.totpRecoveryCode.createMany({
        data: pending.recoveryCodes.map((c) => ({
          userId: user.id,
          codeHash: hashToken(c),
        })),
      }),
      prisma.totpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    PENDING_ENROLLMENTS.delete(user.id);
    return reply.status(204).send();
  });

  // POST /v1/auth/totp/challenge-verify  — public, requires a valid login challenge
  app.post('/totp/challenge-verify', async (req, reply) => {
    const input = totpChallengeVerifySchema.parse(req.body);
    const { challenge, user } = await resolveLoginChallenge(input.challengeToken);
    if (!verifyTotp(user.totpSecret!, input.code)) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOTP,
        title: 'Invalid TOTP code',
      });
    }
    const prisma = getPrisma();
    await prisma.totpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });
    return reply.send({
      user: toApiUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: getConfig().jwt.accessTtlSeconds,
      },
    });
  });

  // POST /v1/auth/totp/recovery-verify  — redeem a one-time recovery code
  app.post('/totp/recovery-verify', async (req, reply) => {
    const input = totpRecoveryVerifySchema.parse(req.body);
    const { challenge, user } = await resolveLoginChallenge(input.challengeToken);
    const prisma = getPrisma();
    const row = await prisma.totpRecoveryCode.findUnique({
      where: { codeHash: hashToken(input.recoveryCode) },
    });
    if (!row || row.userId !== user.id || row.usedAt) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_RECOVERY_CODE,
        title: 'Invalid recovery code',
      });
    }
    await prisma.$transaction([
      prisma.totpRecoveryCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      prisma.totpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });
    return reply.send({
      user: toApiUser(user),
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: getConfig().jwt.accessTtlSeconds,
      },
    });
  });
}
