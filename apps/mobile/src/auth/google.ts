import Config from 'react-native-config';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

let configured = false;

export function isPlaceholderClientId(clientId?: string | null): boolean {
  if (!clientId) return true;
  return (
    clientId.startsWith('000000000000-') ||
    clientId.includes('abcdefghijklmnopqrstuvwxyz') ||
    clientId.startsWith('mock-') ||
    clientId === 'test-google-client-id'
  );
}
function configure() {
  if (configured) return;
  const webClientId = Config.GOOGLE_WEB_CLIENT_ID;
  const iosClientId = Config.GOOGLE_IOS_CLIENT_ID;
  GoogleSignin.configure({
    webClientId: isPlaceholderClientId(webClientId) ? undefined : webClientId,
    iosClientId: isPlaceholderClientId(iosClientId) ? undefined : iosClientId,
    offlineAccess: false,
  });
  configured = true;
}

export class GoogleSignInCancelled extends Error {
  constructor() {
    super('Google sign-in cancelled');
  }
}

export class GoogleSignInDeveloperError extends Error {
  constructor(message?: string) {
    super(
      message ??
        'Google Sign-In is not configured yet. Please add your Google OAuth Web Client ID to apps/mobile/.env and register your SHA-1 in Firebase Console.',
    );
    this.name = 'GoogleSignInDeveloperError';
  }
}

export async function signInWithGoogle(): Promise<string> {
  const webClientId = Config.GOOGLE_WEB_CLIENT_ID;
  if (isPlaceholderClientId(webClientId)) {
    throw new GoogleSignInDeveloperError(
      'Google Sign-In is not configured: please set GOOGLE_WEB_CLIENT_ID in apps/mobile/.env and register your SHA-1 in Firebase Console.',
    );
  }

  configure();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    const idToken =
      (result as { idToken?: string; data?: { idToken?: string } } | undefined)?.idToken ??
      (result as { data?: { idToken?: string } } | undefined)?.data?.idToken;
    if (!idToken) throw new Error('Google did not return an id_token');
    return idToken;
  } catch (e: unknown) {
    if (e instanceof GoogleSignInDeveloperError) throw e;
    const err = e as { code?: string; message?: string };
    if (err.code === statusCodes.SIGN_IN_CANCELLED || err.code === 'SIGN_IN_CANCELLED') {
      throw new GoogleSignInCancelled();
    }
    if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE || err.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      throw new Error('Google Play Services are not available on this device');
    }
    if (err.code === (statusCodes as Record<string, string>).DEVELOPER_ERROR || err.code === '10' || err.code === 'DEVELOPER_ERROR') {
      throw new GoogleSignInDeveloperError(
        'Google Sign-In configuration error (DEVELOPER_ERROR): Please verify that your Android SHA-1 fingerprint and Web Client ID are registered in Firebase Console.',
      );
    }
    throw e;
  }
}
