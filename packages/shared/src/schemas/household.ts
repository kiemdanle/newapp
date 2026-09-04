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
  inviteCode: z.string().nullable().optional(),
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

export const householdMemberAddSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    userId: z.string().uuid().optional(),
  })
  .refine((data) => Boolean(data.email || data.userId), {
    message: 'Either email or userId must be provided',
  });
export type HouseholdMemberAdd = z.infer<typeof householdMemberAddSchema>;

export const householdJoinSchema = z.object({
  code: z.string().trim().toUpperCase().min(4).max(12),
});
export type HouseholdJoin = z.infer<typeof householdJoinSchema>;

export const householdListResponseSchema = z.object({
  items: z.array(householdSchema),
});

export const householdMembersResponseSchema = z.object({
  items: z.array(householdMemberSchema),
});
