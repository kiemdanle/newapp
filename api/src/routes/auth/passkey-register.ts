import type { FastifyInstance } from 'fastify';
import { passkeyRegisterVerifySchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildRegistrationOptions, consumeRegistration } from '../../services/auth/passkey.js';

export async function passkeyRegisterRoute(app: FastifyInstance) {
  app.post('/passkey/register/options', { onRequest: [app.requireAuth] }, async (req) => {
    const userId = req.user!.id;
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const existing = await prisma.authCredential.findMany({
      where: { userId, type: 'passkey' },
    });
    const ids = existing.map((c) => c.providerUserId).filter((v): v is string => !!v);
    const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return buildRegistrationOptions(userId, user!.email, ids, displayName || user!.email);
  });

  app.post('/passkey/register/verify', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const input = passkeyRegisterVerifySchema.parse(req.body);
    const userId = req.user!.id;
    let regInfo;
    try {
      regInfo = await consumeRegistration(userId, input.attestationResponse);
    } catch {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Passkey registration failed',
      });
    }
    const prisma = getPrisma();
    // v10 returns { credentialID, credentialPublicKey, counter } (snake-cased
    // legacy shape). v11+ moved to a `credential` sub-object.
    const info = regInfo as unknown as {
      credentialID?: string;
      credentialPublicKey?: Uint8Array;
      counter?: number;
      credentialDeviceType?: string;
      credentialBackedUp?: boolean;
      credential?: {
        id: string;
        publicKey: Uint8Array;
        counter: number;
        transports?: string[];
      };
    };
    const credentialId = info.credential?.id ?? info.credentialID;
    const publicKey = info.credential?.publicKey ?? info.credentialPublicKey;
    const counter = info.credential?.counter ?? info.counter ?? 0;
    const transports = info.credential?.transports ?? [];
    if (!credentialId || !publicKey) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Passkey registration produced no credential',
      });
    }
    await prisma.authCredential.create({
      data: {
        userId,
        type: 'passkey',
        providerUserId: credentialId,
        publicKey: Buffer.from(publicKey),
        counter: BigInt(counter),
        metadata: { transports },
      },
    });
    return reply.status(201).send({ registered: true });
  });
}
