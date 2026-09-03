import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { householdJoinSchema, householdSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiHousehold } from '../../services/households/repository.js';
import { scheduleNewMemberReminders } from '../../services/households/household-reminders.js';
import { generateUniqueHouseholdInviteCode } from '../../services/households/invite-code.js';
import { assertOwner } from '../../services/households/permissions.js';

const inviteParamsSchema = z.object({
  code: z.string().trim().toUpperCase().min(4).max(12),
});

const householdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const householdInvitePreviewSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerName: z.string(),
  memberCount: z.number().int().nonnegative(),
});

export async function joinHouseholdRoute(app: FastifyInstance) {
  // Preview household by invite code (for deep link confirmation card)
  app.get(
    '/households/invite/:code',
    {
      onRequest: [app.requireAuth],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { code } = inviteParamsSchema.parse(req.params);
      const prisma = getPrisma();

      const household = await prisma.household.findFirst({
        where: { inviteCode: { equals: code, mode: 'insensitive' } },
        include: {
          owner: { select: { firstName: true, email: true } },
          _count: { select: { members: true } },
        },
      });

      if (!household) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.HOUSEHOLD_NOT_FOUND,
          title: 'Invalid or expired invite code',
        });
      }

      return householdInvitePreviewSchema.parse({
        id: household.id,
        name: household.name,
        ownerName: household.owner.firstName || household.owner.email.split('@')[0],
        memberCount: household._count.members,
      });
    },
  );

  // Join household using 6-character invite code
  app.post(
    '/households/join',
    {
      onRequest: [app.requireAuth],
      config: {
        idempotent: 'required',
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const { code } = householdJoinSchema.parse(req.body);
      const userId = req.user!.id;
      const prisma = getPrisma();

      const household = await prisma.household.findFirst({
        where: { inviteCode: { equals: code, mode: 'insensitive' } },
        include: { _count: { select: { members: true } } },
      });

      if (!household) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.HOUSEHOLD_NOT_FOUND,
          title: 'Invalid or expired invite code',
        });
      }

      // Check if already a member
      const existingMembership = await prisma.householdMember.findUnique({
        where: { householdId_userId: { householdId: household.id, userId } },
      });
      if (existingMembership) {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.CONFLICT,
          title: 'You are already a member of this household',
        });
      }

      await prisma.$transaction(async (tx) => {
        const lockKey = BigInt('0x' + household.id.replace(/-/g, '').slice(0, 15));
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;

        await tx.householdMember.create({
          data: {
            householdId: household.id,
            userId,
            role: 'member',
          },
        });

        await scheduleNewMemberReminders(userId, household.id);
      });

      return reply.status(200).send(
        householdSchema.parse(
          toApiHousehold(household, {
            memberCount: household._count.members + 1,
            myRole: 'member',
          }),
        ),
      );
    },
  );

  // Regenerate invite code (owner only)
  app.post(
    '/households/:id/regenerate-invite-code',
    {
      onRequest: [app.requireAuth],
      config: {
        idempotent: 'required',
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (req, reply) => {
      const { id } = householdParamsSchema.parse(req.params);
      const userId = req.user!.id;
      const prisma = getPrisma();

      await assertOwner(id, userId);

      const newCode = await generateUniqueHouseholdInviteCode();
      const updated = await prisma.household.update({
        where: { id },
        data: { inviteCode: newCode },
        include: { _count: { select: { members: true } } },
      });

      return reply.status(200).send(
        householdSchema.parse(
          toApiHousehold(updated, {
            memberCount: updated._count.members,
            myRole: 'owner',
          }),
        ),
      );
    },
  );
}
