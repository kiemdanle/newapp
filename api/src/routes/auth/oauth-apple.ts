import type { FastifyInstance } from 'fastify';
import { oauthAppleSchema, ERROR_CODES } from '@pantry/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { verifyAppleIdentityToken } from '../../services/auth/apple.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { detectCountryFromIp } from '../../services/country/detect.js';

export async function oauthAppleRoute(app: FastifyInstance) {
  app.post('/oauth/apple', async (req, reply) => {
    const input = oauthAppleSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyAppleIdentityToken(input.identityToken);
    } catch {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid Apple identity_token',
      });
    }
    if (!identity.email || !identity.emailVerified) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        title: 'Apple account email is not verified or missing',
      });
    }

    const prisma = getPrisma();
    const cred = await prisma.authCredential.findUnique({
      where: { type_providerUserId: { type: 'apple', providerUserId: identity.sub } },
    });

    let user;
    if (cred) {
      user = await prisma.user.findUnique({ where: { id: cred.userId } });
    } else {
      user = await prisma.user.findUnique({ where: { email: identity.email } });
      if (!user) {
        const country = await detectCountryFromIp(req.ip).catch(() => null);
        user = await prisma.user.create({
          data: {
            email: identity.email,
            firstName: input.firstName ?? 'User',
            lastName: input.lastName ?? '',
            emailVerifiedAt: new Date(),
            country,
          },
        });
      }
      await prisma.authCredential.create({
        data: {
          userId: user.id,
          type: 'apple',
          providerUserId: identity.sub,
          metadata: { isPrivateEmail: identity.isPrivateEmail },
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
      where: { type_providerUserId: { type: 'apple', providerUserId: identity.sub } },
      data: { lastUsedAt: new Date() },
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
}
