import { Platform } from 'react-native';
import { appleAuth } from '@invertase/react-native-apple-authentication';

export interface AppleSignInResult {
  identityToken: string;
  firstName?: string;
  lastName?: string;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return appleAuth.isSupported;
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const credential = await appleAuth.performRequest({
    requestedOperation: appleAuth.Operation.LOGIN,
    requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
  });
  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity_token');
  }
  return {
    identityToken: credential.identityToken,
    firstName: credential.fullName?.givenName ?? undefined,
    lastName: credential.fullName?.familyName ?? undefined,
  };
}
