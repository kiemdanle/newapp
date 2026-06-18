import { Passkey } from 'react-native-passkey';
import { authEndpoints } from '../api/endpoints';

export async function signInWithPasskey(email?: string) {
  const options = await authEndpoints.passkeyLoginOptions(email);
  // react-native-passkey expects PublicKeyCredentialRequestOptionsJSON
  const assertion = await Passkey.get(options as never);
  return authEndpoints.passkeyLoginVerify(assertion);
}

/**
 * Registers a NEW passkey on the currently signed-in account. Used from sign-up
 * (offer to add a passkey right after account creation) and from the settings
 * "Add a passkey" action. The register endpoints are authenticated, so the
 * caller must already hold a valid session.
 */
export async function registerPasskey(): Promise<void> {
  const options = await authEndpoints.passkeyRegisterOptions();
  // react-native-passkey expects PublicKeyCredentialCreationOptionsJSON
  const attestation = await Passkey.create(options as never);
  await authEndpoints.passkeyRegisterVerify(attestation);
}
