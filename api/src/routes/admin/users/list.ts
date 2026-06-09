import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { adminUsersQuerySchema, adminUsersListSchema, encodeCursor, decodeCursor } from '@pantry/shared';
import { getPrisma } from '../../../db.js';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function adminUsersListRoute(app: FastifyInstance) {
  app.get('/', async (req) => {
    const q = adminUsersQuerySchema.parse(req.query);
    const where: Prisma.UserWhereInput = { id: { not: SYSTEM_USER_ID } };
    if (q.status) where.status = q.status;
    if (q.role) where.role = q.role;
    if (q.country) where.country = q.country;
    if (q.q) {
      where.OR = [
        { email: { contains: q.q, mode: 'insensitive' } },
        { firstName: { contains: q.q, mode: 'insensitive' } },
        { lastName: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const cur = decodeCursor(q.cursor);
    if (cur) {
      const cursorOr = [
        { createdAt: { lt: cur.t } },
        { AND: [{ createdAt: { equals: cur.t } }, { id: { lt: cur.i } }] },
      ];
      where.AND = [{ OR: cursorOr }];
    }
    const rows = await getPrisma().user.findMany({
      where,
      orderBy: [{ [q.sort]: q.order }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const hasMore = rows.length > q.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map((u) => ({
      id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
      country: u.country, role: u.role, status: u.status,
      createdAt: u.createdAt.toISOString(), lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
    }));
    const last = items.at(-1);
    return adminUsersListSchema.parse({
      items, nextCursor: hasMore && last ? encodeCursor(new Date(last.createdAt), last.id) : null,
    });
  });
}
