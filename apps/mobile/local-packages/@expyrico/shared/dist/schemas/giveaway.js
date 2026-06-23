import { z } from 'zod';
export const giveawayStatusSchema = z.enum(['open', 'claimed', 'handed_off', 'completed', 'cancelled']);
export const claimStatusSchema = z.enum(['requested', 'selected', 'rejected']);
const titleField = z.string().trim().min(3).max(120);
const descField = z.string().trim().max(2000).optional();
const locationField = z.string().trim().min(2).max(160);
const noteField = z.string().trim().max(500).optional();
export const giveawaySchema = z.object({
    id: z.string().uuid(),
    giverUserId: z.string().uuid(),
    productId: z.string().uuid().nullable(),
    recordId: z.string().uuid().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    photoUrl: z.string().url().nullable(),
    locationText: z.string(),
    country: z.string().length(2).nullable(),
    status: giveawayStatusSchema,
    selectedRecipientId: z.string().uuid().nullable(),
    claimExpiresAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    handedOffAt: z.string().datetime().nullable(),
    confirmedAt: z.string().datetime().nullable(),
    completedAt: z.string().datetime().nullable(),
    claimCount: z.number().int().nonnegative().optional(),
    myClaim: z.object({
        id: z.string().uuid(),
        status: claimStatusSchema,
        pickupNote: z.string().nullable(),
    }).nullable().optional(),
    giver: z.object({
        id: z.string().uuid(),
        firstName: z.string(),
        avatarUrl: z.string().url().nullable(),
        giverRatingAvg: z.number().nullable(),
        transactionCount: z.number().int().nonnegative(),
    }).optional(),
});
export const giveawayCreateSchema = z.object({
    title: titleField,
    description: z.string().trim().max(2000).nullable().optional(),
    locationText: locationField,
    photoUrl: z.string().url().optional(),
    productId: z.string().uuid().optional(),
    recordId: z.string().uuid().optional(),
});
export const giveawayPatchSchema = z
    .object({
    title: titleField.optional(),
    description: descField,
    locationText: locationField.optional(),
    photoUrl: z.string().url().nullable().optional(),
})
    .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'at least one field required',
});
export const claimSchema = z.object({
    id: z.string().uuid(),
    giveawayId: z.string().uuid(),
    claimerUserId: z.string().uuid(),
    pickupNote: z.string().nullable(),
    status: claimStatusSchema,
    createdAt: z.string().datetime(),
    claimer: z.object({
        id: z.string().uuid(),
        firstName: z.string(),
        avatarUrl: z.string().url().nullable(),
        recipientRatingAvg: z.number().nullable(),
        transactionCount: z.number().int().nonnegative(),
    }).optional(),
});
export const claimCreateSchema = z.object({ pickupNote: noteField });
export const selectClaimSchema = z.object({ claimId: z.string().uuid() });
export const giveawayListQuerySchema = z.object({
    status: giveawayStatusSchema.default('open'),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
//# sourceMappingURL=giveaway.js.map