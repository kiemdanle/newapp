import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, dealCreateSchema, DEAL_PHOTO_CDN_HOST } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiDeal } from '../../services/deals/repository.js';

const DEFAULT_CURRENCY = 'USD';

function assertCdnHost(url: string | undefined): void {
  if (!url) return;
  let host: string;
  try { host = new URL(url).host; } catch {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'Invalid photoUrl' });
  }
  if (host !== DEAL_PHOTO_CDN_HOST) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, title: 'photoUrl must be on the app CDN' });
  }
}

export async function createDealRoute(app: FastifyInstance) {
  app.post(
    '/deals',
    {
      onRequest: [app.requireAuth],
      config: { idempotent: 'required', rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const input = dealCreateSchema.parse(req.body);
      assertCdnHost(input.photoUrl);
      const prisma = getPrisma();
      const userId = req.user!.id;

      const product = await prisma.product.findUnique({ where: { id: input.productId } });
      if (!product) {
        throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
      }

      const currency = input.currency ?? DEFAULT_CURRENCY;
      const poster = await prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
      const country = poster?.country ?? null;

      const created = await prisma.deal.create({
        data: {
          userId,
          productId: input.productId,
          price: input.price,
          currency,
          country,
          storeName: input.storeName,
          photoUrl: input.photoUrl ?? null,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          note: input.note ?? null,
        },
        include: {
          product: { select: { id: true, name: true, brand: true, imageUrl: true } },
          user: { select: { id: true, firstName: true, avatarUrl: true } },
        },
      });

      return reply.status(201).send(toApiDeal(created, { myVote: null }));
    },
  );
}
