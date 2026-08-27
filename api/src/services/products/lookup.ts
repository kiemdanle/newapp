import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import type { ProductLookupV2Response } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { lookupOff } from './off-client.js';
import { lookupUpcitemdb } from './upcitemdb-client.js';
import type { ExternalProductData } from './mappers.js';
import { toApiProduct } from './serializer.js';
import {
  resolveCanonicalProduct,
  PRODUCT_INCLUDE,
  type ProductWithPhotos,
} from './product-visibility.js';
import { isProductCreationEligible } from './product-creation-eligibility.js';

export interface LookupInput {
  barcode?: string;
  qr?: string;
}

export interface LookupActor {
  id: string;
  role: 'user' | 'admin';
}

async function findLocalExact(input: LookupInput): Promise<ProductWithPhotos | null> {
  const prisma = getPrisma();
  if (input.barcode) {
    const raw = input.barcode.trim();
    const candidates = [raw];
    if (raw.length === 12) {
      candidates.push(`0${raw}`);
    } else if (raw.length === 13 && raw.startsWith('0')) {
      candidates.push(raw.slice(1));
    }
    const row = await prisma.product.findFirst({
      where: { barcode: { in: candidates } },
      include: PRODUCT_INCLUDE,
    });
    if (row) return row;
  }
  if (input.qr) {
    const row = await prisma.product.findUnique({ where: { qrPayload: input.qr }, include: PRODUCT_INCLUDE });
    if (row) return row;
  }
  return null;
}

/**
 * True when `input` already resolves to *some* local row, regardless of what
 * it classifies to for `actor` — a pure DB existence check that never calls
 * an external provider. `lookupProductV2`'s `not_found` outcome (the only one
 * that can lead to `createOrResumeDraft` actually creating a new row) is only
 * ever reached when this is `false`, so callers can use it to decide whether
 * the create-mode gate needs to run *before* paying for the external lookup
 * round trip, without duplicating `classifyLocal`'s classification logic or
 * changing `lookupProductV2`'s own behaviour (which must keep running the
 * full external lookup unconditionally for its read-only capability-flag
 * response).
 */
export async function hasLocalMatch(input: LookupInput): Promise<boolean> {
  return (await findLocalExact(input)) !== null;
}

// Re-reads on conflict inside a transaction and never overwrites a user-sourced or
// non-active (private/moderation) row — an external hit can only ever create a new
// row or refresh an existing active external one. Exported for a focused race-safety
// unit test; not part of the public service surface used by routes. Callers MUST
// treat the returned row as potentially non-active (see the guard above) — never
// assume "just persisted" implies "safe to serialize as a public hit".
export async function persistExternal(data: ExternalProductData): Promise<ProductWithPhotos> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      // Lock any existing row for this barcode before deciding whether to
      // refresh it: without this, the guarded read and the subsequent update
      // are two separate statements and a concurrent status/source change
      // (report auto-hide, admin correction) could land in between them.
      await tx.$executeRaw`SELECT id FROM products WHERE barcode = ${data.barcode} FOR UPDATE`;
      const existing = await tx.product.findUnique({ where: { barcode: data.barcode }, include: PRODUCT_INCLUDE });
      if (existing) {
        if (existing.source === 'user' || existing.status !== 'active') return existing;
        return tx.product.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            brand: data.brand,
            category: data.category,
            imageUrl: data.imageUrl,
          },
          include: PRODUCT_INCLUDE,
        });
      }
      return tx.product.create({
        data: {
          barcode: data.barcode,
          name: data.name,
          brand: data.brand,
          category: data.category,
          imageUrl: data.imageUrl,
          source: data.source,
          sourceId: data.sourceId,
        },
        include: PRODUCT_INCLUDE,
      });
    });
  } catch (err) {
    // A concurrent create for the same barcode aborts this whole transaction
    // (Postgres rejects further statements in an already-failed transaction, so
    // the race must be resolved with a fresh read after rollback, not inside it).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const race = await prisma.product.findUnique({ where: { barcode: data.barcode }, include: PRODUCT_INCLUDE });
      if (race) return race;
    }
    throw err;
  }
}

// --- Legacy lookup (unchanged response/status envelope) -----------------------------

export interface LegacyLookupResult {
  product: ProductWithPhotos | null;
  /**
   * True when an exact local row (or a resolved merge canonical) is not
   * active. The route must treat this as a plain miss (existing legacy 404)
   * without calling external providers, without enqueueing backfill, and
   * without ever serializing the row.
   */
  privateReservation: boolean;
}

async function legacyResultFor(product: ProductWithPhotos): Promise<LegacyLookupResult> {
  const resolved = product.status === 'merged_into' ? await resolveCanonicalProduct(product, getPrisma()) : product;
  if (resolved.status === 'active') return { product: resolved, privateReservation: false };
  return { product: null, privateReservation: true };
}

export async function lookupProduct(input: LookupInput): Promise<LegacyLookupResult> {
  const local = await findLocalExact(input);
  if (local) return legacyResultFor(local);

  // QR payloads aren't queryable on OFF/UPC — only barcodes go external.
  if (!input.barcode) return { product: null, privateReservation: false };

  const off = await lookupOff(input.barcode);
  if (off.status === 'found') {
    // Re-classify rather than trust "just persisted": a concurrent private
    // draft can win the race between findLocalExact and this HTTP round trip,
    // and persistExternal deliberately hands that row back unmodified.
    return legacyResultFor(await persistExternal(off.data));
  }
  const upc = await lookupUpcitemdb(input.barcode);
  if (upc.status === 'found') {
    return legacyResultFor(await persistExternal(upc.data));
  }
  return { product: null, privateReservation: false };
}

// --- Lookup v2: explicit, non-disclosing outcomes ------------------------------------

async function classifyLocal(local: ProductWithPhotos, actor: LookupActor): Promise<ProductLookupV2Response> {
  if (local.status === 'merged_into') {
    const canonical = await resolveCanonicalProduct(local, getPrisma());
    // `resolveCanonicalProduct` guarantees its result is either resolved (not
    // `merged_into`) or gave up (dangling pointer / depth cap / a cycle) —
    // checking the status, not identity, is what actually terminates a cycle:
    // a cyclical chain (A -> B -> A) can resolve to a *different* still-merged
    // row on each attempt, so comparing IDs would recurse between them forever.
    if (canonical.status === 'merged_into') {
      // Unresolved: a permanent, non-disclosing dead end for every actor,
      // admins included — there is no real row to authorize a read against.
      return { outcome: 'under_review' };
    }
    return classifyLocal(canonical, actor);
  }
  if (local.status === 'active') {
    return { outcome: 'found', product: { ...toApiProduct(local, actor), status: 'active' } };
  }
  if (actor.role === 'admin') {
    // Moderation tooling gets a read-only authorized view of every non-active
    // status (including report_hidden) — never the mobile edit entitlement.
    return {
      outcome: 'creator_pending',
      product: { ...toApiProduct(local, actor), status: local.status as 'draft' | 'pending' | 'changes_required' | 'report_hidden' },
    };
  }
  if (local.status === 'report_hidden') {
    // Never creator_pending here, even when a legacy row happens to carry a
    // creator ID — report-hidden is catalog moderation, not creator submission.
    return { outcome: 'under_review' };
  }
  if (local.createdByUserId === actor.id) {
    if (local.status === 'draft' || local.status === 'changes_required') {
      return { outcome: 'editable_private', product: { ...toApiProduct(local, actor), status: local.status } };
    }
    if (local.status === 'pending') {
      return { outcome: 'creator_pending', product: { ...toApiProduct(local, actor), status: 'pending' } };
    }
  }
  // another user's private/pending/draft/changes_required row.
  return { outcome: 'under_review' };
}

export async function lookupProductV2(
  input: LookupInput,
  actor: LookupActor,
): Promise<ProductLookupV2Response> {
  const local = await findLocalExact(input);
  if (local) return classifyLocal(local, actor);

  // QR local miss is conclusive; QR payloads aren't queryable externally.
  if (!input.barcode) return { outcome: 'not_found', canCreate: await isProductCreationEligible(actor) };

  let anyUnavailable = false;

  const off = await lookupOff(input.barcode);
  if (off.status === 'found') {
    // Re-classify: a concurrent private draft/active row can win the race
    // between findLocalExact and this HTTP round trip.
    return classifyLocal(await persistExternal(off.data), actor);
  }
  if (off.status === 'unavailable') anyUnavailable = true;

  const upc = await lookupUpcitemdb(input.barcode);
  if (upc.status === 'found') {
    return classifyLocal(await persistExternal(upc.data), actor);
  }
  if (upc.status === 'unavailable') anyUnavailable = true;

  // Unavailability of one source only poisons conclusiveness, not hit-finding: a
  // found result above always wins. Only when nothing was found do we distinguish
  // an unavailable source from a fully conclusive miss.
  if (anyUnavailable) return { outcome: 'temporarily_unavailable' };
  return { outcome: 'not_found', canCreate: await isProductCreationEligible(actor) };
}
