import { z } from 'zod';
export declare const adminLoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;
export declare const adminTotpRequestSchema: z.ZodObject<{
    challengeToken: z.ZodString;
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    challengeToken: string;
}, {
    code: string;
    challengeToken: string;
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
//# sourceMappingURL=admin.d.ts.map