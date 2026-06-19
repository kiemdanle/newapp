import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { householdSchema, ERROR_CODES, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiHousehold } from '../../services/households/repository.js';
import { cancelAllRemindersForHousehold, reschedulePersonalRecordReminders } from '../../services/households/household-reminders.js';

const paramsSchema = z.object({ id: z.string().uuid() });

async function lockHouseholdRow(tx: ReturnType<typeof getPrisma>, householdId: string): Promise<void> {
  const idNum = BigInt('0x' + householdId.replace(/-/g, '').slice(0, 16));
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${idNum}::bigint)`;
}

const adminHouseholdsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function adminHouseholdsListRoute(app: FastifyInstance) {
  app.get('/households', async (req) => {
    const q = adminHouseholdsQuerySchema.parse(req.query);
    const cur = decodeCursor(q.cursor);
    const prisma = getPrisma();

    const rows = await prisma.household.findMany({
      where: {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      ...(cur
        ? { cursor: { id: cur.i }, skip: 1 }
        : {}),
      include: {
        _count: { select: { members: true } },
        owner: { select: { firstName: true, email: true } },
      },
    });

    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((h) => ({
      id: h.id,
      name: h.name,
      ownerUserId: h.ownerUserId,
      memberCount: h._count.members,
      ownerFirstName: h.owner.firstName,
      ownerEmail: h.owner.email,
      createdAt: h.createdAt.toISOString(),
      updatedAt: h.updatedAt.toISOString(),
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    };
  });
}

export async function adminHouseholdsDissolveRoute(app: FastifyInstance) {
  app.delete('/households/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();

    const household = await prisma.household.findUnique({ where: { id } });
    if (!household) throw new AppError({ status: 404, code: ERROR_CODES.HOUSEHOLD_NOT_FOUND, title: 'Household not found' });

    // Capture record IDs for post-transaction reminder reschedule.
    const affectedRecordIds = (
      await prisma.record.findMany({ where: { householdId: id }, select: { id: true } })
    ).map((r) => r.id);

    await prisma.$transaction(async (tx) => {
      await lockHouseholdRow(tx as unknown as ReturnType<typeof getPrisma>, id);
      await cancelAllRemindersForHousehold(id);
      // FK onDelete:SetNull reverts all shared records to creator-private.
      await tx.household.delete({ where: { id } });
    });

    // Re-schedule single-owner reminders for reverted records.
    if (affectedRecordIds.length > 0) {
      await reschedulePersonalRecordReminders(affectedRecordIds);
    }

    await req.auditLog('household.dissolved', { type: 'household', id });
    return reply.status(204).send();
  });
}
