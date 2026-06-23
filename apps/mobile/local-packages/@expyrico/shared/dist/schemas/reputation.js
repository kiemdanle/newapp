import { z } from 'zod';
const starsField = z.number().int().min(1).max(5);
export const transactionRatingCreateSchema = z.object({
    stars: starsField,
    comment: z.string().trim().max(1000).optional(),
});
export const transactionRatingSchema = z.object({
    id: z.string().uuid(),
    giveawayId: z.string().uuid(),
    raterUserId: z.string().uuid(),
    rateeUserId: z.string().uuid(),
    raterRole: z.enum(['giver', 'recipient']),
    stars: starsField,
    comment: z.string().nullable(),
    createdAt: z.string().datetime(),
});
export const reputationSchema = z.object({
    userId: z.string().uuid(),
    giverRatingAvg: z.number().nullable(),
    recipientRatingAvg: z.number().nullable(),
    transactionCount: z.number().int().nonnegative(),
});
//# sourceMappingURL=reputation.js.map