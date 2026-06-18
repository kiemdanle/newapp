import type { FastifyInstance } from 'fastify';
import { reportCreateSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiReport, maybeAutoHide } from '../../services/reports/repository.js';

async function targetExists(type: string, id: string): Promise<boolean> {
  const prisma = getPrisma();
  if (type === 'review') return (await prisma.review.findUnique({ where: { id } })) !== null;
  if (type === 'product') return (await prisma.product.findUnique({ where: { id } })) !== null;
  if (type === 'user') return (await prisma.user.findUnique({ where: { id } })) !== null;
  if (type === 'deal') return (await prisma.deal.findUnique({ where: { id } })) !== null;
  return false;
}

export async function createReportRoute(app: FastifyInstance) {
  app.post('/reports', { onRequest: [app.requireAuth] }, async (req, reply) => {
    const input = reportCreateSchema.parse(req.body);
    const userId = req.user!.id;
    const exists = await targetExists(input.targetType, input.targetId);
    if (!exists) {
      throw new AppError({ status: 404, code: ERROR_CODES.REPORT_TARGET_NOT_FOUND, title: 'Report target not found' });
    }
    const report = await getPrisma().report.create({
      data: {
        reporterId: userId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        body: input.body ?? null,
      },
    });
    await maybeAutoHide(input.targetType, input.targetId);
    return reply.status(201).send(toApiReport(report));
  });
}
