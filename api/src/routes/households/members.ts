import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { householdMemberAddSchema, householdMembersResponseSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertOwner, assertMember } from '../../services/households/permissions.js';
import { toApiMember } from '../../services/households/repository.js';
import {
  cancelMemberRemindersForHousehold,
  scheduleNewMemberReminders,
  reschedulePersonalRecordReminders,
} from '../../services/households/household-reminders.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const memberParamsSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

/**
 * Take a Postgres advisory lock keyed on the household id so concurrent
 * dissolve / member-remove / record-write serialize. Released automatically
 * when the enclosing transaction commits.
 */
async function lockHouseholdRow(tx: ReturnType<typeof getPrisma>, householdId: string): Promise<void> {
  // pg_advisory_xact_lock: session-level, released at transaction end.
  // Hash the UUID into a bigint Prisma can bind: use parseInt (safe integer range).
  const hex = householdId.replace(/-/g, '').slice(0, 15);
  const lockKey = parseInt(hex, 16);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
}

export async function membersAddRoute(app: FastifyInstance) {
  app.post('/households/:id/members', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id: householdId } = paramsSchema.parse(req.params);
    const { userId } = householdMemberAddSchema.parse(req.body);
    const prisma = getPrisma();
    const household = await prisma.household.findUnique({ where: { id: householdId } });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });
    await assertOwner(householdId, req.user!.id);
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'User not found' });

    let member: Awaited<ReturnType<typeof prisma.householdMember.create>>;
    try {
      [member] = await prisma.$transaction(async (tx) => {
        await lockHouseholdRow(tx as unknown as ReturnType<typeof getPrisma>, householdId);
        const m = await tx.householdMember.create({
          data: { householdId, userId, role: 'member' },
          include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
        });
        // Schedule the new member into every active household record's reminders,
        // using their own notification offsets.
        await scheduleNewMemberReminders(userId, householdId);
        return [m];
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already a member' });
      }
      throw err;
    }
    return reply.status(201).send(toApiMember(member));
  });
}

export async function membersListRoute(app: FastifyInstance) {
  app.get('/households/:id/members', { onRequest: [app.requireAuth] }, async (req) => {
    const { id: householdId } = paramsSchema.parse(req.params);
    const household = await getPrisma().household.findUnique({ where: { id: householdId } });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });
    await assertMember(householdId, req.user!.id);
    const members = await getPrisma().householdMember.findMany({
      where: { householdId },
      include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return householdMembersResponseSchema.parse({ items: members.map(toApiMember) });
  });
}

export async function membersRemoveRoute(app: FastifyInstance) {
  app.delete('/households/:id/members/:userId', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const { id: householdId, userId } = memberParamsSchema.parse(req.params);
    const callerId = req.user!.id;
    const prisma = getPrisma();

    const household = await prisma.household.findUnique({ where: { id: householdId } });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });

    const target = await prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
    });
    if (!target) throw new AppError({ status: 404, code: ERROR_CODES.MEMBER_NOT_FOUND, title: 'Member not found' });

    if (userId === callerId) {
      // Self-leave: allowed for non-owners only.
      if (target.role === 'owner') {
        throw new AppError({ status: 409, code: ERROR_CODES.HOUSEHOLD_OWNER_CANNOT_LEAVE, title: 'Owner cannot leave; dissolve the household instead' });
      }
    } else {
      // Removing another member: owner-only.
      await assertOwner(householdId, callerId);
    }

    // Cancel the leaving member's pending shared-record reminders for this household,
    // then revert their household records to personal (partial member-remove —
    // imperative null since the FK cannot express "only this one member's records").
    // Both happen inside the locked transaction.
    await prisma.$transaction(async (tx) => {
      await lockHouseholdRow(tx as unknown as ReturnType<typeof getPrisma>, householdId);
      // Cancel this member's reminders before reverting their records.
      await cancelMemberRemindersForHousehold(userId, householdId);

      const reverted = await tx.record.findMany({
        where: { householdId, userId },
        select: { id: true },
      });
      if (reverted.length > 0) {
        await tx.record.updateMany({ where: { householdId, userId }, data: { householdId: null } });
        // Re-schedule single-owner (creator) reminders for each reverted record.
        await reschedulePersonalRecordReminders(reverted.map((r) => r.id));
      }

      await tx.householdMember.delete({ where: { householdId_userId: { householdId, userId } } });
    });

    return reply.status(204).send();
  });
}
