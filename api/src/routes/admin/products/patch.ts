import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminProductPatchSchema, adminProductRowSchema, ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { AppError } from '../../../errors.js';
import { writeAuditLog } from '../../../services/audit/log.js';
import { PRODUCT_INCLUDE } from '../../../services/products/product-visibility.js';
import { toApiProductPhoto } from '../../../services/products/serializer.js';

const paramsSchema = z.object({ id: z.string().uuid() });

// This route must never be a moderation bypass. `active <-> report_hidden` is
// a pure catalog-visibility toggle with no publication side effects, so it's the
// only status transition this direct-correction endpoint may perform. Every
// other transition (activating a `pending` submission, clearing `merged_into`,
// touching `draft`/`changes_required`) has real invariants — capacity/outbox
// publication, audit action semantics, `mergedIntoProductId` consistency — that
// only `moderateProduct`/`resolveProductEdit`/`mergeProducts` uphold.
const ALLOWED_DIRECT_STATUS_TRANSITIONS: Record<string, string[]> = {
  active: ['report_hidden'],
  report_hidden: ['active'],
};

/**
 * Direct admin field correction. Version-guarded like every other Phase 4 write
 * (stale writes get a typed `version_conflict`, never a blind overwrite), and the
 * version bump is intentional: it makes any pending revision's `baseProductVersion`
 * stale, so a pending edit can never silently overwrite this correction on later
 * approval — the admin must rebase/supersede it first. State/audit commit in one
 * transaction.
 */
export async function adminProductsPatchRoute(app: FastifyInstance) {
  app.patch('/:id', async (req) => {
    const { id } = paramsSchema.parse(req.params);
    const input = adminProductPatchSchema.parse(req.body);
    const prisma = getPrisma();
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });

    if (input.status !== undefined && input.status !== before.status) {
      const allowed = ALLOWED_DIRECT_STATUS_TRANSITIONS[before.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw new AppError({
          status: 409,
          code: ERROR_CODES.CONFLICT,
          title: `Cannot set status directly from ${before.status} to ${input.status}; use the moderation or merge endpoints instead`,
        });
      }
    }

    const after = await prisma.$transaction(async (tx) => {
      const result = await tx.product.updateMany({
        where: { id, version: input.version },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.brand !== undefined ? { brand: input.brand } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.defaultShelfLifeDays !== undefined ? { defaultShelfLifeDays: input.defaultShelfLifeDays } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const current = await tx.product.findUnique({ where: { id }, select: { version: true } });
        throw new AppError({
          status: 409,
          code: ERROR_CODES.VERSION_CONFLICT,
          title: 'This product was changed since you last loaded it',
          currentVersion: current?.version ?? before.version,
        });
      }

      const beforeDiff: Record<string, unknown> = {};
      const afterDiffKeys = Object.keys(input).filter((k) => k !== 'version') as (keyof typeof input)[];
      const updated = await tx.product.findUniqueOrThrow({ where: { id }, include: PRODUCT_INCLUDE });
      const afterDiff: Record<string, unknown> = {};
      for (const k of afterDiffKeys) {
        beforeDiff[k] = (before as Record<string, unknown>)[k];
        afterDiff[k] = (updated as Record<string, unknown>)[k];
      }
      await writeAuditLog(
        {
          adminId: req.user!.id,
          action: 'product.update',
          targetType: 'product',
          targetId: id,
          diff: { before: beforeDiff, after: afterDiff },
          requestId: (req.headers['x-request-id'] as string) ?? req.id,
          ip: req.ip,
        },
        tx,
      );
      return updated;
    });

    return adminProductRowSchema.parse({
      id: after.id, barcode: after.barcode, qrPayload: after.qrPayload, name: after.name,
      description: after.description, brand: after.brand, category: after.category, imageUrl: after.imageUrl,
      defaultShelfLifeDays: after.defaultShelfLifeDays, source: after.source, status: after.status, version: after.version,
      mergedIntoProductId: after.mergedIntoProductId, isCommunityEligible: after.isCommunityEligible,
      buyAgainCount: after.buyAgainCount, buyAgainOnSaleCount: after.buyAgainOnSaleCount,
      wontBuyCount: after.wontBuyCount, ratingCount: after.ratingCount, reviewCount: after.reviewCount,
      photos: [...after.photos].sort((a, b) => a.position - b.position).map((photo) => toApiProductPhoto(photo, after.id)),
      moderationNotes: after.moderationNotes,
      moderatedAt: after.moderatedAt ? after.moderatedAt.toISOString() : null,
      createdAt: after.createdAt.toISOString(), updatedAt: after.updatedAt.toISOString(),
    });
  });
}
