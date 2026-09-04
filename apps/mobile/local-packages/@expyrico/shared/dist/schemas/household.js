import { z } from 'zod';
export const householdRoleSchema = z.enum(['owner', 'member']);
export const householdMemberSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    userId: z.string().uuid(),
    role: householdRoleSchema,
    joinedAt: z.string().datetime(),
    user: z.object({
        id: z.string().uuid(),
        firstName: z.string(),
        avatarUrl: z.string().url().nullable(),
    }).optional(),
});
export const householdSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    ownerUserId: z.string().uuid(),
    memberCount: z.number().int().nonnegative().optional(),
    myRole: householdRoleSchema.optional(),
    inviteCode: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const householdCreateSchema = z.object({
    name: z.string().trim().min(1).max(120),
});
export const householdPatchSchema = z.object({
    name: z.string().trim().min(1).max(120),
});
export const householdMemberAddSchema = z
    .object({
    email: z.string().trim().toLowerCase().email().optional(),
    userId: z.string().uuid().optional(),
})
    .refine((data) => Boolean(data.email || data.userId), {
    message: 'Either email or userId must be provided',
});
export const householdJoinSchema = z.object({
    code: z.string().trim().toUpperCase().min(4).max(12),
});
export const householdListResponseSchema = z.object({
    items: z.array(householdSchema),
});
export const householdMembersResponseSchema = z.object({
    items: z.array(householdMemberSchema),
});
export const householdInvitationStatusSchema = z.enum([
    'pending',
    'accepted',
    'declined',
    'expired',
    'revoked',
]);
export const householdInvitationSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    inviterUserId: z.string().uuid(),
    invitedEmail: z.string().email(),
    invitedUserId: z.string().uuid().nullable(),
    status: householdInvitationStatusSchema,
    token: z.string().optional(),
    expiresAt: z.string().datetime(),
    createdAt: z.string().datetime(),
    inviterName: z.string().optional(),
    householdName: z.string().optional(),
    memberCount: z.number().int().optional(),
});
export const householdInvitationCreateSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
});
export const householdInvitationsListResponseSchema = z.object({
    items: z.array(householdInvitationSchema),
});
export const householdInvitationPreviewSchema = z.object({
    id: z.string().uuid(),
    householdId: z.string().uuid(),
    householdName: z.string(),
    inviterName: z.string(),
    inviterAvatarUrl: z.string().nullable(),
    memberCount: z.number().int(),
    status: householdInvitationStatusSchema,
    expiresAt: z.string().datetime(),
});
//# sourceMappingURL=household.js.map