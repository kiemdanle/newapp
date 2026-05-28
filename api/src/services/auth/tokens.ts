import { SignJWT, jwtVerify } from 'jose';
import { getConfig } from '../../config.js';
import { hashToken, randomToken } from '../../utils/random.js';

export interface AccessTokenPayload {
  sub: string;
  role: 'user' | 'admin';
}

/** Backward-compatible alias retained for any callers that still import AccessClaims. */
export type AccessClaims = AccessTokenPayload;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getConfig().jwt.accessSecret);
}

/**
 * Issue a signed JWT access token and return it as a bare string.
 *
 * The TTL is always `cfg.jwt.accessTtlSeconds`. Callers that need to report
 * `expiresIn` to a client read it from config (`getConfig().jwt.accessTtlSeconds`)
 * at the call site; this function deliberately returns only the token so every
 * call site treats the access token uniformly as a string.
 */
export async function issueAccessToken(payload: AccessTokenPayload): Promise<string> {
  const cfg = getConfig();
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(cfg.jwt.issuer)
    .setAudience(cfg.jwt.audience)
    .setIssuedAt()
    .setExpirationTime(`${cfg.jwt.accessTtlSeconds}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const cfg = getConfig();
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: cfg.jwt.issuer,
    audience: cfg.jwt.audience,
  });
  if (typeof payload.sub !== 'string') throw new Error('missing sub');
  const role = payload.role;
  if (role !== 'user' && role !== 'admin') throw new Error('invalid role');
  return { sub: payload.sub, role };
}

export interface RefreshTokenIssue {
  token: string;
  hash: string;
  expiresAt: Date;
}

export function issueRefreshToken(): RefreshTokenIssue {
  const cfg = getConfig();
  const token = randomToken(32);
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + cfg.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}
