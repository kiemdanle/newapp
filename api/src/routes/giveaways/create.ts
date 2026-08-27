import type { FastifyInstance } from 'fastify';
import { giveawayCreateSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiGiveaway } from '../../services/giveaways/repository.js';
import { assertProductUse } from '../../services/products/product-visibility.js';
import { assertCanWriteRecord } from '../../services/households/permissions.js';
export async function createGiveawayRoute(app: FastifyInstance) {
  app.post(
    '/giveaways',
    { onRequest: [app.requireAuth], config: { idempotent: 'required', rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const input = giveawayCreateSchema.parse(req.body);
      const prisma = getPrisma();
      const userId = req.user!.id;

      let inheritedProductId: string | null = input.productId ?? null;
      let inheritedExpiryDate: string | null = input.expiryDate ?? null;

      if (input.recordId) {
        const record = await prisma.record.findUnique({ where: { id: input.recordId } });
        if (!record) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Record not found' });
        await assertCanWriteRecord(record, userId);

        if (input.quantity > Number(record.quantity)) {
          throw new AppError({
            status: 400,
            code: ERROR_CODES.VALIDATION,
            title: 'Giveaway quantity exceeds available pantry stock',
          });
        }

        if (!inheritedProductId && record.productId) {
          inheritedProductId = record.productId;
        }
        if (!inheritedExpiryDate && record.expiryDate) {
          inheritedExpiryDate =
            record.expiryDate instanceof Date
              ? record.expiryDate.toISOString().slice(0, 10)
              : String(record.expiryDate).slice(0, 10);
        }
      }
      if (inheritedProductId) {
        await assertProductUse(userId, inheritedProductId, { purpose: 'giveaway' });
      }
      const giver = await prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
      const country = giver?.country ?? null;

      let storedPhotoUrl: string | null = null;
      if (input.photoUrls && input.photoUrls.length > 0) {
        storedPhotoUrl = input.photoUrls.length > 1 ? JSON.stringify(input.photoUrls) : (input.photoUrls[0] ?? null);
      } else if (input.photoUrl) {
        storedPhotoUrl = input.photoUrl;
      }

      let claimExpiresAt: Date | null = null;
      if (input.claimExpiresAt) {
        claimExpiresAt = new Date(
          input.claimExpiresAt.includes('T') ? input.claimExpiresAt : `${input.claimExpiresAt}T23:59:59Z`,
        );
      }

      const created = await prisma.giveaway.create({
        data: {
          giverUserId: userId,
          title: input.title,
          description: input.description ?? null,
          locationText: input.locationText,
          photoUrl: storedPhotoUrl,
          quantity: input.quantity ?? 1,
          unit: input.unit ?? 'pcs',
          expiryDate: inheritedExpiryDate,
          claimExpiresAt,
          productId: inheritedProductId,
          recordId: input.recordId ?? null,
          country,
        },
        include: {
          giver: { select: { id: true, firstName: true, avatarUrl: true, giverRatingAvg: true, transactionCount: true } },
          claims: true,
          _count: { select: { claims: true } },
        },
      });
      return reply.status(201).send(toApiGiveaway(created, { myClaim: null }));
    },
  );
}
