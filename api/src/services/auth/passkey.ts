import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type VerifyAuthenticationResponseOpts,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';

const CHALLENGE_TTL_SECONDS = 5 * 60;

function challengeKey(scope: 'register' | 'login', subject: string): string {
  return `passkey:challenge:${scope}:${subject}`;
}

export async function buildRegistrationOptions(
  userId: string,
  userName: string,
  existingCredIds: string[],
  userDisplayName?: string,
): Promise<Awaited<ReturnType<typeof generateRegistrationOptions>>> {
  const cfg = getConfig();
  const excludeIds = existingCredIds
    .filter((id) => typeof id === 'string' && id.length > 0)
    .map((id) => id.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''));
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: cfg.webauthn.rpName,
    rpID: cfg.webauthn.rpId,
    userID: new TextEncoder().encode(userId),
    userName,
    // Android Credential Manager rejects empty displayName on some API levels.
    userDisplayName: (userDisplayName?.trim() || userName).slice(0, 64),
    attestationType: 'none',
    // Give the user more time after screen-lock PIN (MIUI often burns 30–40s there).
    timeout: 120_000,
    // Exclude known credentials so GMS fails fast with "already exists" instead of
    // hanging after PIN when a prior Expyrico passkey is already on-device.
    ...(excludeIds.length > 0 ? { excludeCredentials: excludeIds.map((id) => ({ id })) } : {}),
    // Default simplewebauthn list includes Ed25519 (-8). Older Android / GMS
    // Password Manager stacks often reject the whole create request when -8 is
    // present. Stick to ES256 + RS256 which Android passkeys support.
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      // Prefer on-device GPM; avoid hybrid "another device" create that spins
      // after PIN and times out on MIUI.
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      // Prefer discoverable keys so later login can find them locally.
      residentKey: 'preferred',
      requireResidentKey: false,
    },
  };
  const options = await generateRegistrationOptions(opts);
  // @simplewebauthn always injects extensions.credProps=true. Android 11
  // Credential Manager / GMS on MIUI has been observed to reject create when
  // unknown/optional extensions are present. Strip extensions entirely and
  // drop empty excludeCredentials for the leanest create payload.
  const { extensions: _extensions, ...rest } = options as typeof options & {
    extensions?: unknown;
  };
  const cleaned = {
    ...rest,
    ...((Array.isArray(rest.excludeCredentials) && rest.excludeCredentials.length === 0)
      ? { excludeCredentials: undefined }
      : {}),
  };
  // Remove excludeCredentials key when empty (JSON omit).
  if (Array.isArray(cleaned.excludeCredentials) && cleaned.excludeCredentials.length === 0) {
    delete (cleaned as { excludeCredentials?: unknown }).excludeCredentials;
  }

  await getRedis().set(
    challengeKey('register', userId),
    cleaned.challenge,
    'EX',
    CHALLENGE_TTL_SECONDS,
  );
  return cleaned as typeof options;
}

export async function consumeRegistration(
  userId: string,
  response: unknown,
): Promise<NonNullable<VerifiedRegistrationResponse['registrationInfo']>> {
  const cfg = getConfig();
  const expected = await getRedis().get(challengeKey('register', userId));
  if (!expected) throw new Error('challenge expired');
  const opts: VerifyRegistrationResponseOpts = {
    response: response as VerifyRegistrationResponseOpts['response'],
    expectedChallenge: expected,
    expectedOrigin: cfg.webauthn.origins,
    expectedRPID: cfg.webauthn.rpId,
    requireUserVerification: false,
  };
  const verification = await verifyRegistrationResponse(opts);
  await getRedis().del(challengeKey('register', userId));
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('verification failed');
  }
  return verification.registrationInfo;
}

export async function buildAuthenticationOptions(
  subject: string,
  allowedCredIds: string[],
): Promise<Awaited<ReturnType<typeof generateAuthenticationOptions>>> {
  const cfg = getConfig();
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: cfg.webauthn.rpId,
    // Empty allowCredentials means "any discoverable credential for this RP".
    // Omit the field entirely when empty — Android Credential Manager can loop
    // or fail when given an empty array.
    ...(allowedCredIds.length > 0
      ? { allowCredentials: allowedCredIds.map((id) => ({ id })) }
      : {}),
    // Match registration UV policy so GMS doesn't reject assertion.
    userVerification: 'discouraged',
  };
  const options = await generateAuthenticationOptions(opts);
  // Store challenge under the challenge string itself so verify can find it
  // whether options were requested with email (user:id) or without (anon:ip).
  // Also keep the subject key for the email-bound path.
  const redis = getRedis();
  await redis.set(
    challengeKey('login', `chal:${options.challenge}`),
    options.challenge,
    'EX',
    CHALLENGE_TTL_SECONDS,
  );
  await redis.set(challengeKey('login', subject), options.challenge, 'EX', CHALLENGE_TTL_SECONDS);
  return options;
}

function challengeFromAssertionResponse(response: unknown): string | null {
  try {
    const r = response as { response?: { clientDataJSON?: string }; clientDataJSON?: string };
    const b64 = r.response?.clientDataJSON ?? r.clientDataJSON;
    if (!b64 || typeof b64 !== 'string') return null;
    const json = Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const data = JSON.parse(json) as { challenge?: string };
    return typeof data.challenge === 'string' ? data.challenge : null;
  } catch {
    return null;
  }
}

export async function consumeAuthentication(
  subject: string,
  response: unknown,
  authenticator: { credentialID: string; credentialPublicKey: Uint8Array; counter: number },
): Promise<VerifiedAuthenticationResponse['authenticationInfo']> {
  const cfg = getConfig();
  const redis = getRedis();
  // Prefer subject key (email-bound options). Fall back to challenge extracted
  // from the assertion so usernameless (anon) options still verify.
  let expected = await redis.get(challengeKey('login', subject));
  let cleanupKeys = [challengeKey('login', subject)];
  if (!expected) {
    const chal = challengeFromAssertionResponse(response);
    if (chal) {
      expected = await redis.get(challengeKey('login', `chal:${chal}`));
      cleanupKeys.push(challengeKey('login', `chal:${chal}`));
    }
  } else {
    const chal = challengeFromAssertionResponse(response);
    if (chal) cleanupKeys.push(challengeKey('login', `chal:${chal}`));
  }
  if (!expected) throw new Error('challenge expired');
  // @simplewebauthn/server v10 uses `authenticator` (not v11's `credential`).
  const opts: VerifyAuthenticationResponseOpts = {
    response: response as VerifyAuthenticationResponseOpts['response'],
    expectedChallenge: expected,
    expectedOrigin: cfg.webauthn.origins,
    expectedRPID: cfg.webauthn.rpId,
    authenticator: {
      credentialID: authenticator.credentialID,
      credentialPublicKey: authenticator.credentialPublicKey,
      counter: authenticator.counter,
    },
    requireUserVerification: false,
  };
  const verification = await verifyAuthenticationResponse(opts);
  await Promise.all(cleanupKeys.map((k) => redis.del(k)));
  if (!verification.verified) throw new Error('verification failed');
  return verification.authenticationInfo;
}
