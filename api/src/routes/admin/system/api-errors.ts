import type { FastifyInstance } from 'fastify';
import { apiErrorsQuerySchema, apiErrorsAggSchema } from '@pantry/shared';
import { getPrisma } from '../../../db.js';

function sinceFor(range: '24h' | '7d' | '30d'): Date {
  const h = range === '24h' ? 24 : range === '7d' ? 168 : 720;
  return new Date(Date.now() - h * 3600_000);
}

export async function adminSystemApiErrorsRoute(app: FastifyInstance) {
  app.get('/api-errors', async (req) => {
    const { range } = apiErrorsQuerySchema.parse(req.query);
    const since = sinceFor(range);
    const rows = await getPrisma().$queryRaw<{ route: string; method: string; status: number; count: bigint }[]>`
      SELECT route, method, status, COUNT(*)::bigint as count
      FROM api_errors
      WHERE "createdAt" >= ${since}
      GROUP BY route, method, status
      ORDER BY count DESC
      LIMIT 200
    `;
    return apiErrorsAggSchema.parse({
      range,
      rows: rows.map((r) => ({ route: r.route, method: r.method, status: r.status, count: Number(r.count) })),
    });
  });
}
