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
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const householdCreateSchema = z.object({
    name: z.string().trim().min(1).max(120),
});
export const householdPatchSchema = z.object({
    name: z.string().trim().min(1).max(120),
});
export const householdMemberAddSchema = z.object({
    userId: z.string().uuid(),
});
export const householdListResponseSchema = z.object({
    items: z.array(householdSchema),
});
export const householdMembersResponseSchema = z.object({
    items: z.array(householdMemberSchema),
});
//# sourceMappingURL=household.js.map