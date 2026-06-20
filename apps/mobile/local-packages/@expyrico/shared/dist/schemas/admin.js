import { z } from 'zod';
import { passwordField } from './auth.js';
export const adminLoginRequestSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: passwordField,
});
export const adminTotpRequestSchema = z.object({
    challengeToken: z.string().min(1),
    code: z.string().regex(/^\d{6}$/),
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
//# sourceMappingURL=admin.js.map