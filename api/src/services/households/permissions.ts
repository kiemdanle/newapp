import type { HouseholdRole } from '@expyrico/shared';
import type { Record } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';

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

/**
 * Returns the set of household IDs the user currently belongs to.
 * Used for membership-scoped visibility (records list, sync delta).
 */
export async function myHouseholdIds(userId: string): Promise<string[]> {
  const prisma = getPrisma();
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    select: { householdId: true },
  });
  return memberships.map((m) => m.householdId);
}

/**
 * Cross-household write predicate: a caller may write a record only if they
 * can write it in its CURRENT scope AND are a member of any target household.
 *
 * Returns the method's classification for the caller's relationship to the record:
 *  - 'personal_owner' — record is personal and belongs to caller
 *  - 'household_member' — record is in a household the caller belongs to
 *
 * Throws 404 when the record is personal and belongs to another user (never leak existence).
 * Throws 403 when the record is in a household the caller is not a member of.
 */
export type RecordWriteScope = 'personal_owner' | 'household_member';

export async function assertCanWriteRecord(
  record: Pick<Record, 'id' | 'userId' | 'householdId'>,
  callerId: string,
): Promise<RecordWriteScope> {
  if (record.householdId === null) {
    // Personal record — only the owner may touch it. 404 to never leak existence.
    if (record.userId !== callerId) {
      throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found' });
    }
    return 'personal_owner';
  }
  // Household record — any member of that household may write it.
  await assertMember(record.householdId, callerId);
  return 'household_member';
}

/**
 * Additional check for assigning a record TO a household: the caller must be a
 * member of the TARGET household. Call this AFTER assertCanWriteRecord.
 */
export async function assertCanAssignToHousehold(householdId: string, callerId: string) {
  await assertMember(householdId, callerId);
}
