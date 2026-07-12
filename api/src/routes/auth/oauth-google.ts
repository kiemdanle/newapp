import type { FastifyInstance } from 'fastify';
import { oauthGoogleSchema, ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { verifyGoogleIdToken } from '../../services/auth/google.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { detectCountryFromIp } from '../../services/country/detect.js';

export async function oauthGoogleRoute(app: FastifyInstance) {
  app.post('/oauth/google', async (req, reply) => {
    const input = oauthGoogleSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyGoogleIdToken(input.idToken);
    } catch {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid Google id_token',
      });
    }

    if (!identity.emailVerified) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        title: 'Google account email is not verified',
      });
    }

    const prisma = getPrisma();

    // Try to find an existing credential.
    const cred = await prisma.authCredential.findUnique({
      where: { type_providerUserId: { type: 'google', providerUserId: identity.sub } },
    });

    let user;
    if (cred) {
      user = await prisma.user.findUnique({ where: { id: cred.userId } });
    } else {
      // Maybe an existing email account — link rather than duplicate.
      user = await prisma.user.findUnique({ where: { email: identity.email } });
      if (!user) {
        const country = await detectCountryFromIp(req.ip).catch(() => null);
        user = await prisma.user.create({
          data: {
            email: identity.email,
            firstName: identity.givenName ?? 'User',
            lastName: identity.familyName ?? '',
            emailVerifiedAt: new Date(),
            avatarUrl: identity.picture ?? null,
            country,
          },
        });
      }
      await prisma.authCredential.create({
        data: {
          userId: user.id,
          type: 'google',
          providerUserId: identity.sub,
          metadata: { picture: identity.picture ?? null },
        },
      });
    }

    if (!user || user.status !== 'active') {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        title: 'Unauthorized',
      });
    }

    await prisma.authCredential.update({
      where: { type_providerUserId: { type: 'google', providerUserId: identity.sub } },
      data: { lastUsedAt: new Date() },
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
}
