import Config from 'react-native-config';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

let configured = false;

function configure() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: Config.GOOGLE_WEB_CLIENT_ID,
    iosClientId: Config.GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

export class GoogleSignInCancelled extends Error {
  constructor() {
    super('Google sign-in cancelled');
  }
}

export async function signInWithGoogle(): Promise<string> {
  configure();
  try {
    await GoogleSignin.hasPlayServices();
    const result = await GoogleSignin.signIn();
    const idToken =
      (result as { idToken?: string; data?: { idToken?: string } }).idToken ??
      (result as { data?: { idToken?: string } }).data?.idToken;
    if (!idToken) throw new Error('Google did not return an id_token');
    return idToken;
  } catch (e) {
    if ((e as { code?: string }).code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleSignInCancelled();
    }
    throw e;
  }
}
