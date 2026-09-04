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
    householdId: string;
    userId: string;
    role: "owner" | "member";
    joinedAt: string;
    user?: {
        id: string;
        firstName: string;
        avatarUrl: string | null;
    } | undefined;
}, {
    id: string;
    householdId: string;
    userId: string;
    role: "owner" | "member";
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
    inviteCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    ownerUserId: string;
    createdAt: string;
    updatedAt: string;
    memberCount?: number | undefined;
    myRole?: "owner" | "member" | undefined;
    inviteCode?: string | null | undefined;
}, {
    id: string;
    name: string;
    ownerUserId: string;
    createdAt: string;
    updatedAt: string;
    memberCount?: number | undefined;
    myRole?: "owner" | "member" | undefined;
    inviteCode?: string | null | undefined;
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
export declare const householdMemberAddSchema: z.ZodEffects<z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
    email?: string | undefined;
}, {
    userId?: string | undefined;
    email?: string | undefined;
}>, {
    userId?: string | undefined;
    email?: string | undefined;
}, {
    userId?: string | undefined;
    email?: string | undefined;
}>;
export type HouseholdMemberAdd = z.infer<typeof householdMemberAddSchema>;
export declare const householdJoinSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type HouseholdJoin = z.infer<typeof householdJoinSchema>;
export declare const householdListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        ownerUserId: z.ZodString;
        memberCount: z.ZodOptional<z.ZodNumber>;
        myRole: z.ZodOptional<z.ZodEnum<["owner", "member"]>>;
        inviteCode: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        ownerUserId: string;
        createdAt: string;
        updatedAt: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
        inviteCode?: string | null | undefined;
    }, {
        id: string;
        name: string;
        ownerUserId: string;
        createdAt: string;
        updatedAt: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
        inviteCode?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        name: string;
        ownerUserId: string;
        createdAt: string;
        updatedAt: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
        inviteCode?: string | null | undefined;
    }[];
}, {
    items: {
        id: string;
        name: string;
        ownerUserId: string;
        createdAt: string;
        updatedAt: string;
        memberCount?: number | undefined;
        myRole?: "owner" | "member" | undefined;
        inviteCode?: string | null | undefined;
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
        householdId: string;
        userId: string;
        role: "owner" | "member";
        joinedAt: string;
        user?: {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        } | undefined;
    }, {
        id: string;
        householdId: string;
        userId: string;
        role: "owner" | "member";
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
        householdId: string;
        userId: string;
        role: "owner" | "member";
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
        householdId: string;
        userId: string;
        role: "owner" | "member";
        joinedAt: string;
        user?: {
            id: string;
            firstName: string;
            avatarUrl: string | null;
        } | undefined;
    }[];
}>;
export declare const householdInvitationStatusSchema: z.ZodEnum<["pending", "accepted", "declined", "expired", "revoked"]>;
export type HouseholdInvitationStatus = z.infer<typeof householdInvitationStatusSchema>;
export declare const householdInvitationSchema: z.ZodObject<{
    id: z.ZodString;
    householdId: z.ZodString;
    inviterUserId: z.ZodString;
    invitedEmail: z.ZodString;
    invitedUserId: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["pending", "accepted", "declined", "expired", "revoked"]>;
    token: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodString;
    createdAt: z.ZodString;
    inviterName: z.ZodOptional<z.ZodString>;
    householdName: z.ZodOptional<z.ZodString>;
    memberCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    id: string;
    householdId: string;
    status: "pending" | "accepted" | "declined" | "expired" | "revoked";
    createdAt: string;
    inviterUserId: string;
    invitedEmail: string;
    invitedUserId: string | null;
    expiresAt: string;
    memberCount?: number | undefined;
    token?: string | undefined;
    inviterName?: string | undefined;
    householdName?: string | undefined;
}, {
    id: string;
    householdId: string;
    status: "pending" | "accepted" | "declined" | "expired" | "revoked";
    createdAt: string;
    inviterUserId: string;
    invitedEmail: string;
    invitedUserId: string | null;
    expiresAt: string;
    memberCount?: number | undefined;
    token?: string | undefined;
    inviterName?: string | undefined;
    householdName?: string | undefined;
}>;
export type HouseholdInvitation = z.infer<typeof householdInvitationSchema>;
export declare const householdInvitationCreateSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type HouseholdInvitationCreate = z.infer<typeof householdInvitationCreateSchema>;
export declare const householdInvitationsListResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        householdId: z.ZodString;
        inviterUserId: z.ZodString;
        invitedEmail: z.ZodString;
        invitedUserId: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["pending", "accepted", "declined", "expired", "revoked"]>;
        token: z.ZodOptional<z.ZodString>;
        expiresAt: z.ZodString;
        createdAt: z.ZodString;
        inviterName: z.ZodOptional<z.ZodString>;
        householdName: z.ZodOptional<z.ZodString>;
        memberCount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        householdId: string;
        status: "pending" | "accepted" | "declined" | "expired" | "revoked";
        createdAt: string;
        inviterUserId: string;
        invitedEmail: string;
        invitedUserId: string | null;
        expiresAt: string;
        memberCount?: number | undefined;
        token?: string | undefined;
        inviterName?: string | undefined;
        householdName?: string | undefined;
    }, {
        id: string;
        householdId: string;
        status: "pending" | "accepted" | "declined" | "expired" | "revoked";
        createdAt: string;
        inviterUserId: string;
        invitedEmail: string;
        invitedUserId: string | null;
        expiresAt: string;
        memberCount?: number | undefined;
        token?: string | undefined;
        inviterName?: string | undefined;
        householdName?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        householdId: string;
        status: "pending" | "accepted" | "declined" | "expired" | "revoked";
        createdAt: string;
        inviterUserId: string;
        invitedEmail: string;
        invitedUserId: string | null;
        expiresAt: string;
        memberCount?: number | undefined;
        token?: string | undefined;
        inviterName?: string | undefined;
        householdName?: string | undefined;
    }[];
}, {
    items: {
        id: string;
        householdId: string;
        status: "pending" | "accepted" | "declined" | "expired" | "revoked";
        createdAt: string;
        inviterUserId: string;
        invitedEmail: string;
        invitedUserId: string | null;
        expiresAt: string;
        memberCount?: number | undefined;
        token?: string | undefined;
        inviterName?: string | undefined;
        householdName?: string | undefined;
    }[];
}>;
export type HouseholdInvitationsListResponse = z.infer<typeof householdInvitationsListResponseSchema>;
export declare const householdInvitationPreviewSchema: z.ZodObject<{
    id: z.ZodString;
    householdId: z.ZodString;
    householdName: z.ZodString;
    inviterName: z.ZodString;
    inviterAvatarUrl: z.ZodNullable<z.ZodString>;
    memberCount: z.ZodNumber;
    status: z.ZodEnum<["pending", "accepted", "declined", "expired", "revoked"]>;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    householdId: string;
    status: "pending" | "accepted" | "declined" | "expired" | "revoked";
    memberCount: number;
    expiresAt: string;
    inviterName: string;
    householdName: string;
    inviterAvatarUrl: string | null;
}, {
    id: string;
    householdId: string;
    status: "pending" | "accepted" | "declined" | "expired" | "revoked";
    memberCount: number;
    expiresAt: string;
    inviterName: string;
    householdName: string;
    inviterAvatarUrl: string | null;
}>;
export type HouseholdInvitationPreview = z.infer<typeof householdInvitationPreviewSchema>;
//# sourceMappingURL=household.d.ts.map