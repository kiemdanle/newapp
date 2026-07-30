import type { Product, Prisma, PrismaClient } from '@prisma/client';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

export interface ProductActor {
  id: string;
  role: 'user' | 'admin';
}

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * General read gate for a single product by ID. Admins (moderation tooling) see
 * every status. Ordinary callers see active products, plus their own
 * draft/pending/changes_required rows. Everything else (another user's private
 * row, report_hidden, merged_into) is null — callers must treat that as "not
 * found", never leaking existence/state.
 */
export async function getVisibleProduct(
  actor: ProductActor,
  productId: string,
  client: Db = getPrisma(),
): Promise<Product | null> {
  const product = await client.product.findUnique({ where: { id: productId } });
  if (!product) return null;
  if (actor.role === 'admin') return product;
  if (product.status === 'active') return product;
  if (
    product.createdByUserId === actor.id &&
    (product.status === 'draft' || product.status === 'pending' || product.status === 'changes_required')
  ) {
    return product;
  }
  return null;
}

export type ProductUsePurpose = 'personal_record' | 'household_record' | 'review' | 'deal' | 'giveaway';

export interface ProductUseContext {
  purpose: ProductUsePurpose;
  /** True only when this is preserving an already-established own personal
   * reference (e.g. record PATCH not changing scope, duplicate of an existing
   * personal record, sync upsert whose stored productId is unchanged) rather than
   * newly attaching the product. */
  existingRecordReference?: boolean;
}

function notFound(): never {
  throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
}

function forbidden(title: string): never {
  throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title });
}

/**
 * Central authorization for every place a product ID gets attached to
 * household/community content: personal/household records, record PATCH scope
 * transitions, record duplication, offline sync upserts, reviews, deals, and
 * giveaways. Throws rather than returning a boolean so every call site fails
 * closed by construction.
 *
 * Policy:
 * - active: always allowed, for any purpose, any caller.
 * - draft: never allowed, for anyone (including the creator — a draft is not yet
 *   submitted, so there is nothing to attach).
 * - pending (creator-submitted, awaiting review): allowed only for the creator's
 *   own personal_record use.
 * - changes_required: allowed only for the creator's own personal_record use, and
 *   only when `existingRecordReference` is true — an already-established personal
 *   reference may remain, but a changes_required product can't be newly attached
 *   or moved into a household.
 * - report_hidden / merged_into: never allowed (catalog moderation states, not
 *   creator-private states).
 * - Any non-active row accessed by someone other than its creator: 404, never
 *   revealing that the product exists in some other state.
 */
export async function assertProductUse(
  actorId: string,
  productId: string,
  context: ProductUseContext,
  client: Db = getPrisma(),
): Promise<void> {
  const product = await client.product.findUnique({ where: { id: productId } });
  if (!product) notFound();
  if (product.status === 'active') return;

  const isCreator = product.createdByUserId === actorId;
  if (!isCreator) notFound();

  if (product.status === 'draft') {
    forbidden('This product has not been submitted yet');
  }
  if (product.status === 'pending') {
    if (context.purpose === 'personal_record') return;
    forbidden('This product is awaiting review and can only be used in your personal pantry');
  }
  if (product.status === 'changes_required') {
    if (context.purpose === 'personal_record' && context.existingRecordReference === true) return;
    forbidden('This product needs changes before it can be used');
  }
  // report_hidden, merged_into, or any other non-active status.
  notFound();
}
