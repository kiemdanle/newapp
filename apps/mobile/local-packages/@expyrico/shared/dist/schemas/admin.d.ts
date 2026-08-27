import { z } from 'zod';
export declare const adminLoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    trustedDeviceToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    trustedDeviceToken?: string | undefined;
}, {
    email: string;
    password: string;
    trustedDeviceToken?: string | undefined;
}>;
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;
export declare const adminTotpRequestSchema: z.ZodObject<{
    challengeToken: z.ZodString;
    code: z.ZodString;
    trustDevice: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    code: string;
    challengeToken: string;
    trustDevice?: boolean | undefined;
}, {
    code: string;
    challengeToken: string;
    trustDevice?: boolean | undefined;
}>;
export type AdminTotpRequest = z.infer<typeof adminTotpRequestSchema>;
export declare const adminTotpEnrollRequestSchema: z.ZodObject<{
    enrollmentChallenge: z.ZodString;
}, "strip", z.ZodTypeAny, {
    enrollmentChallenge: string;
}, {
    enrollmentChallenge: string;
}>;
export type AdminTotpEnrollRequest = z.infer<typeof adminTotpEnrollRequestSchema>;
export declare const adminTotpVerifyEnrollmentRequestSchema: z.ZodObject<{
    enrollmentChallenge: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    enrollmentChallenge: string;
}, {
    code: string;
    enrollmentChallenge: string;
}>;
export type AdminTotpVerifyEnrollmentRequest = z.infer<typeof adminTotpVerifyEnrollmentRequestSchema>;
export declare const adminTrustedDeviceRowSchema: z.ZodObject<{
    id: z.ZodString;
    ip: z.ZodNullable<z.ZodString>;
    deviceInfo: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    expiresAt: z.ZodString;
    lastUsedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    ip: string | null;
    deviceInfo: Record<string, unknown> | null;
    expiresAt: string;
    lastUsedAt: string | null;
}, {
    id: string;
    createdAt: string;
    ip: string | null;
    deviceInfo: Record<string, unknown> | null;
    expiresAt: string;
    lastUsedAt: string | null;
}>;
export type AdminTrustedDeviceRow = z.infer<typeof adminTrustedDeviceRowSchema>;
export declare const adminTrustedDevicesListSchema: z.ZodObject<{
    devices: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ip: z.ZodNullable<z.ZodString>;
        deviceInfo: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        expiresAt: z.ZodString;
        lastUsedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        ip: string | null;
        deviceInfo: Record<string, unknown> | null;
        expiresAt: string;
        lastUsedAt: string | null;
    }, {
        id: string;
        createdAt: string;
        ip: string | null;
        deviceInfo: Record<string, unknown> | null;
        expiresAt: string;
        lastUsedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    devices: {
        id: string;
        createdAt: string;
        ip: string | null;
        deviceInfo: Record<string, unknown> | null;
        expiresAt: string;
        lastUsedAt: string | null;
    }[];
}, {
    devices: {
        id: string;
        createdAt: string;
        ip: string | null;
        deviceInfo: Record<string, unknown> | null;
        expiresAt: string;
        lastUsedAt: string | null;
    }[];
}>;
export type AdminTrustedDevicesList = z.infer<typeof adminTrustedDevicesListSchema>;
export declare const adminTrustedDeviceRevokeResponseSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    ok: true;
}, {
    ok: true;
}>;
export type AdminTrustedDeviceRevokeResponse = z.infer<typeof adminTrustedDeviceRevokeResponseSchema>;
//# sourceMappingURL=admin.d.ts.map