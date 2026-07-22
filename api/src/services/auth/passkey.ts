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
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: cfg.webauthn.rpName,
    rpID: cfg.webauthn.rpId,
    userID: new TextEncoder().encode(userId),
    userName,
    // Android Credential Manager rejects empty displayName on some API levels.
    userDisplayName: (userDisplayName?.trim() || userName).slice(0, 64),
    attestationType: 'none',
    excludeCredentials: existingCredIds.map((id) => ({ id })),
    authenticatorSelection: {
      userVerification: 'preferred',
      // Prefer discoverable credentials, but don't hard-require them — some
      // emulator/Google Password Manager paths fail with required residentKey.
      residentKey: 'preferred',
      requireResidentKey: false,
    },
  };
  const options = await generateRegistrationOptions(opts);
  await getRedis().set(
    challengeKey('register', userId),
    options.challenge,
    'EX',
    CHALLENGE_TTL_SECONDS,
  );
  return options;
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
    allowCredentials: allowedCredIds.map((id) => ({ id })),
    userVerification: 'preferred',
  };
  const options = await generateAuthenticationOptions(opts);
  await getRedis().set(
    challengeKey('login', subject),
    options.challenge,
    'EX',
    CHALLENGE_TTL_SECONDS,
  );
  return options;
}

export async function consumeAuthentication(
  subject: string,
  response: unknown,
  authenticator: { credentialID: string; credentialPublicKey: Uint8Array; counter: number },
): Promise<VerifiedAuthenticationResponse['authenticationInfo']> {
  const cfg = getConfig();
  const expected = await getRedis().get(challengeKey('login', subject));
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
  await getRedis().del(challengeKey('login', subject));
  if (!verification.verified) throw new Error('verification failed');
  return verification.authenticationInfo;
}
