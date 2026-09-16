import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductDeleteQuerySchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { writeAuditLog } from '../../../services/audit/log.js';
import { withMediaMutationLease } from '../../../services/products/product-media-coordinator.js';
import { enqueueMediaCleanup } from '../../../services/products/product-media-outbox.js';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function adminProductsDeleteRoute(app: FastifyInstance) {
  app.delete('/:id', async (req, reply) => {
    const { id } = paramsSchema.parse(req.params);
    const { version } = adminProductDeleteQuerySchema.parse(req.query);

    await withMediaMutationLease('enqueue_cleanup', async () => {
      await getPrisma().$transaction(async (tx) => {
        // 1. Lock target product row
        await tx.$executeRaw`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`;

        // 2. Read target product, throw 404 if not found
        const product = await tx.product.findUnique({
          where: { id },
          include: {
            photos: true,
          },
        });
        if (!product) {
          throw new AppError({
            status: 404,
            code: ERROR_CODES.NOT_FOUND,
            title: 'Product not found',
          });
        }

        // 3. Optimistic Concurrency Guard
        if (product.version !== version) {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.VERSION_CONFLICT,
            title: 'The product was modified by another user; please refresh and try again',
            currentVersion: product.version,
          });
        }

        // Guard: do not allow deleting an already-merged product row
        if (product.status === 'merged_into') {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.CONFLICT,
            title: 'Cannot delete an already-merged product; merged products preserve catalog redirect history.',
          });
        }
        // 4. Inbound Alias & Deep Usage Guard
        const recordCount = await tx.record.count({
          where: {
            OR: [{ productId: id }, { product: { mergedIntoProductId: id } }],
          },
        });
        const inboundAliases = await tx.product.count({
          where: { mergedIntoProductId: id },
        });

        if (recordCount > 0 || inboundAliases > 0) {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.PRODUCT_HAS_PANTRY_ITEMS,
            title: 'Cannot delete product in use',
            detail: `Cannot delete product: used by ${recordCount} pantry items (or has ${inboundAliases} merged aliases). Use merge instead.`,
            pantryItemCount: recordCount,
          });
        }

        // 5. Open Revision Guard
        const openEdits = await tx.productEdit.count({
          where: {
            productId: id,
            isLegacy: false,
            status: { in: ['draft', 'pending', 'changes_required'] },
          },
        });
        if (openEdits > 0) {
          throw new AppError({
            status: 409,
            code: ERROR_CODES.CONFLICT,
            title: 'An open revision exists on this product; resolve or reject it before deleting.',
          });
        }

        // 6. Safe Cascades & Cleanups
        // 6a. Detach any referencing giveaways
        const giveawayUpdateResult = await tx.giveaway.updateMany({
          where: { productId: id },
          data: { productId: null },
        });

        // 6b. Collect reviews & deals IDs for reports cleanup and audit diff
        const [reviews, deals] = await Promise.all([
          tx.review.findMany({ where: { productId: id }, select: { id: true } }),
          tx.deal.findMany({ where: { productId: id }, select: { id: true } }),
        ]);
        const reviewIds = reviews.map((r) => r.id);
        const dealIds = deals.map((d) => d.id);

        // 6c. Dismiss open polymorphic reports targeting this product, reviews, or deals
        await tx.report.updateMany({
          where: {
            status: 'open',
            OR: [
              { targetType: 'product', targetId: id },
              ...(reviewIds.length > 0 ? [{ targetType: 'review' as const, targetId: { in: reviewIds } }] : []),
              ...(dealIds.length > 0 ? [{ targetType: 'deal' as const, targetId: { in: dealIds } }] : []),
            ],
          },
          data: {
            status: 'dismissed',
            resolvedByAdminId: req.user!.id,
            resolvedAt: new Date(),
          },
        });

        // 6d. Query and collect media storage keys (live + staged)
        const privateKeys: string[] = [];
        const publicKeys: string[] = [];
        for (const photo of product.photos) {
          if (photo.privateStorageKey) privateKeys.push(photo.privateStorageKey);
          if (photo.publicStorageKey) publicKeys.push(photo.publicStorageKey);
        }

        const stagedPhotos = await tx.productEditPhoto.findMany({
          where: { productEdit: { productId: id } },
          select: { privateStorageKey: true },
        });
        for (const sp of stagedPhotos) {
          if (sp.privateStorageKey) privateKeys.push(sp.privateStorageKey);
        }

        if (privateKeys.length > 0) {
          await enqueueMediaCleanup(tx, { operation: 'delete_private', keys: privateKeys });
        }
        if (publicKeys.length > 0) {
          await enqueueMediaCleanup(tx, { operation: 'delete_public', keys: publicKeys });
        }

        // 6e. Delete product_edit_photos first to prevent Restrict constraint on sourceProductPhotoId
        await tx.productEditPhoto.deleteMany({
          where: { productEdit: { productId: id } },
        });

        // 6f. Delete product row (cascades product_photos, product_edits, reviews, deals)
        await tx.product.delete({
          where: { id },
        });

        // 6g. Record comprehensive audit log
        await writeAuditLog(
          {
            adminId: req.user!.id,
            action: 'product.delete',
            targetType: 'product',
            targetId: id,
            diff: {
              before: {
                id: product.id,
                name: product.name,
                brand: product.brand,
                barcode: product.barcode,
                status: product.status,
                version: product.version,
              },
              after: null,
              detachedGiveaways: giveawayUpdateResult.count,
              deletedReviews: reviews.length,
              deletedDeals: deals.length,
            },
            requestId: req.id,
            ip: req.ip,
          },
          tx,
        );
      });
    });

    return reply.status(204).send();
  });
}
