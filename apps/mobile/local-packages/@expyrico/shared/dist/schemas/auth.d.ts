import { z } from 'zod';
export declare const emailField: z.ZodString;
export declare const passwordField: z.ZodString;
export declare const nameField: z.ZodString;
export declare const tokensSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodString;
    expiresIn: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}, {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}>;
export type Tokens = z.infer<typeof tokensSchema>;
export declare const authResultSchema: z.ZodObject<{
    user: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        emailVerified: z.ZodBoolean;
        firstName: z.ZodString;
        lastName: z.ZodString;
        country: z.ZodNullable<z.ZodString>;
        avatarUrl: z.ZodNullable<z.ZodString>;
        role: z.ZodEnum<["user", "admin"]>;
        status: z.ZodEnum<["active", "suspended", "deleted"]>;
        themePreference: z.ZodEnum<["expyrico", "bento", "clay", "material"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "suspended" | "deleted";
        id: string;
        email: string;
        emailVerified: boolean;
        firstName: string;
        lastName: string;
        country: string | null;
        avatarUrl: string | null;
        role: "user" | "admin";
        themePreference: "expyrico" | "bento" | "clay" | "material";
        createdAt: string;
        updatedAt: string;
    }, {
        status: "active" | "suspended" | "deleted";
        id: string;
        email: string;
        emailVerified: boolean;
        firstName: string;
        lastName: string;
        country: string | null;
        avatarUrl: string | null;
        role: "user" | "admin";
        themePreference: "expyrico" | "bento" | "clay" | "material";
        createdAt: string;
        updatedAt: string;
    }>;
    tokens: z.ZodObject<{
        accessToken: z.ZodString;
        refreshToken: z.ZodString;
        expiresIn: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }, {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    }>;
}, "strip", z.ZodTypeAny, {
    user: {
        status: "active" | "suspended" | "deleted";
        id: string;
        email: string;
        emailVerified: boolean;
        firstName: string;
        lastName: string;
        country: string | null;
        avatarUrl: string | null;
        role: "user" | "admin";
        themePreference: "expyrico" | "bento" | "clay" | "material";
        createdAt: string;
        updatedAt: string;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    };
}, {
    user: {
        status: "active" | "suspended" | "deleted";
        id: string;
        email: string;
        emailVerified: boolean;
        firstName: string;
        lastName: string;
        country: string | null;
        avatarUrl: string | null;
        role: "user" | "admin";
        themePreference: "expyrico" | "bento" | "clay" | "material";
        createdAt: string;
        updatedAt: string;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
    };
}>;
export type AuthResult = z.infer<typeof authResultSchema>;
export declare const totpChallengeSchema: z.ZodObject<{
    requiresTotp: z.ZodLiteral<true>;
    challengeToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    requiresTotp: true;
    challengeToken: string;
}, {
    requiresTotp: true;
    challengeToken: string;
}>;
export type TotpChallenge = z.infer<typeof totpChallengeSchema>;
/** Returned by login for an admin who must still set up TOTP before any session. */
export declare const totpEnrollmentRequiredSchema: z.ZodObject<{
    requiresTotpEnrollment: z.ZodLiteral<true>;
    enrollmentChallenge: z.ZodString;
}, "strip", z.ZodTypeAny, {
    requiresTotpEnrollment: true;
    enrollmentChallenge: string;
}, {
    requiresTotpEnrollment: true;
    enrollmentChallenge: string;
}>;
export type TotpEnrollmentRequired = z.infer<typeof totpEnrollmentRequiredSchema>;
export declare const registerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    referralCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    referralCode?: string | undefined;
}, {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    referralCode?: string | undefined;
}>;
export type RegisterInput = z.infer<typeof registerSchema>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const refreshSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export declare const verifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export declare const resendVerificationSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    token: string;
}, {
    password: string;
    token: string;
}>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export declare const oauthGoogleSchema: z.ZodObject<{
    idToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    idToken: string;
}, {
    idToken: string;
}>;
export declare const oauthAppleSchema: z.ZodObject<{
    identityToken: z.ZodString;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    identityToken: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
}, {
    identityToken: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
}>;
export declare const passkeyRegisterOptionsSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare const passkeyRegisterVerifySchema: z.ZodObject<{
    attestationResponse: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    attestationResponse?: unknown;
}, {
    attestationResponse?: unknown;
}>;
export declare const passkeyLoginOptionsSchema: z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
}, {
    email?: string | undefined;
}>;
export declare const passkeyLoginVerifySchema: z.ZodObject<{
    assertionResponse: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    assertionResponse?: unknown;
}, {
    assertionResponse?: unknown;
}>;
export declare const totpEnrollSchema: z.ZodObject<{
    enrollmentChallenge: z.ZodString;
}, "strip", z.ZodTypeAny, {
    enrollmentChallenge: string;
}, {
    enrollmentChallenge: string;
}>;
export declare const totpEnrollResponseSchema: z.ZodObject<{
    secret: z.ZodString;
    qrCodeDataUrl: z.ZodString;
    recoveryCodes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    secret: string;
    qrCodeDataUrl: string;
    recoveryCodes: string[];
}, {
    secret: string;
    qrCodeDataUrl: string;
    recoveryCodes: string[];
}>;
export type TotpEnrollResponse = z.infer<typeof totpEnrollResponseSchema>;
export declare const totpVerifyEnrollmentSchema: z.ZodObject<{
    enrollmentChallenge: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    enrollmentChallenge: string;
}, {
    code: string;
    enrollmentChallenge: string;
}>;
export declare const totpChallengeVerifySchema: z.ZodObject<{
    challengeToken: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    challengeToken: string;
}, {
    code: string;
    challengeToken: string;
}>;
/** Redeem a one-time recovery code in place of a TOTP code during login. */
export declare const totpRecoveryVerifySchema: z.ZodObject<{
    challengeToken: z.ZodString;
    recoveryCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    challengeToken: string;
    recoveryCode: string;
}, {
    challengeToken: string;
    recoveryCode: string;
}>;
//# sourceMappingURL=auth.d.ts.map