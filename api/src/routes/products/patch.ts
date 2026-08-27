import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import { productPatchRequestSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { getVisibleProduct } from '../../services/products/product-visibility.js';
import { recordModerationNotificationEvent } from '../../services/notifications/moderation-notification-events.js';

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
    // Creator revisions apply only to active products (a product FK writer this
    // route must close, same as every other one): a bare existence check would
    // let any authenticated caller open a ProductEdit against another user's
    // draft/pending/report_hidden product and turn this endpoint into a
    // 404-vs-202 existence oracle for private rows. `getVisibleProduct`
    // resolves `merged_into` to its canonical row first, same as lookup.
    const product = await getVisibleProduct({ id: req.user!.id, role: req.user!.role }, id);
    if (!product || product.status !== 'active') {
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
        productId: product.id,
        submittedBy: req.user!.id,
        isLegacy: false,
        status: { in: ['draft', 'changes_required'] },
      },
    });
    const submittedAt = new Date();
    if (existingOpenEdit) {
      // Read-then-write race guard: re-assert the row is still in an open state (and
      // still this caller's) at write time, not just at the earlier read. Without this,
      // two concurrent resubmissions could both "succeed" and the second write would
      // silently drop the first proposal; worse, once Phase 4 ships rebase/supersede, a
      // stale resubmit could resurrect an edit an admin just moved out of these states.
      // `updateMany` lets us check `count` instead of trusting the read.
      //
      // Resubmission is a fresh submission, not a continuation: refresh every field a
      // reviewer would expect a new submission to carry. `baseProductVersion` is set to
      // `product.version` — the version this proposal was actually validated against in
      // *this* request — because Phase 4's staleness/rebase decision keys off it; it
      // must never silently drift to "whatever the product happens to be at now" if that
      // ever diverges from what was checked above.
      edit = await prisma.$transaction(async (tx) => {
        const result = await tx.productEdit.updateMany({
          where: {
            id: existingOpenEdit.id,
            submittedBy: req.user!.id,
            status: { in: ['draft', 'changes_required'] },
          },
          data: {
            proposed: input,
            status: 'pending',
            moderationNotes: null,
            submittedAt,
            resolvedBy: null,
            resolvedAt: null,
            baseProductVersion: product.version,
            version: { increment: 1 },
          },
        });
        if (result.count === 0) {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.CONFLICT,
            title: 'An edit is already open for this product',
          });
        }
        await recordModerationNotificationEvent(tx, {
          kind: 'product_revision',
          sourceId: existingOpenEdit.id,
          submissionVersion: existingOpenEdit.version + 1,
          submittedAt,
        });
        return tx.productEdit.findUniqueOrThrow({ where: { id: existingOpenEdit.id } });
      });
    } else {
      try {
        edit = await prisma.$transaction(async (tx) => {
          const created = await tx.productEdit.create({
            data: {
              productId: product.id,
              submittedBy: req.user!.id,
              proposed: input,
              // Every edit created through current application code is subject to the
              // one-open-edit-per-creator/product constraint; `isLegacy` (default `true`
              // at the DB level) exists only to exempt pre-Phase-1 historical rows, never
              // new writes. Omitting this explicit `false` would silently exempt the row
              // from that constraint.
              isLegacy: false,
              status: 'pending',
              submittedAt,
            },
          });
          await recordModerationNotificationEvent(tx, {
            kind: 'product_revision',
            sourceId: created.id,
            submissionVersion: created.version,
            submittedAt,
          });
          return created;
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
      productId: product.id,
    });
  });
}
