import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES, encodeCursor, decodeCursor } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminGiveawaysListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const status = (req.query as Record<string, string>).status ?? undefined;
    const cursor = (req.query as Record<string, string>).cursor ?? undefined;
    const limit = parseInt((req.query as Record<string, string>).limit ?? '50', 10);
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const cur = decodeCursor(cursor);

    const rows = await getPrisma().giveaway.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cur ? { cursor: { id: cur.i }, skip: 1 } : {}),
      include: {
        giver: { select: { firstName: true, email: true } },
        claims: { select: { id: true, status: true } },
        _count: { select: { claims: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((r) => {
      // Find selected claim
      const selected: Record<string, unknown> | undefined = r.claims
        ? (r.claims as { status: string; id: string }[]).find((c) => c.status === 'selected')
        : undefined;
      return {
        id: r.id,
        title: r.title,
        giverName: r.giver.firstName,
        giverEmail: r.giver.email,
        locationText: r.locationText,
        status: r.status,
        claimCount: r._count.claims,
        selectedClaimId: selected?.id ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    };
  });
}

export async function adminGiveawaysCancelRoute(app: FastifyInstance) {
  app.patch('/:id/cancel', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const prisma = getPrisma();
    const before = await prisma.giveaway.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Giveaway not found' });
    if (before.status === 'completed' || before.status === 'cancelled') {
      throw new AppError({ status: 409, code: ERROR_CODES.GIVEAWAY_INVALID_TRANSITION, title: 'Already terminal' });
    }
    await prisma.giveaway.update({ where: { id }, data: { status: 'cancelled' } });
    await req.auditLog('giveaway.cancel', { type: 'giveaway', id }, {
      before: { status: before.status }, after: { status: 'cancelled' },
    });
    return { ok: true };
  });
}
