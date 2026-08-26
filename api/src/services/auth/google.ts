import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getConfig } from '../../config.js';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const cfg = getConfig();
  const rawClientId = cfg.oauth.googleClientId;
  const audiences = (typeof rawClientId === 'string' ? rawClientId.split(',') : [rawClientId])
    .map((s) => s.trim())
    .filter(Boolean);

  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: audiences.length === 1 ? audiences[0] : audiences,
  });
  const p = payload as JWTPayload & {
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  if (!p.sub || !p.email) throw new Error('id_token missing sub or email');
  return {
    sub: p.sub,
    email: p.email.toLowerCase(),
    emailVerified: p.email_verified === true,
    ...(p.given_name !== undefined ? { givenName: p.given_name } : {}),
    ...(p.family_name !== undefined ? { familyName: p.family_name } : {}),
    ...(p.picture !== undefined ? { picture: p.picture } : {}),
  };
}
