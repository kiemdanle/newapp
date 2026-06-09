import type { HouseholdRole } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@pantry/shared';

export function roleAllowsManage(role: HouseholdRole): boolean {
  return role === 'owner';
}

export function canEditRecordHousehold(ctx: { isMember: boolean }): boolean {
  return ctx.isMember;
}

export async function assertMember(householdId: string, userId: string) {
  const prisma = getPrisma();
  const m = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId } },
  });
  if (!m) throw new AppError({ status: 403, code: ERROR_CODES.HOUSEHOLD_NOT_MEMBER, title: 'Not a member of this household' });
  return m;
}

export async function assertOwner(householdId: string, userId: string) {
  const m = await assertMember(householdId, userId);
  if (!roleAllowsManage(m.role)) {
    throw new AppError({ status: 403, code: ERROR_CODES.HOUSEHOLD_FORBIDDEN, title: 'Owner permission required' });
  }
  return m;
}
