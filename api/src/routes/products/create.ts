import type { FastifyInstance } from 'fastify';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { productCreateRequestSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { toApiProduct } from '../../services/products/serializer.js';

export async function createProductRoute(app: FastifyInstance) {
  app.post('/', { onRequest: app.requireAuth }, async (req, reply) => {
    const input = productCreateRequestSchema.parse(req.body);
    try {
      const product = await getPrisma().product.create({
        data: {
          barcode: input.barcode ?? null,
          qrPayload: input.qrPayload ?? null,
          name: input.name,
          brand: input.brand ?? null,
          category: input.category ?? null,
          imageUrl: input.imageUrl ?? null,
          defaultShelfLifeDays: input.defaultShelfLifeDays ?? null,
          source: 'user',
          sourceId: null,
          createdByUserId: req.user!.id,
        },
      });
      return reply.status(201).send(toApiProduct(product));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.CONFLICT,
          title: 'Product already exists for that barcode or QR payload',
        });
      }
      throw err;
    }
  });
}
