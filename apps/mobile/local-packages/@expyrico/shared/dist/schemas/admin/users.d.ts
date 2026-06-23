import { z } from 'zod';
export declare const adminUserRoleSchema: z.ZodEnum<["user", "admin"]>;
export declare const adminUserStatusSchema: z.ZodEnum<["active", "suspended", "deleted"]>;
export declare const adminUserRowSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    country: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<["user", "admin"]>;
    status: z.ZodEnum<["active", "suspended", "deleted"]>;
    createdAt: z.ZodString;
    lastSeenAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string | null;
    role: "user" | "admin";
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    lastSeenAt: string | null;
}, {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string | null;
    role: "user" | "admin";
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    lastSeenAt: string | null;
}>;
export declare const adminUsersQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["active", "suspended", "deleted"]>>;
    role: z.ZodOptional<z.ZodEnum<["user", "admin"]>>;
    country: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
    sort: z.ZodDefault<z.ZodEnum<["createdAt", "lastSeenAt", "email"]>>;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    sort: "email" | "createdAt" | "lastSeenAt";
    limit: number;
    order: "asc" | "desc";
    country?: string | undefined;
    role?: "user" | "admin" | undefined;
    status?: "active" | "suspended" | "deleted" | undefined;
    cursor?: string | undefined;
    q?: string | undefined;
}, {
    country?: string | undefined;
    role?: "user" | "admin" | undefined;
    status?: "active" | "suspended" | "deleted" | undefined;
    sort?: "email" | "createdAt" | "lastSeenAt" | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
    q?: string | undefined;
    order?: "asc" | "desc" | undefined;
}>;
export declare const adminUsersListSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodString;
        country: z.ZodNullable<z.ZodString>;
        role: z.ZodEnum<["user", "admin"]>;
        status: z.ZodEnum<["active", "suspended", "deleted"]>;
        createdAt: z.ZodString;
        lastSeenAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        country: string | null;
        role: "user" | "admin";
        status: "active" | "suspended" | "deleted";
        createdAt: string;
        lastSeenAt: string | null;
    }, {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        country: string | null;
        role: "user" | "admin";
        status: "active" | "suspended" | "deleted";
        createdAt: string;
        lastSeenAt: string | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        country: string | null;
        role: "user" | "admin";
        status: "active" | "suspended" | "deleted";
        createdAt: string;
        lastSeenAt: string | null;
    }[];
    nextCursor: string | null;
}, {
    items: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        country: string | null;
        role: "user" | "admin";
        status: "active" | "suspended" | "deleted";
        createdAt: string;
        lastSeenAt: string | null;
    }[];
    nextCursor: string | null;
}>;
export declare const adminUserDetailSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    country: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<["user", "admin"]>;
    status: z.ZodEnum<["active", "suspended", "deleted"]>;
    createdAt: z.ZodString;
    lastSeenAt: z.ZodNullable<z.ZodString>;
} & {
    emailVerifiedAt: z.ZodNullable<z.ZodString>;
    totpEnabledAt: z.ZodNullable<z.ZodString>;
    recordCount: z.ZodNumber;
    reviewCount: z.ZodNumber;
    openReportsAgainst: z.ZodNumber;
    sessions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ip: z.ZodNullable<z.ZodString>;
        deviceInfo: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        expiresAt: z.ZodString;
        revokedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        deviceInfo: Record<string, unknown> | null;
        ip: string | null;
        expiresAt: string;
        revokedAt: string | null;
    }, {
        id: string;
        deviceInfo: Record<string, unknown> | null;
        ip: string | null;
        expiresAt: string;
        revokedAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string | null;
    role: "user" | "admin";
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    reviewCount: number;
    lastSeenAt: string | null;
    emailVerifiedAt: string | null;
    totpEnabledAt: string | null;
    recordCount: number;
    openReportsAgainst: number;
    sessions: {
        id: string;
        deviceInfo: Record<string, unknown> | null;
        ip: string | null;
        expiresAt: string;
        revokedAt: string | null;
    }[];
}, {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string | null;
    role: "user" | "admin";
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    reviewCount: number;
    lastSeenAt: string | null;
    emailVerifiedAt: string | null;
    totpEnabledAt: string | null;
    recordCount: number;
    openReportsAgainst: number;
    sessions: {
        id: string;
        deviceInfo: Record<string, unknown> | null;
        ip: string | null;
        expiresAt: string;
        revokedAt: string | null;
    }[];
}>;
export declare const adminUserPatchSchema: z.ZodEffects<z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["active", "suspended", "deleted"]>>;
    role: z.ZodOptional<z.ZodEnum<["user", "admin"]>>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    role?: "user" | "admin" | undefined;
    status?: "active" | "suspended" | "deleted" | undefined;
}, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    role?: "user" | "admin" | undefined;
    status?: "active" | "suspended" | "deleted" | undefined;
}>, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    role?: "user" | "admin" | undefined;
    status?: "active" | "suspended" | "deleted" | undefined;
}, {
    firstName?: string | undefined;
    lastName?: string | undefined;
    role?: "user" | "admin" | undefined;
    status?: "active" | "suspended" | "deleted" | undefined;
}>;
export declare const adminUserImpersonateResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    expiresIn: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    expiresIn: number;
}, {
    accessToken: string;
    expiresIn: number;
}>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserPatch = z.infer<typeof adminUserPatchSchema>;
//# sourceMappingURL=users.d.ts.map