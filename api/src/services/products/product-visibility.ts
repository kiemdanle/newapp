import type { Product, Prisma, PrismaClient } from '@prisma/client';
import { ERROR_CODES } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

export interface ProductActor {
  id: string;
  role: 'user' | 'admin';
}

type Db = PrismaClient | Prisma.TransactionClient;

// A merge chain should never be more than a couple of hops in practice; the cap
// exists purely so a corrupted/cyclical mergedIntoProductId can never hang a
// request or recurse forever.
const MAX_MERGE_DEPTH = 5;

export const PRODUCT_INCLUDE = { photos: { orderBy: { position: 'asc' as const } } };
export type ProductWithPhotos = Product & { photos: Prisma.ProductPhotoGetPayload<object>[] };

/**
 * Follows `mergedIntoProductId` to its terminal row (or gives up at
 * `MAX_MERGE_DEPTH` / a dangling pointer and returns the last resolvable row,
 * which may still be `merged_into`). Every visibility/use decision for a merged
 * product is then made against the canonical row, not the merged-away one — a
 * merge just changes which row answers, it never invents new access.
 */
export async function resolveCanonicalProduct(product: ProductWithPhotos, client: Db): Promise<ProductWithPhotos> {
  let current = product;
  let depth = 0;
  while (current.status === 'merged_into' && current.mergedIntoProductId && depth < MAX_MERGE_DEPTH) {
    const next = await client.product.findUnique({
      where: { id: current.mergedIntoProductId },
      include: PRODUCT_INCLUDE,
    });
    if (!next) break;
    current = next;
    depth += 1;
  }
  return current;
}

/**
 * General read gate for a single product by ID. Admins (moderation tooling) see
 * every status. Ordinary callers see active products, plus their own
 * draft/pending/changes_required rows. `merged_into` resolves to its canonical
 * product first (classified by the same rules). Everything else (another
 * user's private row, report_hidden, an unresolved merge) is null — callers
 * must treat that as "not found", never leaking existence/state.
 */
export async function getVisibleProduct(
  actor: ProductActor,
  productId: string,
  client: Db = getPrisma(),
): Promise<Product | null> {
  let product = await client.product.findUnique({ where: { id: productId }, include: PRODUCT_INCLUDE });
  if (!product) return null;
  if (product.status === 'merged_into') {
    product = await resolveCanonicalProduct(product, client);
  }
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
  /** True only when this is preserving an already-established reference (e.g.
   * record PATCH not changing scope, duplicate of an existing personal record,
   * sync upsert whose stored productId is unchanged) rather than newly
   * attaching the product. */
  existingRecordReference?: boolean;
}

/**
 * Thrown by `assertProductUse` specifically — callers that need to distinguish
 * "this product can't be used this way" from any other 403/404 (notably the
 * offline sync loop, which must surface this as a per-item conflict rather
 * than treat it as an unrelated authorization failure) should match on this
 * class, not on status codes alone.
 */
export class ProductUseRejectionError extends AppError {}

function notFound(): never {
  throw new ProductUseRejectionError({ status: 404, code: ERROR_CODES.NOT_FOUND, title: 'Product not found' });
}

function forbidden(title: string): never {
  throw new ProductUseRejectionError({ status: 403, code: ERROR_CODES.FORBIDDEN, title });
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
 * - merged_into: resolved to its canonical row first, then this same policy is
 *   applied to the canonical row (a merge changes which row answers, not what
 *   is allowed). An unresolved merge (dangling pointer / depth cap) is treated
 *   as not found.
 * - report_hidden: a previously-active catalog product that reports hid. An
 *   already-established reference (personal or household) may remain in use —
 *   the gate exists to stop *discovery* and *new* attachment/community use of
 *   hidden content, never to freeze a user's existing pantry data. A brand-new
 *   attachment or any review/deal/giveaway is rejected regardless of creator.
 * - draft: never allowed, for anyone (including the creator — a draft is not
 *   yet submitted, so there is nothing to attach).
 * - pending (creator-submitted, awaiting review): allowed only for the
 *   creator's own personal_record use.
 * - changes_required: allowed only for the creator's own personal_record use,
 *   and only when `existingRecordReference` is true — an already-established
 *   personal reference may remain, but a changes_required product can't be
 *   newly attached or moved into a household.
 * - Any non-active row accessed by someone other than its creator (outside the
 *   report_hidden preserved-reference case above): 404, never revealing that
 *   the product exists in some other state.
 */
export async function assertProductUse(
  actorId: string,
  productId: string,
  context: ProductUseContext,
  client: Db = getPrisma(),
): Promise<void> {
  // `SELECT ... FOR UPDATE` before the read: when this call happens inside a
  // caller's `$transaction` (record PATCH, offline sync), this genuinely locks
  // the row for the transaction's duration, so a concurrent moderation write
  // can't change the product's state between this check and the caller's
  // subsequent record write. Outside an explicit transaction it's a harmless
  // single-statement lock (Postgres auto-commits it immediately).
  await client.$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
  let product = await client.product.findUnique({ where: { id: productId }, include: PRODUCT_INCLUDE });
  if (!product) notFound();
  if (product.status === 'merged_into') {
    product = await resolveCanonicalProduct(product, client);
  }
  if (product.status === 'active') return;

  if (product.status === 'report_hidden') {
    const preservedUse = context.purpose === 'personal_record' || context.purpose === 'household_record';
    if (context.existingRecordReference === true && preservedUse) return;
    notFound();
  }

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
  // merged_into left unresolved (dangling/depth-capped), or any other status.
  notFound();
}
