import { z } from 'zod';
export declare const recordStatusSchema: z.ZodEnum<["active", "consumed", "discarded", "expired"]>;
export type RecordStatus = z.infer<typeof recordStatusSchema>;
export declare const recordSchema: z.ZodObject<{
    id: z.ZodString;
    clientId: z.ZodString;
    userId: z.ZodString;
    productId: z.ZodNullable<z.ZodString>;
    householdId: z.ZodNullable<z.ZodString>;
    customName: z.ZodNullable<z.ZodString>;
    expiryDate: z.ZodString;
    purchaseDate: z.ZodNullable<z.ZodString>;
    quantity: z.ZodNumber;
    unit: z.ZodString;
    notes: z.ZodNullable<z.ZodString>;
    photoUrl: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "consumed", "discarded", "expired"]>;
    notifyAt: z.ZodArray<z.ZodString, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    consumedAt: z.ZodNullable<z.ZodString>;
    discardedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discardReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "active" | "consumed" | "discarded" | "expired";
    createdAt: string;
    updatedAt: string;
    productId: string | null;
    notes: string | null;
    clientId: string;
    userId: string;
    householdId: string | null;
    customName: string | null;
    expiryDate: string;
    purchaseDate: string | null;
    quantity: number;
    unit: string;
    photoUrl: string | null;
    notifyAt: string[];
    consumedAt: string | null;
    brand?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    location?: string | null | undefined;
}, {
    id: string;
    status: "active" | "consumed" | "discarded" | "expired";
    createdAt: string;
    updatedAt: string;
    productId: string | null;
    notes: string | null;
    clientId: string;
    userId: string;
    householdId: string | null;
    customName: string | null;
    expiryDate: string;
    purchaseDate: string | null;
    quantity: number;
    unit: string;
    photoUrl: string | null;
    notifyAt: string[];
    consumedAt: string | null;
    brand?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    location?: string | null | undefined;
}>;
export type Record = z.infer<typeof recordSchema>;
export declare const recordCreateBaseSchema: z.ZodObject<{
    clientId: z.ZodString;
    productId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiryDate: z.ZodString;
    purchaseDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodDefault<z.ZodNumber>;
    unit: z.ZodDefault<z.ZodString>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notificationOffsetsDays: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    /** Assign the record to a household the caller belongs to; absent/null = personal. */
    householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>, string | null, string | null | undefined>, string | null, string | null | undefined>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["active", "consumed", "discarded", "expired"]>>;
    consumedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discardedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discardReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    expiryDate: string;
    quantity: number;
    unit: string;
    location: string | null;
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    productId?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    clientId: string;
    expiryDate: string;
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    productId?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    location?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}>;
export declare const recordCreateSchema: z.ZodEffects<z.ZodObject<{
    clientId: z.ZodString;
    productId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiryDate: z.ZodString;
    purchaseDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodDefault<z.ZodNumber>;
    unit: z.ZodDefault<z.ZodString>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notificationOffsetsDays: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    /** Assign the record to a household the caller belongs to; absent/null = personal. */
    householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>, string | null, string | null | undefined>, string | null, string | null | undefined>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["active", "consumed", "discarded", "expired"]>>;
    consumedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discardedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discardReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    expiryDate: string;
    quantity: number;
    unit: string;
    location: string | null;
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    productId?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    clientId: string;
    expiryDate: string;
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    productId?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    location?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}>, {
    clientId: string;
    expiryDate: string;
    quantity: number;
    unit: string;
    location: string | null;
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    productId?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    clientId: string;
    expiryDate: string;
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    productId?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    location?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}>;
export type RecordCreate = z.infer<typeof recordCreateSchema>;
export declare const recordPatchSchema: z.ZodObject<{
    customName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiryDate: z.ZodOptional<z.ZodString>;
    purchaseDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    quantity: z.ZodOptional<z.ZodNumber>;
    unit: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    photoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["active", "consumed", "discarded", "expired"]>>;
    consumedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discardedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    discardReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notificationOffsetsDays: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    /** Move a record between personal and a household; enforced server-side. */
    householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    location: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>, string | null, string | null | undefined>, string | null, string | null | undefined>;
    brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    location: string | null;
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    expiryDate?: string | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    brand?: string | null | undefined;
    notes?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    expiryDate?: string | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    photoUrl?: string | null | undefined;
    consumedAt?: string | null | undefined;
    discardedAt?: string | null | undefined;
    discardReason?: string | null | undefined;
    location?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}>;
export type RecordPatch = z.infer<typeof recordPatchSchema>;
export declare const recordListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        clientId: z.ZodString;
        userId: z.ZodString;
        productId: z.ZodNullable<z.ZodString>;
        householdId: z.ZodNullable<z.ZodString>;
        customName: z.ZodNullable<z.ZodString>;
        expiryDate: z.ZodString;
        purchaseDate: z.ZodNullable<z.ZodString>;
        quantity: z.ZodNumber;
        unit: z.ZodString;
        notes: z.ZodNullable<z.ZodString>;
        photoUrl: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["active", "consumed", "discarded", "expired"]>;
        notifyAt: z.ZodArray<z.ZodString, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        consumedAt: z.ZodNullable<z.ZodString>;
        discardedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        discardReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }, {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }[];
    nextCursor: string | null;
}>;
export type RecordListResponse = z.infer<typeof recordListResponseSchema>;
export declare const recordScopeSchema: z.ZodDefault<z.ZodEnum<["personal", "household", "all"]>>;
export type RecordScope = z.infer<typeof recordScopeSchema>;
export declare const recordListQuerySchema: z.ZodObject<{
    scope: z.ZodDefault<z.ZodEnum<["personal", "household", "all"]>>;
    /** Restrict to a single household (only meaningful with scope=household|all). */
    householdId: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    scope: "personal" | "household" | "all";
    cursor?: string | undefined;
    householdId?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
    householdId?: string | undefined;
    scope?: "personal" | "household" | "all" | undefined;
}>;
export type RecordListQuery = z.infer<typeof recordListQuerySchema>;
export declare const recordSyncConflictSchema: z.ZodObject<{
    clientId: z.ZodString;
    reason: z.ZodEnum<["scope_changed", "product_unavailable", "item_limit_reached"]>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    reason: "item_limit_reached" | "scope_changed" | "product_unavailable";
}, {
    clientId: string;
    reason: "item_limit_reached" | "scope_changed" | "product_unavailable";
}>;
export type RecordSyncConflict = z.infer<typeof recordSyncConflictSchema>;
export declare const recordSyncBatchSchema: z.ZodObject<{
    since: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cursor: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        updatedAt: z.ZodString;
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        updatedAt: string;
    }, {
        id: string;
        updatedAt: string;
    }>>>;
    upserts: z.ZodArray<z.ZodObject<{
        clientId: z.ZodString;
        productId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        expiryDate: z.ZodString;
        purchaseDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        quantity: z.ZodDefault<z.ZodNumber>;
        unit: z.ZodDefault<z.ZodString>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        photoUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        notificationOffsetsDays: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        location: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>, string | null, string | null | undefined>, string | null, string | null | undefined>;
        brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    } & {
        id: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["active", "consumed", "discarded", "expired"]>>;
        updatedAt: z.ZodString;
        consumedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        discardedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        discardReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        updatedAt: string;
        clientId: string;
        expiryDate: string;
        quantity: number;
        unit: string;
        location: string | null;
        id?: string | undefined;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        brand?: string | null | undefined;
        productId?: string | null | undefined;
        notes?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        photoUrl?: string | null | undefined;
        consumedAt?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }, {
        updatedAt: string;
        clientId: string;
        expiryDate: string;
        id?: string | undefined;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        brand?: string | null | undefined;
        productId?: string | null | undefined;
        notes?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        photoUrl?: string | null | undefined;
        consumedAt?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }>, "many">;
    deletes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    upserts: {
        updatedAt: string;
        clientId: string;
        expiryDate: string;
        quantity: number;
        unit: string;
        location: string | null;
        id?: string | undefined;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        brand?: string | null | undefined;
        productId?: string | null | undefined;
        notes?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        photoUrl?: string | null | undefined;
        consumedAt?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }[];
    deletes: string[];
    cursor?: {
        id: string;
        updatedAt: string;
    } | null | undefined;
    since?: string | null | undefined;
}, {
    upserts: {
        updatedAt: string;
        clientId: string;
        expiryDate: string;
        id?: string | undefined;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        brand?: string | null | undefined;
        productId?: string | null | undefined;
        notes?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        photoUrl?: string | null | undefined;
        consumedAt?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }[];
    deletes: string[];
    cursor?: {
        id: string;
        updatedAt: string;
    } | null | undefined;
    since?: string | null | undefined;
}>;
export type RecordSyncBatch = z.infer<typeof recordSyncBatchSchema>;
export declare const recordSyncResponseSchema: z.ZodObject<{
    serverTime: z.ZodString;
    changes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        clientId: z.ZodString;
        userId: z.ZodString;
        productId: z.ZodNullable<z.ZodString>;
        householdId: z.ZodNullable<z.ZodString>;
        customName: z.ZodNullable<z.ZodString>;
        expiryDate: z.ZodString;
        purchaseDate: z.ZodNullable<z.ZodString>;
        quantity: z.ZodNumber;
        unit: z.ZodString;
        notes: z.ZodNullable<z.ZodString>;
        photoUrl: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["active", "consumed", "discarded", "expired"]>;
        notifyAt: z.ZodArray<z.ZodString, "many">;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        consumedAt: z.ZodNullable<z.ZodString>;
        discardedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        discardReason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        brand: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }, {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }>, "many">;
    deletedIds: z.ZodArray<z.ZodString, "many">;
    conflicts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        clientId: z.ZodString;
        reason: z.ZodEnum<["scope_changed", "product_unavailable", "item_limit_reached"]>;
    }, "strip", z.ZodTypeAny, {
        clientId: string;
        reason: "item_limit_reached" | "scope_changed" | "product_unavailable";
    }, {
        clientId: string;
        reason: "item_limit_reached" | "scope_changed" | "product_unavailable";
    }>, "many">>;
    householdIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    nextCursor: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        updatedAt: z.ZodString;
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        updatedAt: string;
    }, {
        id: string;
        updatedAt: string;
    }>>>;
    hasMore: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    serverTime: string;
    changes: {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }[];
    deletedIds: string[];
    conflicts: {
        clientId: string;
        reason: "item_limit_reached" | "scope_changed" | "product_unavailable";
    }[];
    householdIds: string[];
    hasMore: boolean;
    nextCursor?: {
        id: string;
        updatedAt: string;
    } | null | undefined;
}, {
    serverTime: string;
    changes: {
        id: string;
        status: "active" | "consumed" | "discarded" | "expired";
        createdAt: string;
        updatedAt: string;
        productId: string | null;
        notes: string | null;
        clientId: string;
        userId: string;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        photoUrl: string | null;
        notifyAt: string[];
        consumedAt: string | null;
        brand?: string | null | undefined;
        discardedAt?: string | null | undefined;
        discardReason?: string | null | undefined;
        location?: string | null | undefined;
    }[];
    deletedIds: string[];
    nextCursor?: {
        id: string;
        updatedAt: string;
    } | null | undefined;
    conflicts?: {
        clientId: string;
        reason: "item_limit_reached" | "scope_changed" | "product_unavailable";
    }[] | undefined;
    householdIds?: string[] | undefined;
    hasMore?: boolean | undefined;
}>;
export type RecordSyncResponse = z.infer<typeof recordSyncResponseSchema>;
export declare const pushTokenRegisterSchema: z.ZodObject<{
    deviceToken: z.ZodString;
    platform: z.ZodEnum<["ios", "android"]>;
    deviceInfo: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    platform: "android" | "ios";
    deviceToken: string;
    deviceInfo?: globalThis.Record<string, unknown> | undefined;
}, {
    platform: "android" | "ios";
    deviceToken: string;
    deviceInfo?: globalThis.Record<string, unknown> | undefined;
}>;
export type PushTokenRegister = z.infer<typeof pushTokenRegisterSchema>;
export declare const pushTokenSchema: z.ZodObject<{
    id: z.ZodString;
    deviceToken: z.ZodString;
    platform: z.ZodEnum<["ios", "android"]>;
    createdAt: z.ZodString;
    lastUsedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    platform: "android" | "ios";
    lastUsedAt: string | null;
    deviceToken: string;
}, {
    id: string;
    createdAt: string;
    platform: "android" | "ios";
    lastUsedAt: string | null;
    deviceToken: string;
}>;
export type PushToken = z.infer<typeof pushTokenSchema>;
export declare const recordBulkScopeSchema: z.ZodObject<{
    recordIds: z.ZodArray<z.ZodString, "many">;
    targetHouseholdId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    recordIds: string[];
    targetHouseholdId: string | null;
}, {
    recordIds: string[];
    targetHouseholdId: string | null;
}>;
export type RecordBulkScope = z.infer<typeof recordBulkScopeSchema>;
export declare const recordBulkScopeResponseSchema: z.ZodObject<{
    updatedCount: z.ZodNumber;
    recordIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    recordIds: string[];
    updatedCount: number;
}, {
    recordIds: string[];
    updatedCount: number;
}>;
export type RecordBulkScopeResponse = z.infer<typeof recordBulkScopeResponseSchema>;
//# sourceMappingURL=record.d.ts.map