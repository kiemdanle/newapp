import { z } from 'zod';
export declare const giveawayStatusSchema: z.ZodEnum<["open", "claimed", "handed_off", "completed", "cancelled"]>;
export type GiveawayStatus = z.infer<typeof giveawayStatusSchema>;
export declare const claimStatusSchema: z.ZodEnum<["requested", "selected", "rejected"]>;
export type ClaimStatus = z.infer<typeof claimStatusSchema>;
export declare const giveawaySchema: z.ZodObject<{
    id: z.ZodString;
    giverUserId: z.ZodString;
    productId: z.ZodNullable<z.ZodString>;
    recordId: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    photoUrl: z.ZodNullable<z.ZodString>;
    locationText: z.ZodString;
    country: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["open", "claimed", "handed_off", "completed", "cancelled"]>;
    selectedRecipientId: z.ZodNullable<z.ZodString>;
    claimExpiresAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    handedOffAt: z.ZodNullable<z.ZodString>;
    confirmedAt: z.ZodNullable<z.ZodString>;
    completedAt: z.ZodNullable<z.ZodString>;
    claimCount: z.ZodOptional<z.ZodNumber>;
    myClaim: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["requested", "selected", "rejected"]>;
        pickupNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "rejected" | "requested" | "selected";
        pickupNote: string | null;
    }, {
        id: string;
        status: "rejected" | "requested" | "selected";
        pickupNote: string | null;
    }>>>;
    giver: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        firstName: z.ZodString;
        avatarUrl: z.ZodNullable<z.ZodString>;
        giverRatingAvg: z.ZodNullable<z.ZodNumber>;
        transactionCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        giverRatingAvg: number | null;
        transactionCount: number;
    }, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        giverRatingAvg: number | null;
        transactionCount: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    country: string | null;
    status: "open" | "completed" | "claimed" | "handed_off" | "cancelled";
    createdAt: string;
    updatedAt: string;
    title: string;
    productId: string | null;
    photoUrl: string | null;
    giverUserId: string;
    recordId: string | null;
    description: string | null;
    locationText: string;
    selectedRecipientId: string | null;
    claimExpiresAt: string | null;
    handedOffAt: string | null;
    confirmedAt: string | null;
    completedAt: string | null;
    claimCount?: number | undefined;
    myClaim?: {
        id: string;
        status: "rejected" | "requested" | "selected";
        pickupNote: string | null;
    } | null | undefined;
    giver?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        giverRatingAvg: number | null;
        transactionCount: number;
    } | undefined;
}, {
    id: string;
    country: string | null;
    status: "open" | "completed" | "claimed" | "handed_off" | "cancelled";
    createdAt: string;
    updatedAt: string;
    title: string;
    productId: string | null;
    photoUrl: string | null;
    giverUserId: string;
    recordId: string | null;
    description: string | null;
    locationText: string;
    selectedRecipientId: string | null;
    claimExpiresAt: string | null;
    handedOffAt: string | null;
    confirmedAt: string | null;
    completedAt: string | null;
    claimCount?: number | undefined;
    myClaim?: {
        id: string;
        status: "rejected" | "requested" | "selected";
        pickupNote: string | null;
    } | null | undefined;
    giver?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        giverRatingAvg: number | null;
        transactionCount: number;
    } | undefined;
}>;
export type Giveaway = z.infer<typeof giveawaySchema>;
export declare const giveawayCreateSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    locationText: z.ZodString;
    photoUrl: z.ZodOptional<z.ZodString>;
    productId: z.ZodOptional<z.ZodString>;
    recordId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    locationText: string;
    productId?: string | undefined;
    photoUrl?: string | undefined;
    recordId?: string | undefined;
    description?: string | null | undefined;
}, {
    title: string;
    locationText: string;
    productId?: string | undefined;
    photoUrl?: string | undefined;
    recordId?: string | undefined;
    description?: string | null | undefined;
}>;
export type GiveawayCreate = z.infer<typeof giveawayCreateSchema>;
export declare const giveawayPatchSchema: z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    locationText: z.ZodOptional<z.ZodString>;
    photoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    photoUrl?: string | null | undefined;
    description?: string | undefined;
    locationText?: string | undefined;
}, {
    title?: string | undefined;
    photoUrl?: string | null | undefined;
    description?: string | undefined;
    locationText?: string | undefined;
}>, {
    title?: string | undefined;
    photoUrl?: string | null | undefined;
    description?: string | undefined;
    locationText?: string | undefined;
}, {
    title?: string | undefined;
    photoUrl?: string | null | undefined;
    description?: string | undefined;
    locationText?: string | undefined;
}>;
export type GiveawayPatch = z.infer<typeof giveawayPatchSchema>;
export declare const claimSchema: z.ZodObject<{
    id: z.ZodString;
    giveawayId: z.ZodString;
    claimerUserId: z.ZodString;
    pickupNote: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["requested", "selected", "rejected"]>;
    createdAt: z.ZodString;
    claimer: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        firstName: z.ZodString;
        avatarUrl: z.ZodNullable<z.ZodString>;
        recipientRatingAvg: z.ZodNullable<z.ZodNumber>;
        transactionCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        transactionCount: number;
        recipientRatingAvg: number | null;
    }, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        transactionCount: number;
        recipientRatingAvg: number | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "rejected" | "requested" | "selected";
    createdAt: string;
    pickupNote: string | null;
    giveawayId: string;
    claimerUserId: string;
    claimer?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        transactionCount: number;
        recipientRatingAvg: number | null;
    } | undefined;
}, {
    id: string;
    status: "rejected" | "requested" | "selected";
    createdAt: string;
    pickupNote: string | null;
    giveawayId: string;
    claimerUserId: string;
    claimer?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
        transactionCount: number;
        recipientRatingAvg: number | null;
    } | undefined;
}>;
export type Claim = z.infer<typeof claimSchema>;
export declare const claimCreateSchema: z.ZodObject<{
    pickupNote: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pickupNote?: string | undefined;
}, {
    pickupNote?: string | undefined;
}>;
export type ClaimCreate = z.infer<typeof claimCreateSchema>;
export declare const selectClaimSchema: z.ZodObject<{
    claimId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    claimId: string;
}, {
    claimId: string;
}>;
export type SelectClaim = z.infer<typeof selectClaimSchema>;
export declare const giveawayListQuerySchema: z.ZodObject<{
    status: z.ZodDefault<z.ZodEnum<["open", "claimed", "handed_off", "completed", "cancelled"]>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "completed" | "claimed" | "handed_off" | "cancelled";
    limit: number;
    cursor?: string | undefined;
}, {
    status?: "open" | "completed" | "claimed" | "handed_off" | "cancelled" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type GiveawayListQuery = z.infer<typeof giveawayListQuerySchema>;
//# sourceMappingURL=giveaway.d.ts.map