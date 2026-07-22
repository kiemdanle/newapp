import type { FastifyInstance } from 'fastify';
import { passkeyRegisterVerifySchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildRegistrationOptions, consumeRegistration } from '../../services/auth/passkey.js';

/** Normalize WebAuthn credential id to base64url string for storage/lookup. */
function normalizeCredentialId(id: unknown): string | null {
  if (typeof id === 'string' && id.length > 0) {
    // Already base64url (or base64) — normalize to url-safe without padding.
    return id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  if (id instanceof Uint8Array) {
    return Buffer.from(id).toString('base64url');
  }
  if (Buffer.isBuffer(id)) {
    return id.toString('base64url');
  }
  return null;
}

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
    const rawId = info.credential?.id ?? info.credentialID;
    const publicKey = info.credential?.publicKey ?? info.credentialPublicKey;
    const counter = info.credential?.counter ?? info.counter ?? 0;
    const transports = info.credential?.transports ?? [];
    // Also accept the client attestation's id (base64url) as source of truth.
    const clientId =
      typeof (input.attestationResponse as { id?: unknown })?.id === 'string'
        ? (input.attestationResponse as { id: string }).id
        : null;
    const credentialId = normalizeCredentialId(clientId ?? rawId);
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
        // Must be base64url string — used later as allowCredentials[].id on login.
        providerUserId: credentialId,
        publicKey: Buffer.from(publicKey),
        counter: BigInt(counter),
        metadata: { transports },
      },
    });
    return reply.status(201).send({ registered: true });
  });
}
