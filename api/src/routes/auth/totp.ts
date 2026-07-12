import type { FastifyInstance } from 'fastify';
import {
  totpEnrollSchema,
  totpVerifyEnrollmentSchema,
  totpChallengeVerifySchema,
  totpRecoveryVerifySchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildEnrollment, verifyTotp, diagnoseTotp } from '../../services/auth/totp.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { hashToken } from '../../utils/random.js';

const PENDING_ENROLLMENTS = new Map<string, Awaited<ReturnType<typeof buildEnrollment>>>();
// In-flight build promises, keyed by userId. Memoizing the promise makes
// /totp/enroll idempotent: concurrent or repeated calls (e.g. a client effect
// that fires twice) reuse one secret instead of each generating a fresh one
// and clobbering the other — which would leave the displayed key and the
// server-held secret divergent and fail verification.
const ENROLLMENT_BUILDS = new Map<string, Promise<Awaited<ReturnType<typeof buildEnrollment>>>>();

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

    // Idempotent per user: if an enrollment already exists (or is being built),
    // reuse it so a double-fired client request can't strand two secrets.
    const existing = PENDING_ENROLLMENTS.get(user.id);
    if (existing) {
      return {
        secret: existing.rawSecret,
        qrCodeDataUrl: existing.qrCodeDataUrl,
        recoveryCodes: existing.recoveryCodes,
      };
    }
    let build = ENROLLMENT_BUILDS.get(user.id);
    if (!build) {
      build = buildEnrollment(user.email);
      ENROLLMENT_BUILDS.set(user.id, build);
    }
    let enrollment;
    try {
      enrollment = await build;
    } finally {
      ENROLLMENT_BUILDS.delete(user.id);
    }
    PENDING_ENROLLMENTS.set(user.id, enrollment);
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
      try {
        const d = diagnoseTotp(pending.encryptedSecret, input.code);
        req.log.warn(
          { delta: d.delta, codeLen: input.code.length, matchesExpectedNow: d.expectedNow === input.code },
          'totp enrollment verify failed — diagnostic (delta=null means code is from a DIFFERENT secret; nonzero means clock skew of delta*30s)',
        );
      } catch (e) {
        req.log.warn({ err: (e as Error).message }, 'totp diagnostic threw');
      }
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
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
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
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion });
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
