import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, loginSchema } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { verifyPassword } from '../../services/auth/passwords.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { hashToken, randomToken } from '../../utils/random.js';

const INVALID = new AppError({
  status: 401,
  code: ERROR_CODES.INVALID_CREDENTIALS,
  title: 'Invalid email or password',
});

export async function loginRoute(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash || user.status !== 'active') throw INVALID;

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw INVALID;

    // Email verification is required before any sign-in.
    if (!user.emailVerifiedAt) {
      throw new AppError({
        status: 403,
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        title: 'Please verify your email before signing in',
      });
    }

    // Admins always require TOTP.
    if (user.role === 'admin') {
      if (user.totpSecret && user.totpEnabledAt) {
        // TOTP already enabled → second-factor challenge.
        const challengeToken = randomToken(24);
        await prisma.totpChallenge.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(challengeToken),
            purpose: 'login',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
        return reply.send({ requiresTotp: true, challengeToken });
      }
      // TOTP not set up yet → force enrollment; do NOT issue a session.
      const enrollmentChallenge = randomToken(24);
      await prisma.totpChallenge.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(enrollmentChallenge),
          purpose: 'enroll',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      return reply.send({ requiresTotpEnrollment: true, enrollmentChallenge });
    }

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
