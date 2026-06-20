import { z } from 'zod';
export declare const householdRoleSchema: z.ZodEnum<["owner", "member"]>;
export type HouseholdRole = z.infer<typeof householdRoleSchema>;
export declare const householdMemberSchema: z.ZodObject<{
    id: z.ZodString;
    householdId: z.ZodString;
    userId: z.ZodString;
    role: z.ZodEnum<["owner", "member"]>;
    joinedAt: z.ZodString;
    user: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        firstName: z.ZodString;
        avatarUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    }, {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    role: "owner" | "member";
    userId: string;
    householdId: string;
    joinedAt: string;
    user?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}, {
    id: string;
    role: "owner" | "member";
    userId: string;
    householdId: string;
    joinedAt: string;
    user?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}>;
export type HouseholdMember = z.infer<typeof householdMemberSchema>;
export declare const householdSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    ownerUserId: z.ZodString;
    memberCount: z.ZodOptional<z.ZodNumber>;
    myRole: z.ZodOptional<z.ZodEnum<["owner", "member"]>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    ownerUserId: string;
    memberCount?: number | undefined;
    myRole?: "owner" | "member" | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    ownerUserId: string;
    memberCount?: number | undefined;
    myRole?: "owner" | "member" | undefined;
}>;
export type Household = z.infer<typeof householdSchema>;
export declare const householdCreateSchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export type HouseholdCreate = z.infer<typeof householdCreateSchema>;
export declare const householdPatchSchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export type HouseholdPatch = z.infer<typeof householdPatchSchema>;
export declare const householdMemberAddSchema: z.ZodObject<{
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
}, {
    userId: string;
}>;
export type HouseholdMemberAdd = z.infer<typeof householdMemberAddSchema>;
export declare const householdListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        ownerUserId: z.ZodString;
        memberCount: z.ZodOptional<z.ZodNumber>;
        myRole: z.ZodOptional<z.ZodEnum<["owner", "member"]>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        ownerUserId: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
    }, {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        ownerUserId: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        ownerUserId: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
    }[];
}, {
    items: {
        id: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        ownerUserId: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
    }[];
}>;
export declare const householdMembersResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        householdId: z.ZodString;
        userId: z.ZodString;
        role: z.ZodEnum<["owner", "member"]>;
        joinedAt: z.ZodString;
        user: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            firstName: z.ZodString;
            avatarUrl: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        }, {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        role: "owner" | "member";
        userId: string;
        householdId: string;
        joinedAt: string;
        user?: {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        } | undefined;
    }, {
        id: string;
        role: "owner" | "member";
        userId: string;
        householdId: string;
        joinedAt: string;
        user?: {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        role: "owner" | "member";
        userId: string;
        householdId: string;
        joinedAt: string;
        user?: {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        } | undefined;
    }[];
}, {
    items: {
        id: string;
        role: "owner" | "member";
        userId: string;
        householdId: string;
        joinedAt: string;
        user?: {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        } | undefined;
    }[];
}>;
//# sourceMappingURL=household.d.ts.map