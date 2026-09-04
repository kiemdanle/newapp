import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import {
  userPreferencesPatchSchema,
  type UserUiPreferences,
} from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { assertMember } from '../../services/households/permissions.js';

export async function preferencesRoute(app: FastifyInstance) {
  app.get('/preferences', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const user = await getPrisma().user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { notificationPreferences: true, uiPreferences: true },
    });

    return reply.send({
      notificationPreferences: (user.notificationPreferences as Record<string, unknown>) ?? null,
      uiPreferences: (user.uiPreferences as UserUiPreferences) ?? null,
    });
  });

  app.patch('/preferences', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const input = userPreferencesPatchSchema.parse(req.body);
    const userId = req.user!.id;
    const prisma = getPrisma();

    // If defaultHouseholdId is supplied, verify caller belongs to that household
    if (input.uiPreferences?.defaultHouseholdId) {
      await assertMember(input.uiPreferences.defaultHouseholdId, userId);
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notificationPreferences: true, uiPreferences: true },
    });

    const currentUi = (user.uiPreferences as Record<string, unknown>) || {};
    const mergedUi = input.uiPreferences
      ? { ...currentUi, ...input.uiPreferences }
      : currentUi;

    const currentNotif = (user.notificationPreferences as Record<string, unknown>) || {};
    const mergedNotif = input.notificationPreferences
      ? { ...currentNotif, ...input.notificationPreferences }
      : currentNotif;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.uiPreferences !== undefined
          ? { uiPreferences: mergedUi as Prisma.InputJsonValue }
          : {}),
        ...(input.notificationPreferences !== undefined
          ? { notificationPreferences: mergedNotif as Prisma.InputJsonValue }
          : {}),
      },
      select: { notificationPreferences: true, uiPreferences: true },
    });

    return reply.send({
      notificationPreferences: (updated.notificationPreferences as Record<string, unknown>) ?? null,
      uiPreferences: (updated.uiPreferences as UserUiPreferences) ?? null,
    });
  });
}
