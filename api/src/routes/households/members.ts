import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { householdMemberAddSchema, householdMembersResponseSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertOwner, assertMember } from '../../services/households/permissions.js';
import { toApiMember } from '../../services/households/repository.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const memberParamsSchema = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

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
    try {
      const member = await prisma.householdMember.create({
        data: { householdId, userId, role: 'member' },
        include: { user: { select: { id: true, firstName: true, avatarUrl: true } } },
      });
      return reply.status(201).send(toApiMember(member));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError({ status: 409, code: ERROR_CODES.CONFLICT, title: 'Already a member' });
      }
      throw err;
    }
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
      // Self-leave: allowed for non-owners only
      if (target.role === 'owner') {
        throw new AppError({ status: 409, code: ERROR_CODES.HOUSEHOLD_OWNER_CANNOT_LEAVE, title: 'Owner cannot leave; dissolve the household instead' });
      }
    } else {
      // Removing another member: owner-only
      await assertOwner(householdId, callerId);
    }
    // Revert removed member's household records to creator-private (partial remove).
    await prisma.$transaction(async (tx) => {
      await tx.record.updateMany({ where: { householdId, userId }, data: { householdId: null } });
      await tx.householdMember.delete({ where: { householdId_userId: { householdId, userId } } });
    });
    return reply.status(204).send();
  });
}
