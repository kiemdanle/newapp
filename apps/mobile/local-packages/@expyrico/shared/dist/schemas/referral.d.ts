import { z } from 'zod';
export declare const referralStatusSchema: z.ZodEnum<["pending", "activated"]>;
export type ReferralStatus = z.infer<typeof referralStatusSchema>;
export declare const referralCodeSchema: z.ZodString;
export type ReferralCode = z.infer<typeof referralCodeSchema>;
export declare const referredUserSchema: z.ZodObject<{
    referredUserId: z.ZodString;
    firstName: z.ZodString;
    status: z.ZodEnum<["pending", "activated"]>;
    activatedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    firstName: string;
    status: "pending" | "activated";
    createdAt: string;
    referredUserId: string;
    activatedAt: string | null;
}, {
    firstName: string;
    status: "pending" | "activated";
    createdAt: string;
    referredUserId: string;
    activatedAt: string | null;
}>;
export type ReferredUser = z.infer<typeof referredUserSchema>;
/** GET /v1/me/referral — passive attribution summary (v1.x, no rewards). */
export declare const referralSummarySchema: z.ZodObject<{
    referralCode: z.ZodString;
    shareUrl: z.ZodString;
    activatedCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    referralCode: string;
    shareUrl: string;
    activatedCount: number;
}, {
    referralCode: string;
    shareUrl: string;
    activatedCount: number;
}>;
export type ReferralSummary = z.infer<typeof referralSummarySchema>;
/** GET /v1/admin/referrals/overview */
export declare const adminReferralRowSchema: z.ZodObject<{
    referrerUserId: z.ZodString;
    firstName: z.ZodString;
    email: z.ZodString;
    referralCode: z.ZodNullable<z.ZodString>;
    referredCount: z.ZodNumber;
    activatedCount: z.ZodNumber;
    abuseFlag: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    email: string;
    firstName: string;
    referralCode: string | null;
    activatedCount: number;
    referrerUserId: string;
    referredCount: number;
    abuseFlag: boolean;
}, {
    email: string;
    firstName: string;
    referralCode: string | null;
    activatedCount: number;
    referrerUserId: string;
    referredCount: number;
    abuseFlag: boolean;
}>;
export type AdminReferralRow = z.infer<typeof adminReferralRowSchema>;
export declare const adminReferralOverviewSchema: z.ZodObject<{
    totalReferrals: z.ZodNumber;
    totalActivated: z.ZodNumber;
    topReferrers: z.ZodArray<z.ZodObject<{
        referrerUserId: z.ZodString;
        firstName: z.ZodString;
        email: z.ZodString;
        referralCode: z.ZodNullable<z.ZodString>;
        referredCount: z.ZodNumber;
        activatedCount: z.ZodNumber;
        abuseFlag: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        email: string;
        firstName: string;
        referralCode: string | null;
        activatedCount: number;
        referrerUserId: string;
        referredCount: number;
        abuseFlag: boolean;
    }, {
        email: string;
        firstName: string;
        referralCode: string | null;
        activatedCount: number;
        referrerUserId: string;
        referredCount: number;
        abuseFlag: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    totalReferrals: number;
    totalActivated: number;
    topReferrers: {
        email: string;
        firstName: string;
        referralCode: string | null;
        activatedCount: number;
        referrerUserId: string;
        referredCount: number;
        abuseFlag: boolean;
    }[];
}, {
    totalReferrals: number;
    totalActivated: number;
    topReferrers: {
        email: string;
        firstName: string;
        referralCode: string | null;
        activatedCount: number;
        referrerUserId: string;
        referredCount: number;
        abuseFlag: boolean;
    }[];
}>;
export type AdminReferralOverview = z.infer<typeof adminReferralOverviewSchema>;
//# sourceMappingURL=referral.d.ts.map