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
}, "strip", z.ZodTypeAny, {
    status: "active" | "consumed" | "discarded" | "expired";
    id: string;
    clientId: string;
    userId: string;
    productId: string | null;
    householdId: string | null;
    customName: string | null;
    expiryDate: string;
    purchaseDate: string | null;
    quantity: number;
    unit: string;
    notes: string | null;
    photoUrl: string | null;
    notifyAt: string[];
    createdAt: string;
    updatedAt: string;
    consumedAt: string | null;
}, {
    status: "active" | "consumed" | "discarded" | "expired";
    id: string;
    clientId: string;
    userId: string;
    productId: string | null;
    householdId: string | null;
    customName: string | null;
    expiryDate: string;
    purchaseDate: string | null;
    quantity: number;
    unit: string;
    notes: string | null;
    photoUrl: string | null;
    notifyAt: string[];
    createdAt: string;
    updatedAt: string;
    consumedAt: string | null;
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
}, "strip", z.ZodTypeAny, {
    clientId: string;
    expiryDate: string;
    quantity: number;
    unit: string;
    productId?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    clientId: string;
    expiryDate: string;
    productId?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
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
}, "strip", z.ZodTypeAny, {
    clientId: string;
    expiryDate: string;
    quantity: number;
    unit: string;
    productId?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    clientId: string;
    expiryDate: string;
    productId?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}>, {
    clientId: string;
    expiryDate: string;
    quantity: number;
    unit: string;
    productId?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    clientId: string;
    expiryDate: string;
    productId?: string | null | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
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
    notificationOffsetsDays: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    /** Move a record between personal and a household; enforced server-side. */
    householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    expiryDate?: string | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
    notificationOffsetsDays?: number[] | undefined;
}, {
    status?: "active" | "consumed" | "discarded" | "expired" | undefined;
    householdId?: string | null | undefined;
    customName?: string | null | undefined;
    expiryDate?: string | undefined;
    purchaseDate?: string | null | undefined;
    quantity?: number | undefined;
    unit?: string | undefined;
    notes?: string | null | undefined;
    photoUrl?: string | null | undefined;
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
    }, "strip", z.ZodTypeAny, {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
    }, {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
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
    scope: "personal" | "household" | "all";
    limit: number;
    householdId?: string | undefined;
    cursor?: string | undefined;
}, {
    householdId?: string | undefined;
    scope?: "personal" | "household" | "all" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type RecordListQuery = z.infer<typeof recordListQuerySchema>;
export declare const recordSyncConflictSchema: z.ZodObject<{
    clientId: z.ZodString;
    reason: z.ZodEnum<["scope_changed"]>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    reason: "scope_changed";
}, {
    clientId: string;
    reason: "scope_changed";
}>;
export type RecordSyncConflict = z.infer<typeof recordSyncConflictSchema>;
export declare const recordSyncBatchSchema: z.ZodObject<{
    since: z.ZodOptional<z.ZodNullable<z.ZodString>>;
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
        /** Assign the record to a household the caller belongs to; absent/null = personal. */
        householdId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    } & {
        id: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodEnum<["active", "consumed", "discarded", "expired"]>>;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        clientId: string;
        expiryDate: string;
        quantity: number;
        unit: string;
        updatedAt: string;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        id?: string | undefined;
        productId?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        notes?: string | null | undefined;
        photoUrl?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }, {
        clientId: string;
        expiryDate: string;
        updatedAt: string;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        id?: string | undefined;
        productId?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        notes?: string | null | undefined;
        photoUrl?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }>, "many">;
    deletes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    upserts: {
        clientId: string;
        expiryDate: string;
        quantity: number;
        unit: string;
        updatedAt: string;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        id?: string | undefined;
        productId?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        notes?: string | null | undefined;
        photoUrl?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }[];
    deletes: string[];
    since?: string | null | undefined;
}, {
    upserts: {
        clientId: string;
        expiryDate: string;
        updatedAt: string;
        status?: "active" | "consumed" | "discarded" | "expired" | undefined;
        id?: string | undefined;
        productId?: string | null | undefined;
        householdId?: string | null | undefined;
        customName?: string | null | undefined;
        purchaseDate?: string | null | undefined;
        quantity?: number | undefined;
        unit?: string | undefined;
        notes?: string | null | undefined;
        photoUrl?: string | null | undefined;
        notificationOffsetsDays?: number[] | undefined;
    }[];
    deletes: string[];
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
    }, "strip", z.ZodTypeAny, {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
    }, {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
    }>, "many">;
    deletedIds: z.ZodArray<z.ZodString, "many">;
    conflicts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        clientId: z.ZodString;
        reason: z.ZodEnum<["scope_changed"]>;
    }, "strip", z.ZodTypeAny, {
        clientId: string;
        reason: "scope_changed";
    }, {
        clientId: string;
        reason: "scope_changed";
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    serverTime: string;
    changes: {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
    }[];
    deletedIds: string[];
    conflicts: {
        clientId: string;
        reason: "scope_changed";
    }[];
}, {
    serverTime: string;
    changes: {
        status: "active" | "consumed" | "discarded" | "expired";
        id: string;
        clientId: string;
        userId: string;
        productId: string | null;
        householdId: string | null;
        customName: string | null;
        expiryDate: string;
        purchaseDate: string | null;
        quantity: number;
        unit: string;
        notes: string | null;
        photoUrl: string | null;
        notifyAt: string[];
        createdAt: string;
        updatedAt: string;
        consumedAt: string | null;
    }[];
    deletedIds: string[];
    conflicts?: {
        clientId: string;
        reason: "scope_changed";
    }[] | undefined;
}>;
export type RecordSyncResponse = z.infer<typeof recordSyncResponseSchema>;
export declare const pushTokenRegisterSchema: z.ZodObject<{
    expoPushToken: z.ZodString;
    platform: z.ZodEnum<["ios", "android"]>;
    deviceInfo: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    expoPushToken: string;
    platform: "ios" | "android";
    deviceInfo?: globalThis.Record<string, unknown> | undefined;
}, {
    expoPushToken: string;
    platform: "ios" | "android";
    deviceInfo?: globalThis.Record<string, unknown> | undefined;
}>;
export type PushTokenRegister = z.infer<typeof pushTokenRegisterSchema>;
export declare const pushTokenSchema: z.ZodObject<{
    id: z.ZodString;
    expoPushToken: z.ZodString;
    platform: z.ZodEnum<["ios", "android"]>;
    createdAt: z.ZodString;
    lastUsedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    expoPushToken: string;
    platform: "ios" | "android";
    lastUsedAt: string | null;
}, {
    id: string;
    createdAt: string;
    expoPushToken: string;
    platform: "ios" | "android";
    lastUsedAt: string | null;
}>;
export type PushToken = z.infer<typeof pushTokenSchema>;
//# sourceMappingURL=record.d.ts.map