import { z } from 'zod';
import { userSchema } from './user.js';

const emailField = z.string().trim().toLowerCase().email().max(254);
const passwordField = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters');
const nameField = z.string().trim().min(1).max(80);

export const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type Tokens = z.infer<typeof tokensSchema>;

export const authResultSchema = z.object({
  user: userSchema,
  tokens: tokensSchema,
});
export type AuthResult = z.infer<typeof authResultSchema>;

export const totpChallengeSchema = z.object({
  requiresTotp: z.literal(true),
  challengeToken: z.string(),
});
export type TotpChallenge = z.infer<typeof totpChallengeSchema>;

/** Returned by login for an admin who must still set up TOTP before any session. */
export const totpEnrollmentRequiredSchema = z.object({
  requiresTotpEnrollment: z.literal(true),
  enrollmentChallenge: z.string(),
});
export type TotpEnrollmentRequired = z.infer<typeof totpEnrollmentRequiredSchema>;

// --- Email + password ---

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  firstName: nameField,
  lastName: nameField,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordField,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// --- OAuth ---

export const oauthGoogleSchema = z.object({
  idToken: z.string().min(1),
});
export const oauthAppleSchema = z.object({
  identityToken: z.string().min(1),
  firstName: nameField.optional(),
  lastName: nameField.optional(),
});

// --- Passkeys ---

export const passkeyRegisterOptionsSchema = z.object({});
export const passkeyRegisterVerifySchema = z.object({
  attestationResponse: z.unknown(),
});
export const passkeyLoginOptionsSchema = z.object({
  email: emailField.optional(),
});
export const passkeyLoginVerifySchema = z.object({
  assertionResponse: z.unknown(),
});

// --- TOTP (admin) ---

// Enrollment is authorized by the single-use `enrollmentChallenge` issued by the
// login route to an admin who has not yet set up TOTP.
export const totpEnrollSchema = z.object({
  enrollmentChallenge: z.string().min(1),
});
export const totpEnrollResponseSchema = z.object({
  secret: z.string(),
  qrCodeDataUrl: z.string(),
  recoveryCodes: z.array(z.string()).length(10),
});
export type TotpEnrollResponse = z.infer<typeof totpEnrollResponseSchema>;

export const totpVerifyEnrollmentSchema = z.object({
  enrollmentChallenge: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});
export const totpChallengeVerifySchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});
/** Redeem a one-time recovery code in place of a TOTP code during login. */
export const totpRecoveryVerifySchema = z.object({
  challengeToken: z.string().min(1),
  recoveryCode: z.string().min(1),
});
