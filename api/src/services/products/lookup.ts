import type { Product } from '@prisma/client';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
import type { ProductLookupV2Response } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { lookupOff } from './off-client.js';
import { lookupUpcitemdb } from './upcitemdb-client.js';
import type { ExternalProductData } from './mappers.js';
import { toApiProduct } from './serializer.js';

export interface LookupInput {
  barcode?: string;
  qr?: string;
}

export interface LookupActor {
  id: string;
  role: 'user' | 'admin';
}

async function findLocalExact(input: LookupInput): Promise<Product | null> {
  const prisma = getPrisma();
  if (input.barcode) {
    const row = await prisma.product.findUnique({ where: { barcode: input.barcode } });
    if (row) return row;
  }
  if (input.qr) {
    const row = await prisma.product.findUnique({ where: { qrPayload: input.qr } });
    if (row) return row;
  }
  return null;
}

// Re-reads on conflict inside a transaction and never overwrites a user-sourced or
// non-active (private/moderation) row — an external hit can only ever create a new
// row or refresh an existing active external one. Exported for a focused race-safety
// unit test; not part of the public service surface used by routes.
export async function persistExternal(data: ExternalProductData): Promise<Product> {
  const prisma = getPrisma();
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { barcode: data.barcode } });
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
      });
    });
  } catch (err) {
    // A concurrent create for the same barcode aborts this whole transaction
    // (Postgres rejects further statements in an already-failed transaction, so
    // the race must be resolved with a fresh read after rollback, not inside it).
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const race = await prisma.product.findUnique({ where: { barcode: data.barcode } });
      if (race) return race;
    }
    throw err;
  }
}

// --- Legacy lookup (unchanged response/status envelope) -----------------------------

export interface LegacyLookupResult {
  product: Product | null;
  /**
   * True when an exact local row exists but is not active (draft/pending/
   * changes_required/report_hidden/merged_into). The route must treat this as a
   * plain miss (existing legacy 404) without calling external providers, without
   * enqueueing backfill, and without ever serializing the row.
   */
  privateReservation: boolean;
}

export async function lookupProduct(input: LookupInput): Promise<LegacyLookupResult> {
  const local = await findLocalExact(input);
  if (local) {
    if (local.status === 'active') return { product: local, privateReservation: false };
    return { product: null, privateReservation: true };
  }

  // QR payloads aren't queryable on OFF/UPC — only barcodes go external.
  if (!input.barcode) return { product: null, privateReservation: false };

  const off = await lookupOff(input.barcode);
  if (off.status === 'found') {
    return { product: await persistExternal(off.data), privateReservation: false };
  }
  const upc = await lookupUpcitemdb(input.barcode);
  if (upc.status === 'found') {
    return { product: await persistExternal(upc.data), privateReservation: false };
  }
  return { product: null, privateReservation: false };
}

// --- Lookup v2: explicit, non-disclosing outcomes ------------------------------------

function classifyLocal(local: Product, actor: LookupActor): ProductLookupV2Response {
  if (local.status === 'active') {
    return { outcome: 'found', product: toApiProduct(local) };
  }
  if (actor.role === 'admin') {
    // Moderation tooling gets a read-only authorized view of every non-active
    // status (including report_hidden) — never the mobile edit entitlement.
    return { outcome: 'creator_pending', product: toApiProduct(local) };
  }
  if (local.status === 'report_hidden') {
    // Never creator_pending here, even when a legacy row happens to carry a
    // creator ID — report-hidden is catalog moderation, not creator submission.
    return { outcome: 'under_review' };
  }
  if (local.createdByUserId === actor.id) {
    if (local.status === 'draft' || local.status === 'changes_required') {
      return { outcome: 'editable_private', product: toApiProduct(local) };
    }
    if (local.status === 'pending') {
      return { outcome: 'creator_pending', product: toApiProduct(local) };
    }
  }
  // merged_into, or another user's private/pending/draft/changes_required row.
  return { outcome: 'under_review' };
}

export async function lookupProductV2(
  input: LookupInput,
  actor: LookupActor,
): Promise<ProductLookupV2Response> {
  const local = await findLocalExact(input);
  if (local) return classifyLocal(local, actor);

  // QR local miss is conclusive; QR payloads aren't queryable externally.
  if (!input.barcode) return { outcome: 'not_found', canCreate: false };

  let anyUnavailable = false;

  const off = await lookupOff(input.barcode);
  if (off.status === 'found') {
    const product = await persistExternal(off.data);
    return { outcome: 'found', product: toApiProduct(product) };
  }
  if (off.status === 'unavailable') anyUnavailable = true;

  const upc = await lookupUpcitemdb(input.barcode);
  if (upc.status === 'found') {
    const product = await persistExternal(upc.data);
    return { outcome: 'found', product: toApiProduct(product) };
  }
  if (upc.status === 'unavailable') anyUnavailable = true;

  // Unavailability of one source only poisons conclusiveness, not hit-finding: a
  // found result above always wins. Only when nothing was found do we distinguish
  // an unavailable source from a fully conclusive miss.
  if (anyUnavailable) return { outcome: 'temporarily_unavailable' };
  // `canCreate` is the actor-specific Phase 7 eligibility capability; false until
  // that contract ships.
  return { outcome: 'not_found', canCreate: false };
}
