import type { FastifyInstance } from 'fastify';
import { passkeyLoginOptionsSchema, passkeyLoginVerifySchema, ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildAuthenticationOptions, consumeAuthentication } from '../../services/auth/passkey.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';

export async function passkeyLoginRoute(app: FastifyInstance) {
  app.post('/passkey/login/options', async (req) => {
    const input = passkeyLoginOptionsSchema.parse(req.body ?? {});
    const prisma = getPrisma();
    let allowed: string[] = [];
    let subject = `anon:${req.ip}`;
    if (input.email) {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (user) {
        const creds = await prisma.authCredential.findMany({
          where: { userId: user.id, type: 'passkey' },
        });
        allowed = creds.map((c) => c.providerUserId).filter((v): v is string => !!v);
        subject = `user:${user.id}`;
      }
    }
    return buildAuthenticationOptions(subject, allowed);
  });

  app.post('/passkey/login/verify', async (req, reply) => {
    const input = passkeyLoginVerifySchema.parse(req.body);
    const prisma = getPrisma();
    const r = input.assertionResponse as { id?: string };
    if (!r.id) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Missing credential id',
      });
    }
    const cred = await prisma.authCredential.findUnique({
      where: { type_providerUserId: { type: 'passkey', providerUserId: r.id } },
    });
    if (!cred || !cred.publicKey) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Unknown passkey',
      });
    }
    const user = await prisma.user.findUnique({ where: { id: cred.userId } });
    if (!user || user.status !== 'active') {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        title: 'Unauthorized',
      });
    }

    let info;
    try {
      info = await consumeAuthentication(`user:${user.id}`, input.assertionResponse, {
        credentialID: r.id,
        credentialPublicKey: new Uint8Array(cred.publicKey),
        counter: Number(cred.counter ?? 0n),
      });
    } catch {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Passkey verification failed',
      });
    }

    await prisma.authCredential.update({
      where: { id: cred.id },
      data: { counter: BigInt(info.newCounter), lastUsedAt: new Date() },
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
