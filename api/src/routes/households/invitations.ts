import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  householdInvitationCreateSchema,
  ERROR_CODES,
  type HouseholdInvitationPreview,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { assertOwner, assertMember } from '../../services/households/permissions.js';
import { findUserByEmail } from '../../services/users/repository.js';
import {
  sendHouseholdInvitationEmail,
  sendHouseholdJoinedConfirmationEmail,
} from '../../services/households/invitation-email.js';
import { scheduleNewMemberReminders } from '../../services/households/household-reminders.js';
import { notificationSendQueue } from '../../queues/index.js';

function timingSafeTokenEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function lockHouseholdRow(
  tx: Prisma.TransactionClient | PrismaClient,
  householdId: string,
): Promise<void> {
  const hex = householdId.replace(/-/g, '').slice(0, 15);
  const lockKey = parseInt(hex, 16);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
}

const idParamSchema = z.object({ id: z.string().uuid() });
const tokenParamSchema = z.object({ token: z.string().min(10) });
const revokeParamSchema = z.object({
  id: z.string().uuid(),
  invitationId: z.string().uuid(),
});

export async function householdInvitationsRoutes(app: FastifyInstance) {
  // 1. Send an invitation (Owner only)
  app.post('/households/:id/invitations', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id: householdId } = idParamSchema.parse(req.params);
    const { email } = householdInvitationCreateSchema.parse(req.body);
    const userId = req.user!.id;
    const prisma = getPrisma();

    // Assert caller is owner
    await assertOwner(householdId, userId);

    const now = new Date();
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000);

    // Rate Limit 1: Max 10 active pending invitations per household
    const activePendingCount = await prisma.householdInvitation.count({
      where: {
        householdId,
        status: 'pending',
        expiresAt: { gt: now },
      },
    });
    if (activePendingCount >= 10) {
      throw new AppError({
        status: 429,
        code: ERROR_CODES.RATE_LIMITED,
        title: 'Too many active pending invitations for this household (max 10)',
      });
    }

    // Rate Limit 2: Max 5 invitations per household per hour
    const hourlyCount = await prisma.householdInvitation.count({
      where: {
        householdId,
        createdAt: { gt: oneHourAgo },
      },
    });
    if (hourlyCount >= 5) {
      throw new AppError({
        status: 429,
        code: ERROR_CODES.RATE_LIMITED,
        title: 'Invitation rate limit reached for this household (max 5 per hour)',
      });
    }

    // Rate Limit 3: Max 3 invitations per recipient email per 24 hours
    const recipientDailyCount = await prisma.householdInvitation.count({
      where: {
        invitedEmail: email,
        createdAt: { gt: twentyFourHoursAgo },
      },
    });
    if (recipientDailyCount >= 3) {
      throw new AppError({
        status: 429,
        code: ERROR_CODES.RATE_LIMITED,
        title: 'Daily invitation limit reached for this recipient email address',
      });
    }

    // Rate Limit 4: Max 15 invitations per user per day
    const userDailyCount = await prisma.householdInvitation.count({
      where: {
        inviterUserId: userId,
        createdAt: { gt: twentyFourHoursAgo },
      },
    });
    if (userDailyCount >= 15) {
      throw new AppError({
        status: 429,
        code: ERROR_CODES.RATE_LIMITED,
        title: 'Daily invitation limit reached for your account (max 15 per day)',
      });
    }

    // Prevent duplicate pending invite for the same email in the same household
    const existingPending = await prisma.householdInvitation.findFirst({
      where: {
        householdId,
        invitedEmail: email,
        status: 'pending',
        expiresAt: { gt: now },
      },
    });
    if (existingPending) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.CONFLICT,
        title: 'An active invitation already exists for this email address',
      });
    }

    // Generate 256-bit secure token
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    const recipientUser = await findUserByEmail(email);

    const household = await prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      include: {
        _count: { select: { members: true } },
      },
    });

    const inviter = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const invitation = await prisma.householdInvitation.create({
      data: {
        householdId,
        inviterUserId: userId,
        invitedEmail: email,
        invitedUserId: recipientUser?.id ?? null,
        token,
        status: 'pending',
        expiresAt,
      },
    });

    // 1. Channel 3: Email delivery
    void sendHouseholdInvitationEmail({
      to: email,
      inviterName: inviter.firstName,
      householdName: household.name,
      token,
    });

    // 2. Channel 2: Push Notification (if recipient account exists)
    if (recipientUser) {
      void notificationSendQueue().add(
        'send',
        {
          userId: recipientUser.id,
          recordId: householdId,
          offsetDays: 0,
          fireAt: new Date().toISOString(),
          templateKey: 'household_invitation',
          payload: {
            inviterName: inviter.firstName,
            householdName: household.name,
            token,
          },
        },
        { attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
      );
    }

    return reply.status(201).send({
      invitation: {
        id: invitation.id,
        householdId: invitation.householdId,
        inviterUserId: invitation.inviterUserId,
        invitedEmail: invitation.invitedEmail,
        invitedUserId: invitation.invitedUserId,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
        inviterName: inviter.firstName,
        householdName: household.name,
        memberCount: household._count.members,
      },
    });
  });

  // 2. List pending invitations for household (Member only)
  app.get('/households/:id/invitations', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id: householdId } = idParamSchema.parse(req.params);
    const userId = req.user!.id;
    const prisma = getPrisma();

    await assertMember(householdId, userId);

    const items = await prisma.householdInvitation.findMany({
      where: { householdId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: {
        inviterUser: { select: { firstName: true } },
        household: { select: { name: true } },
      },
    });

    return reply.send({
      items: items.map((inv) => ({
        id: inv.id,
        householdId: inv.householdId,
        inviterUserId: inv.inviterUserId,
        invitedEmail: inv.invitedEmail,
        invitedUserId: inv.invitedUserId,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        inviterName: inv.inviterUser?.firstName ?? 'Member',
        householdName: inv.household?.name ?? 'Household',
      })),
    });
  });

  // 3. Revoke invitation (Owner only)
  app.delete(
    '/households/:id/invitations/:invitationId',
    { onRequest: app.requireAuth },
    async (req, reply) => {
      const { id: householdId, invitationId } = revokeParamSchema.parse(req.params);
      const userId = req.user!.id;
      const prisma = getPrisma();

      await assertOwner(householdId, userId);

      const inv = await prisma.householdInvitation.findFirst({
        where: { id: invitationId, householdId },
      });

      if (!inv) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'Invitation not found',
        });
      }

      await prisma.householdInvitation.update({
        where: { id: invitationId },
        data: { status: 'revoked' },
      });

      return reply.status(204).send();
    },
  );

  // 4. Get pending invitations for authenticated user (In-app toast & badge lookup)
  app.get('/households/invitations/mine', { onRequest: app.requireAuth }, async (req, reply) => {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    const now = new Date();

    const items = await prisma.householdInvitation.findMany({
      where: {
        status: 'pending',
        expiresAt: { gt: now },
        OR: [{ invitedEmail: user.email.toLowerCase() }, { invitedUserId: user.id }],
      },
      include: {
        inviterUser: { select: { firstName: true } },
        household: {
          select: {
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({
      items: items.map((inv) => ({
        id: inv.id,
        householdId: inv.householdId,
        inviterUserId: inv.inviterUserId,
        invitedEmail: inv.invitedEmail,
        invitedUserId: inv.invitedUserId,
        token: inv.token,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        inviterName: inv.inviterUser?.firstName ?? 'Member',
        householdName: inv.household?.name ?? 'Household',
        memberCount: inv.household?._count.members ?? 1,
      })),
    });
  });

  // 5. Preview invitation by token (Public or authenticated)
  app.get('/households/invitations/:token', async (req, reply) => {
    const { token } = tokenParamSchema.parse(req.params);
    const prisma = getPrisma();

    const inv = await prisma.householdInvitation.findUnique({
      where: { token },
      include: {
        household: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
        inviterUser: {
          select: {
            firstName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!inv || !timingSafeTokenEquals(inv.token, token)) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Invitation not found or invalid token',
      });
    }

    const preview: HouseholdInvitationPreview = {
      id: inv.id,
      householdId: inv.householdId,
      householdName: inv.household.name,
      inviterName: inv.inviterUser.firstName,
      inviterAvatarUrl: inv.inviterUser.avatarUrl,
      memberCount: inv.household._count.members,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
    };

    return reply.send(preview);
  });

  // 6. Accept invitation (Authenticated)
  app.post(
    '/households/invitations/:token/accept',
    { onRequest: app.requireAuth },
    async (req, reply) => {
      const { token } = tokenParamSchema.parse(req.params);
      const prisma = getPrisma();
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

      const inv = await prisma.householdInvitation.findUnique({
        where: { token },
        include: {
          household: { select: { id: true, name: true } },
        },
      });

      if (!inv || !timingSafeTokenEquals(inv.token, token)) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'Invitation not found or invalid token',
        });
      }

      if (inv.status !== 'pending' || inv.expiresAt.getTime() <= Date.now()) {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Invitation has already expired or been accepted/declined',
        });
      }

      // Verify the signed-in user matches the invited email or user ID
      if (
        inv.invitedEmail.toLowerCase() !== user.email.toLowerCase() &&
        inv.invitedUserId !== user.id
      ) {
        throw new AppError({
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
          title: 'This invitation was sent to a different email address',
        });
      }

      await prisma.$transaction(async (tx) => {
        await lockHouseholdRow(tx, inv.householdId);

        // Add user as member if not already
        const existingMember = await tx.householdMember.findUnique({
          where: {
            householdId_userId: {
              householdId: inv.householdId,
              userId: user.id,
            },
          },
        });

        if (!existingMember) {
          await tx.householdMember.create({
            data: {
              householdId: inv.householdId,
              userId: user.id,
              role: 'member',
            },
          });
        }

        await tx.householdInvitation.update({
          where: { id: inv.id },
          data: {
            status: 'accepted',
            invitedUserId: user.id,
          },
        });
      });

      // Fan out shared records' reminders to the new member
      await scheduleNewMemberReminders(user.id, inv.householdId);

      // Send confirmation email
      void sendHouseholdJoinedConfirmationEmail({
        to: user.email,
        householdName: inv.household.name,
      });

      return reply.send({
        householdId: inv.householdId,
        status: 'accepted',
      });
    },
  );

  // 7. Decline invitation (Authenticated)
  app.post(
    '/households/invitations/:token/decline',
    { onRequest: app.requireAuth },
    async (req, reply) => {
      const { token } = tokenParamSchema.parse(req.params);
      const prisma = getPrisma();
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

      const inv = await prisma.householdInvitation.findUnique({
        where: { token },
      });

      if (!inv || !timingSafeTokenEquals(inv.token, token)) {
        throw new AppError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          title: 'Invitation not found or invalid token',
        });
      }

      if (inv.status !== 'pending') {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.VALIDATION,
          title: 'Invitation is not in pending status',
        });
      }

      if (
        inv.invitedEmail.toLowerCase() !== user.email.toLowerCase() &&
        inv.invitedUserId !== user.id
      ) {
        throw new AppError({
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
          title: 'This invitation was sent to a different email address',
        });
      }

      await prisma.householdInvitation.update({
        where: { id: inv.id },
        data: { status: 'declined' },
      });

      return reply.send({
        status: 'declined',
      });
    },
  );
}
