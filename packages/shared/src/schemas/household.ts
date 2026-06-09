import { z } from 'zod';

export const householdRoleSchema = z.enum(['owner', 'member']);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

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
export type HouseholdMember = z.infer<typeof householdMemberSchema>;

export const householdSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerUserId: z.string().uuid(),
  memberCount: z.number().int().nonnegative().optional(),
  myRole: householdRoleSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Household = z.infer<typeof householdSchema>;

export const householdCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type HouseholdCreate = z.infer<typeof householdCreateSchema>;

export const householdPatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type HouseholdPatch = z.infer<typeof householdPatchSchema>;

export const householdMemberAddSchema = z.object({
  userId: z.string().uuid(),
});
export type HouseholdMemberAdd = z.infer<typeof householdMemberAddSchema>;

export const householdListResponseSchema = z.object({
  items: z.array(householdSchema),
});

export const householdMembersResponseSchema = z.object({
  items: z.array(householdMemberSchema),
});
