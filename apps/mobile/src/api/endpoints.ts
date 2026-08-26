import type {
  AuthResult,
  LoginInput,
  RegisterInput,
  VerifyEmailInput,
  Tokens,
  User,
  UpdateProfile,
  ChangePasswordInput,
  PasswordMutationResponse,
} from '@expyrico/shared';
import { secureStore, getItem } from '../auth/secure-store';
import { PUSH_REGISTERED_FLAG_KEY } from '../features/push/registerPushToken';
import { apiClient } from './client';
/**
 * Server response shape when an account requires a TOTP step. Mobile users
 * rarely hit this (admins use the admin web app), but the type must be correct.
 */
export interface TotpChallenge {
  requiresTotp: true;
  challengeToken: string;
}

export const authEndpoints = {
  register: (input: RegisterInput) =>
    apiClient.request<AuthResult>({
      method: 'POST',
      path: '/auth/register',
      body: input,
      skipAuth: true,
    }),
  login: (input: LoginInput) =>
    apiClient.request<AuthResult | TotpChallenge>({
      method: 'POST',
      path: '/auth/login',
      body: input,
      skipAuth: true,
    }),
  refresh: (refreshToken: string) =>
    apiClient.request<Tokens>({
      method: 'POST',
      path: '/auth/refresh',
      body: { refreshToken },
      skipAuth: true,
    }),
  logout: async () => {
    const refreshToken = await secureStore.getRefreshToken();
    const pushToken = await getItem(PUSH_REGISTERED_FLAG_KEY);
    if (pushToken) {
      await apiClient.request<void>({
        method: 'POST',
        path: '/me/push-token/revoke-by-token',
        body: { deviceToken: pushToken },
      }).catch(() => {});
    }
    return apiClient.request<void>({
      method: 'POST',
      path: '/auth/logout',
      body: refreshToken ? { refreshToken } : {},
    });
  },
  me: () => apiClient.request<User>({ method: 'GET', path: '/auth/me' }),
  verifyEmail: (input: VerifyEmailInput) =>
    apiClient.request<{ verified: true }>({
      method: 'POST',
      path: '/auth/verify-email',
      body: input,
      skipAuth: true,
    }),
  resendVerification: (email: string) =>
    apiClient.request<{ ok: true }>({
      method: 'POST',
      path: '/auth/resend-verification',
      body: { email },
      skipAuth: true,
    }),
  forgotPassword: (email: string) =>
    apiClient.request<{ ok: true }>({
      method: 'POST',
      path: '/auth/forgot-password',
      body: { email },
      skipAuth: true,
    }),
  verifyResetCode: (email: string, code: string) =>
    apiClient.request<{ resetTicket: string }>({
      method: 'POST',
      path: '/auth/verify-reset-code',
      body: { email, code },
      skipAuth: true,
    }),
  resetPassword: (resetTicket: string, password: string) =>
    apiClient.request<{ ok: true }>({
      method: 'POST',
      path: '/auth/reset-password',
      body: { resetTicket, password },
      skipAuth: true,
    }),
  oauthGoogle: (idToken: string) =>
    apiClient.request<AuthResult>({
      method: 'POST',
      path: '/auth/oauth/google',
      body: { idToken },
      skipAuth: true,
    }),
  oauthApple: (identityToken: string, firstName?: string, lastName?: string) =>
    apiClient.request<AuthResult>({
      method: 'POST',
      path: '/auth/oauth/apple',
      body: { identityToken, firstName, lastName },
      skipAuth: true,
    }),
  passkeyLoginOptions: (email?: string) =>
    apiClient.request<unknown>({
      method: 'POST',
      path: '/auth/passkey/login/options',
      body: { email },
      skipAuth: true,
    }),
  passkeyLoginVerify: (assertionResponse: unknown) =>
    apiClient.request<AuthResult>({
      method: 'POST',
      path: '/auth/passkey/login/verify',
      body: { assertionResponse },
      skipAuth: true,
    }),
  // Registration adds a passkey credential to the *currently authenticated*
  // account, so these calls carry the access token (no skipAuth).
  passkeyRegisterOptions: () =>
    apiClient.request<unknown>({ method: 'POST', path: '/auth/passkey/register/options' }),
  passkeyRegisterVerify: (attestationResponse: unknown) =>
    apiClient.request<{ ok: true }>({
      method: 'POST',
      path: '/auth/passkey/register/verify',
      body: { attestationResponse },
    }),
};

export const meEndpoints = {
  update: (input: UpdateProfile) =>
    apiClient.request<User>({ method: 'PATCH', path: '/me', body: input }),
  changePassword: (input: ChangePasswordInput) =>
    apiClient.request<PasswordMutationResponse>({
      method: 'PUT',
      path: '/me/password',
      body: input,
    }),
  uploadAvatar: (formData: FormData) =>
    apiClient.request<{ avatarUrl: string; user: User }>({
      method: 'POST',
      path: '/me/avatar',
      body: formData,
    }),
  deleteAvatar: () =>
    apiClient.request<User>({ method: 'DELETE', path: '/me/avatar' }),
};
