import { z } from 'zod';
export declare const transactionRatingCreateSchema: z.ZodObject<{
    stars: z.ZodNumber;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stars: number;
    comment?: string | undefined;
}, {
    stars: number;
    comment?: string | undefined;
}>;
export type TransactionRatingCreate = z.infer<typeof transactionRatingCreateSchema>;
export declare const transactionRatingSchema: z.ZodObject<{
    id: z.ZodString;
    giveawayId: z.ZodString;
    raterUserId: z.ZodString;
    rateeUserId: z.ZodString;
    raterRole: z.ZodEnum<["giver", "recipient"]>;
    stars: z.ZodNumber;
    comment: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    comment: string | null;
    giveawayId: string;
    stars: number;
    raterUserId: string;
    rateeUserId: string;
    raterRole: "giver" | "recipient";
}, {
    id: string;
    createdAt: string;
    comment: string | null;
    giveawayId: string;
    stars: number;
    raterUserId: string;
    rateeUserId: string;
    raterRole: "giver" | "recipient";
}>;
export type TransactionRating = z.infer<typeof transactionRatingSchema>;
export declare const reputationSchema: z.ZodObject<{
    userId: z.ZodString;
    giverRatingAvg: z.ZodNullable<z.ZodNumber>;
    recipientRatingAvg: z.ZodNullable<z.ZodNumber>;
    transactionCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    userId: string;
    giverRatingAvg: number | null;
    transactionCount: number;
    recipientRatingAvg: number | null;
}, {
    userId: string;
    giverRatingAvg: number | null;
    transactionCount: number;
    recipientRatingAvg: number | null;
}>;
export type Reputation = z.infer<typeof reputationSchema>;
//# sourceMappingURL=reputation.d.ts.map