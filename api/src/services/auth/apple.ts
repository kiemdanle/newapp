import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getConfig } from '../../config.js';

const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export interface AppleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  isPrivateEmail: boolean;
}

export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const cfg = getConfig();
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: cfg.oauth.appleClientId,
  });
  const p = payload as JWTPayload & {
    email?: string;
    email_verified?: boolean | string;
    is_private_email?: boolean | string;
  };
  if (!p.sub) throw new Error('identity_token missing sub');
  const emailVerified = p.email_verified === true || p.email_verified === 'true';
  const isPrivateEmail = p.is_private_email === true || p.is_private_email === 'true';
  return {
    sub: p.sub,
    ...(p.email !== undefined ? { email: p.email.toLowerCase() } : {}),
    emailVerified,
    isPrivateEmail,
  };
}
