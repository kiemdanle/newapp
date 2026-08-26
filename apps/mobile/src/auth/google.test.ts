import { signInWithGoogle, GoogleSignInCancelled, GoogleSignInDeveloperError, isPlaceholderClientId } from './google';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';

describe('google auth', () => {
  it('identifies placeholder client IDs', () => {
    expect(isPlaceholderClientId(undefined)).toBe(true);
    expect(isPlaceholderClientId('')).toBe(true);
    expect(isPlaceholderClientId('000000000000-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com')).toBe(true);
    expect(isPlaceholderClientId('mock-web-client-id')).toBe(true);
    expect(isPlaceholderClientId('test-google-client-id')).toBe(true);
    expect(isPlaceholderClientId('123456789.apps.googleusercontent.com')).toBe(false);
  });

  it('throws GoogleSignInDeveloperError when GOOGLE_WEB_CLIENT_ID is a placeholder', async () => {
    await expect(signInWithGoogle()).rejects.toThrow(GoogleSignInDeveloperError);
  });

  it('maps DEVELOPER_ERROR status code to GoogleSignInDeveloperError', async () => {
    (Config as { GOOGLE_WEB_CLIENT_ID: string }).GOOGLE_WEB_CLIENT_ID = '12345.apps.googleusercontent.com';
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({ code: 'DEVELOPER_ERROR' });
    await expect(signInWithGoogle()).rejects.toThrow(GoogleSignInDeveloperError);
  });

  it('maps SIGN_IN_CANCELLED status code to GoogleSignInCancelled', async () => {
    (Config as { GOOGLE_WEB_CLIENT_ID: string }).GOOGLE_WEB_CLIENT_ID = '12345.apps.googleusercontent.com';
    (GoogleSignin.signIn as jest.Mock).mockRejectedValueOnce({ code: statusCodes.SIGN_IN_CANCELLED });
    await expect(signInWithGoogle()).rejects.toThrow(GoogleSignInCancelled);
  });

  it('returns idToken when Google Sign-In succeeds', async () => {
    (Config as { GOOGLE_WEB_CLIENT_ID: string }).GOOGLE_WEB_CLIENT_ID = '12345.apps.googleusercontent.com';
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ idToken: 'valid-id-token' });
    const token = await signInWithGoogle();
    expect(token).toBe('valid-id-token');
  });
});
