import type {
  AuthResult,
  LoginInput,
  RegisterInput,
  Tokens,
  User,
  UpdateProfile,
} from '@expyrico/shared';
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
  logout: () => apiClient.request<void>({ method: 'POST', path: '/auth/logout' }),
  me: () => apiClient.request<User>({ method: 'GET', path: '/auth/me' }),
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
  resetPassword: (token: string, password: string) =>
    apiClient.request<{ ok: true }>({
      method: 'POST',
      path: '/auth/reset-password',
      body: { token, password },
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
};
