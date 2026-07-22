import { Passkey } from 'react-native-passkey';
import { authEndpoints } from '../api/endpoints';
import { isApiError } from '../api/errors';

type PasskeyNativeError = {
  error?: string;
  message?: string;
};

function passkeyErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const pe = e as PasskeyNativeError;
    if (typeof pe.message === 'string' && pe.message.trim()) return pe.message;
    if (typeof pe.error === 'string' && pe.error.trim()) {
      switch (pe.error) {
        case 'NotSupported':
          return 'Passkeys are not supported on this device.';
        case 'UserCancelled':
          return 'Passkey request was cancelled.';
        case 'BadConfiguration':
          return 'Passkeys are not configured for this app build. The relying-party domain must match and Digital Asset Links / Associated Domains must be published.';
        case 'InvalidChallenge':
          return 'The passkey challenge from the server was invalid.';
        case 'InvalidUserId':
          return 'The passkey user id from the server was invalid.';
        case 'CredentialAlreadyExists':
          return 'A passkey for this account already exists on this device.';
        case 'NoCredentials':
          return 'No passkey is available on this device.';
        case 'TimedOut':
          return 'The passkey request timed out.';
        case 'RequestFailed':
          return 'Passkey request failed. Check that the server RP ID matches a real domain associated with this app.';
        default:
          return pe.error;
      }
    }
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

function rethrowPasskeyError(e: unknown, fallback: string): never {
  if (isApiError(e)) throw e;
  throw new Error(passkeyErrorMessage(e, fallback));
}

export async function signInWithPasskey(email?: string) {
  try {
    const options = await authEndpoints.passkeyLoginOptions(email);
    // react-native-passkey expects PublicKeyCredentialRequestOptionsJSON
    const assertion = await Passkey.get(options as never);
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
    // react-native-passkey expects PublicKeyCredentialCreationOptionsJSON
    const attestation = await Passkey.create(options as never);
    await authEndpoints.passkeyRegisterVerify(attestation);
  } catch (e) {
    rethrowPasskeyError(e, 'Could not add a passkey');
  }
}
