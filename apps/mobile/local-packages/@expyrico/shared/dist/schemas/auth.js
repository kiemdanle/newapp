import { z } from 'zod';
import { userSchema } from './user.js';
export const emailField = z.string().trim().toLowerCase().email().max(254);
export const passwordField = z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be at most 128 characters');
export const nameField = z.string().trim().min(1).max(80);
export const tokensSchema = z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number().int().positive(),
});
export const authResultSchema = z.object({
    user: userSchema,
    tokens: tokensSchema,
    trustedDeviceToken: z.string().optional(),
});
export const totpChallengeSchema = z.object({
    requiresTotp: z.literal(true),
    challengeToken: z.string(),
});
/** Returned by login for an admin who must still set up TOTP before any session. */
export const totpEnrollmentRequiredSchema = z.object({
    requiresTotpEnrollment: z.literal(true),
    enrollmentChallenge: z.string(),
});
// --- Email + password ---
export const registerSchema = z.object({
    email: emailField,
    password: passwordField,
    firstName: nameField,
    lastName: nameField,
    // Optional referral attribution — absent for organic signups (v1 behavior unchanged).
    referralCode: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{8}$/).optional(),
});
export const loginSchema = z.object({
    email: emailField,
    password: passwordField,
    trustedDeviceToken: z.string().min(1).optional(),
});
export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});
export const verifyEmailSchema = z.object({
    email: emailField,
    code: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
});
export const resendVerificationSchema = z.object({
    email: emailField,
});
export const forgotPasswordSchema = z.object({
    email: emailField,
});
export const verifyResetCodeSchema = z.object({
    email: emailField,
    code: z.string().regex(/^\d{6}$/, 'Reset code must be 6 digits'),
});
export const verifyResetCodeResponseSchema = z.object({
    resetTicket: z.string(),
});
export const resetPasswordSchema = z.object({
    resetTicket: z.string().min(1),
    password: passwordField,
});
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
export const totpVerifyEnrollmentSchema = z.object({
    enrollmentChallenge: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
});
export const totpChallengeVerifySchema = z.object({
    challengeToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
    trustDevice: z.boolean().optional(),
});
/** Redeem a one-time recovery code in place of a TOTP code during login. */
export const totpRecoveryVerifySchema = z.object({
    challengeToken: z.string().min(1),
    recoveryCode: z.string().min(1),
    trustDevice: z.boolean().optional(),
});
// --- Change / Set Password (authenticated) ---
export const changePasswordSchema = z
    .object({
    currentPassword: z.string().min(1, 'Current password is required').optional(),
    newPassword: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your password').optional(),
})
    .refine((d) => !d.confirmPassword || d.newPassword === d.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
});
export const passwordMutationResponseSchema = z.object({
    tokens: tokensSchema,
    user: userSchema,
});
//# sourceMappingURL=auth.js.map