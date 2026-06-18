import type { Household, HouseholdMember, User } from '@prisma/client';
import type { Household as ApiHousehold, HouseholdMember as ApiMember } from '@expyrico/shared';

export function toApiHousehold(
  h: Household,
  opts: { memberCount?: number; myRole?: 'owner' | 'member' } = {},
): ApiHousehold {
  return {
    id: h.id,
    name: h.name,
    ownerUserId: h.ownerUserId,
    memberCount: opts.memberCount,
    myRole: opts.myRole,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  };
}

type MemberWithUser = HouseholdMember & {
  user?: Pick<User, 'id' | 'firstName' | 'avatarUrl'> | null;
};

export function toApiMember(m: MemberWithUser): ApiMember {
  const out: ApiMember = {
    id: m.id,
    householdId: m.householdId,
    userId: m.userId,
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  };
  if (m.user) {
    out.user = { id: m.user.id, firstName: m.user.firstName, avatarUrl: m.user.avatarUrl };
  }
  return out;
}
