import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { productPatchRequestSchema, ERROR_CODES } from '@expyrico/shared';
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
    let edit;
    // The partial unique index guarantees at most one non-legacy open edit
    // (draft|pending|changes_required) per (product, submitter). If the caller's own
    // edit is sitting in draft or changes_required, resubmitting must update it in
    // place and send it back to pending — otherwise the creator can never patch this
    // product again after an admin requests changes (the slot never frees). `pending`
    // is left alone: that edit is genuinely under review and getting a fresh 409 is
    // correct, not a dead end (the admin resolves it, freeing the slot).
    const existingOpenEdit = await prisma.productEdit.findFirst({
      where: {
        productId: id,
        submittedBy: req.user!.id,
        isLegacy: false,
        status: { in: ['draft', 'changes_required'] },
      },
    });
    if (existingOpenEdit) {
      edit = await prisma.productEdit.update({
        where: { id: existingOpenEdit.id },
        data: {
          proposed: input,
          status: 'pending',
          moderationNotes: null,
        },
      });
    } else {
      try {
        edit = await prisma.productEdit.create({
          data: {
            productId: id,
            submittedBy: req.user!.id,
            proposed: input,
            // Every edit created through current application code is subject to the
            // one-open-edit-per-creator/product constraint; `isLegacy` (default `true`
            // at the DB level) exists only to exempt pre-Phase-1 historical rows, never
            // new writes. Omitting this explicit `false` would silently exempt the row
            // from that constraint.
            isLegacy: false,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.CONFLICT,
            title: 'An edit is already open for this product',
          });
        }
        throw err;
      }
    }
    return reply.status(202).send({
      editId: edit.id,
      status: edit.status,
      productId: id,
    });
  });
}
