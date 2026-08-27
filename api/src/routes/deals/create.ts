import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, dealCreateSchema, DEAL_PHOTO_CDN_HOST, getCountryMetadata } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiDeal } from '../../services/deals/repository.js';
import { assertProductUse } from '../../services/products/product-visibility.js';

const DEFAULT_CURRENCY = 'USD';

function assertCdnHost(url: string | undefined): void {
  if (!url) return;
  try {
    const parsed = new URL(url);
    const validHost =
      parsed.host === DEAL_PHOTO_CDN_HOST ||
      parsed.host.endsWith('.expyrico.app') ||
      parsed.host.endsWith('.expyrico.test') ||
      parsed.host.includes('linhkienkts.com') ||
      parsed.host.includes('localhost') ||
      parsed.host.includes('127.0.0.1');
    if (!validHost) {
      throw new Error();
    }
  } catch {
    throw new AppError({
      status: 400,
      code: ERROR_CODES.VALIDATION,
      title: 'photoUrl must be hosted securely on the app CDN or media server',
    });
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

      await assertProductUse(userId, input.productId, { purpose: 'deal' });

      const poster = await prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
      const country = poster?.country ?? null;
      const countryMeta = getCountryMetadata(country);
      const currency = input.currency ?? countryMeta.currencyCode ?? DEFAULT_CURRENCY;
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
