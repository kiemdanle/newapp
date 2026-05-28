import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { productPatchRequestSchema, ERROR_CODES } from '@pantry/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

const paramSchema = z.object({ id: z.string().uuid() });

export async function patchProductRoute(app: FastifyInstance) {
  app.patch('/:id', { onRequest: app.requireAuth }, async (req, reply) => {
    const { id } = paramSchema.parse(req.params);
    const input = productPatchRequestSchema.parse(req.body);
    if (Object.keys(input).length === 0) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.VALIDATION,
        title: 'Patch payload is empty',
      });
    }
    const prisma = getPrisma();
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new AppError({
        status: 404,
        code: ERROR_CODES.NOT_FOUND,
        title: 'Product not found',
      });
    }
    const edit = await prisma.productEdit.create({
      data: {
        productId: id,
        submittedBy: req.user!.id,
        proposed: input,
      },
    });
    return reply.status(202).send({
      editId: edit.id,
      status: edit.status,
      productId: id,
    });
  });
}
