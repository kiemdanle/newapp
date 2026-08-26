import { z } from 'zod';
export declare const giveawayStatusSchema: z.ZodEnum<["open", "claimed", "handed_off", "completed", "cancelled"]>;
export type GiveawayStatus = z.infer<typeof giveawayStatusSchema>;
export declare const giveawaySortSchema: z.ZodDefault<z.ZodEnum<["new", "old", "claims_asc", "claims_desc", "expiry_asc"]>>;
export type GiveawaySort = z.infer<typeof giveawaySortSchema>;
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
    photoUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
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
        status: "requested" | "selected" | "rejected";
        pickupNote: string | null;
    }, {
        id: string;
        status: "requested" | "selected" | "rejected";
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
    giverUserId: string;
    productId: string | null;
    recordId: string | null;
    title: string;
    description: string | null;
    photoUrl: string | null;
    status: "open" | "claimed" | "handed_off" | "completed" | "cancelled";
    locationText: string;
    country: string | null;
    selectedRecipientId: string | null;
    claimExpiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    handedOffAt: string | null;
    confirmedAt: string | null;
    completedAt: string | null;
    photoUrls?: string[] | undefined;
    claimCount?: number | undefined;
    myClaim?: {
        id: string;
        status: "requested" | "selected" | "rejected";
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
    giverUserId: string;
    productId: string | null;
    recordId: string | null;
    title: string;
    description: string | null;
    photoUrl: string | null;
    status: "open" | "claimed" | "handed_off" | "completed" | "cancelled";
    locationText: string;
    country: string | null;
    selectedRecipientId: string | null;
    claimExpiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    handedOffAt: string | null;
    confirmedAt: string | null;
    completedAt: string | null;
    photoUrls?: string[] | undefined;
    claimCount?: number | undefined;
    myClaim?: {
        id: string;
        status: "requested" | "selected" | "rejected";
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
    photoUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claimExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodString]>>>;
    productId: z.ZodOptional<z.ZodString>;
    recordId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    locationText: string;
    productId?: string | undefined;
    recordId?: string | undefined;
    description?: string | null | undefined;
    photoUrl?: string | undefined;
    photoUrls?: string[] | undefined;
    claimExpiresAt?: string | null | undefined;
}, {
    title: string;
    locationText: string;
    productId?: string | undefined;
    recordId?: string | undefined;
    description?: string | null | undefined;
    photoUrl?: string | undefined;
    photoUrls?: string[] | undefined;
    claimExpiresAt?: string | null | undefined;
}>;
export type GiveawayCreate = z.infer<typeof giveawayCreateSchema>;
export declare const giveawayPatchSchema: z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    locationText: z.ZodOptional<z.ZodString>;
    photoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photoUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claimExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodString]>>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | undefined;
    photoUrl?: string | null | undefined;
    photoUrls?: string[] | undefined;
    locationText?: string | undefined;
    claimExpiresAt?: string | null | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    photoUrl?: string | null | undefined;
    photoUrls?: string[] | undefined;
    locationText?: string | undefined;
    claimExpiresAt?: string | null | undefined;
}>, {
    title?: string | undefined;
    description?: string | undefined;
    photoUrl?: string | null | undefined;
    photoUrls?: string[] | undefined;
    locationText?: string | undefined;
    claimExpiresAt?: string | null | undefined;
}, {
    title?: string | undefined;
    description?: string | undefined;
    photoUrl?: string | null | undefined;
    photoUrls?: string[] | undefined;
    locationText?: string | undefined;
    claimExpiresAt?: string | null | undefined;
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
    status: "requested" | "selected" | "rejected";
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
    status: "requested" | "selected" | "rejected";
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
    q: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodUnion<[z.ZodEnum<["open", "claimed", "handed_off", "completed", "cancelled"]>, z.ZodLiteral<"all">]>>;
    sort: z.ZodDefault<z.ZodEnum<["new", "old", "claims_asc", "claims_desc", "expiry_asc"]>>;
    location: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    hasPhoto: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodBoolean, z.ZodEnum<["true", "false"]>]>, boolean, boolean | "true" | "false">>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    sort: "new" | "old" | "claims_asc" | "claims_desc" | "expiry_asc";
    status: "open" | "claimed" | "handed_off" | "completed" | "cancelled" | "all";
    limit: number;
    country?: string | undefined;
    q?: string | undefined;
    location?: string | undefined;
    hasPhoto?: boolean | undefined;
    cursor?: string | undefined;
}, {
    sort?: "new" | "old" | "claims_asc" | "claims_desc" | "expiry_asc" | undefined;
    status?: "open" | "claimed" | "handed_off" | "completed" | "cancelled" | "all" | undefined;
    country?: string | undefined;
    q?: string | undefined;
    location?: string | undefined;
    hasPhoto?: boolean | "true" | "false" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type GiveawayListQuery = z.infer<typeof giveawayListQuerySchema>;
export declare const giveawayPhotoUploadResponseSchema: z.ZodObject<{
    photoUrl: z.ZodString;
    thumbUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    photoUrl: string;
    thumbUrl: string;
}, {
    photoUrl: string;
    thumbUrl: string;
}>;
export type GiveawayPhotoUploadResponse = z.infer<typeof giveawayPhotoUploadResponseSchema>;
//# sourceMappingURL=giveaway.d.ts.map