import { Passkey } from 'react-native-passkey';
import { authEndpoints } from '../api/endpoints';
import { isApiError } from '../api/errors';

type PasskeyNativeError = {
  error?: string;
  message?: string;
  code?: string;
};

/**
 * Android Credential Manager is picky about create-option shape on API 30/MIUI.
 * Strip fields that commonly cause NotAllowed/SecurityError even when the RP
 * association is valid (credProps extension, empty excludeCredentials, etc.).
 */
function sanitizeCreateOptions(options: unknown): Record<string, unknown> {
  const src = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  delete out.extensions;

  if (Array.isArray(out.excludeCredentials) && out.excludeCredentials.length === 0) {
    delete out.excludeCredentials;
  }

  const selection = (out.authenticatorSelection && typeof out.authenticatorSelection === 'object'
    ? { ...(out.authenticatorSelection as Record<string, unknown>) }
    : {}) as Record<string, unknown>;
  // Leave attachment unset; force non-required resident key.
  delete selection.authenticatorAttachment;
  if (selection.requireResidentKey === true) selection.requireResidentKey = false;
  out.authenticatorSelection = selection;

  // Ensure displayName is never empty if name is present.
  if (out.user && typeof out.user === 'object') {
    const user = { ...(out.user as Record<string, unknown>) };
    if (!user.displayName || String(user.displayName).trim() === '') {
      user.displayName = user.name ?? 'Expyrico user';
    }
    out.user = user;
  }

  return out;
}

function passkeyErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const pe = e as PasskeyNativeError;
    const code = (typeof pe.error === 'string' ? pe.error : typeof pe.code === 'string' ? pe.code : '').trim();
    const msg = typeof pe.message === 'string' ? pe.message.trim() : '';
    if (code) {
      switch (code) {
        case 'NotSupported':
          return 'Passkeys are not supported on this device.';
        case 'UserCancelled':
          return 'Passkey request was cancelled.';
        case 'BadConfiguration':
        case 'NotConfigured':
          return 'Passkeys are not configured for this app build. The relying-party domain must match and Digital Asset Links / Associated Domains must be published.';
        case 'InvalidChallenge':
          return 'The passkey challenge from the server was invalid.';
        case 'InvalidUserId':
          return 'The passkey user id from the server was invalid.';
        case 'CredentialAlreadyExists':
          return 'A passkey for this account already exists on this device.';
        case 'NoCredentials':
          return 'No passkey is available on this device.';
        case 'NoCreateOption':
          return 'No passkey provider is available. On Android, open Google Password Manager, make sure a Google account is signed in, screen lock is on, and try again. Emulators often need a Google account + Password Manager setup before passkeys work.';
        case 'TimedOut':
          return 'The passkey request timed out.';
        case 'RequestFailed':
          // Prefer native detail when present (e.g. CreatePublicKeyCredentialDomException|dom=...).
          if (msg && msg !== code && msg !== 'The request failed. No Credentials were returned.') {
            if (msg.includes('NoCreateOption') || msg.includes('No create options')) {
              return 'No passkey provider is available. Open Google Password Manager, confirm Google account + screen lock, then retry.';
            }
            return `Passkey request failed: ${msg}`;
          }
          return 'Passkey request failed. Ensure Google Password Manager is enabled, a screen lock is set, and the server RP ID is associated with this app.';
        default:
          return msg && msg !== code ? `${code}: ${msg}` : code;
      }
    }
    if (msg) return msg;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

function rethrowPasskeyError(e: unknown, fallback: string): never {
  if (isApiError(e)) throw e;
  // Keep raw object in Metro/logcat for debugging native Credential Manager failures.
  try {
    // eslint-disable-next-line no-console
    console.warn('[passkey] native error', JSON.stringify(e));
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[passkey] native error', e);
  }
  throw new Error(passkeyErrorMessage(e, fallback));
}

function sanitizeGetOptions(options: unknown): Record<string, unknown> {
  const src = (options && typeof options === 'object' ? options : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  delete out.extensions;
  // Android: empty allowCredentials array can cause Credential Manager to spin.
  if (Array.isArray(out.allowCredentials) && out.allowCredentials.length === 0) {
    delete out.allowCredentials;
  }
  return out;
}

export async function signInWithPasskey(email?: string) {
  try {
    const options = await authEndpoints.passkeyLoginOptions(email);
    const sanitized = sanitizeGetOptions(options);
    // eslint-disable-next-line no-console
    console.log(
      '[passkey] get options',
      JSON.stringify({
        rpId: sanitized.rpId,
        allowCredentials: Array.isArray(sanitized.allowCredentials)
          ? (sanitized.allowCredentials as unknown[]).length
          : 0,
        userVerification: sanitized.userVerification,
      }),
    );
    const assertion = await Passkey.get(sanitized as never);
    // eslint-disable-next-line no-console
    console.log('[passkey] get assertion ok', JSON.stringify({ id: (assertion as { id?: string })?.id }));
    return authEndpoints.passkeyLoginVerify(assertion);
  } catch (e) {
    rethrowPasskeyError(e, 'Could not sign in with a passkey');
  }
}

/**
 * Registers a NEW passkey on the currently signed-in account. Used from sign-up
 * (offer to add a passkey right after account creation) and from the settings
 * "Add a passkey" action. The register endpoints are authenticated, so the
 * caller must already hold a valid session.
 */
export async function registerPasskey(): Promise<void> {
  try {
    const options = await authEndpoints.passkeyRegisterOptions();
    const sanitized = sanitizeCreateOptions(options);
    // eslint-disable-next-line no-console
    console.log(
      '[passkey] create options',
      JSON.stringify({
        rp: sanitized.rp,
        user: sanitized.user,
        pubKeyCredParams: sanitized.pubKeyCredParams,
        authenticatorSelection: sanitized.authenticatorSelection,
        attestation: sanitized.attestation,
        hasExtensions: Boolean((options as { extensions?: unknown })?.extensions),
      }),
    );
    const attestation = await Passkey.create(sanitized as never);
    await authEndpoints.passkeyRegisterVerify(attestation);
  } catch (e) {
    rethrowPasskeyError(e, 'Could not add a passkey');
  }
}
