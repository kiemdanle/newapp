import { z } from 'zod';
import { passwordField } from './auth.js';
export const adminLoginRequestSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordField,
    trustedDeviceToken: z.string().min(1).optional(),
});
export const adminTotpRequestSchema = z.object({
    challengeToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
    trustDevice: z.boolean().optional(),
});
// Fresh-admin TOTP enrollment (M0b enforces "admins always have TOTP").
// `enrollmentChallenge` is single-use, 10-min TTL, gated server-side.
export const adminTotpEnrollRequestSchema = z.object({
    enrollmentChallenge: z.string().min(1),
});
export const adminTotpVerifyEnrollmentRequestSchema = z.object({
    enrollmentChallenge: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
});
export const adminTrustedDeviceRowSchema = z.object({
    id: z.string().uuid(),
    ip: z.string().nullable(),
    deviceInfo: z.record(z.unknown()).nullable(),
    expiresAt: z.string(),
    lastUsedAt: z.string().nullable(),
    createdAt: z.string(),
});
export const adminTrustedDevicesListSchema = z.object({
    devices: z.array(adminTrustedDeviceRowSchema),
});
export const adminTrustedDeviceRevokeResponseSchema = z.object({
    ok: z.literal(true),
});
//# sourceMappingURL=admin.js.map