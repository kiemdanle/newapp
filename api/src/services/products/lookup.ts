import type { Product } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { lookupOff } from './off-client.js';
import { lookupUpcitemdb } from './upcitemdb-client.js';
import type { ExternalProductData } from './mappers.js';
import { logger } from '../../logger.js';

export interface LookupInput {
  barcode?: string;
  qr?: string;
}

export async function lookupProduct(input: LookupInput): Promise<Product | null> {
  const prisma = getPrisma();

  // 1. Local cache (exact match on barcode or qr_payload)
  if (input.barcode) {
    const cached = await prisma.product.findUnique({ where: { barcode: input.barcode } });
    if (cached) return cached;
  }
  if (input.qr) {
    const cached = await prisma.product.findUnique({ where: { qrPayload: input.qr } });
    if (cached) return cached;
  }

  // QR payloads aren't queryable on OFF/UPC — only barcodes go external.
  if (!input.barcode) return null;

  // 2. Open Food Facts
  const fromOff = await safe(() => lookupOff(input.barcode!), 'off');
  if (fromOff) return persistExternal(fromOff);

  // 3. UPCitemdb fallback
  const fromUpc = await safe(() => lookupUpcitemdb(input.barcode!), 'upcitemdb');
  if (fromUpc) return persistExternal(fromUpc);

  // 4. Nothing matched
  return null;
}

async function safe<T>(fn: () => Promise<T | null>, label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    logger.warn({ err, source: label }, 'product lookup upstream error');
    return null;
  }
}

async function persistExternal(data: ExternalProductData): Promise<Product> {
  const prisma = getPrisma();
  return prisma.product.upsert({
    where: { barcode: data.barcode },
    create: {
      barcode: data.barcode,
      name: data.name,
      brand: data.brand,
      category: data.category,
      imageUrl: data.imageUrl,
      source: data.source,
      sourceId: data.sourceId,
    },
    update: {
      // Refresh fields when an external source resolves the same barcode.
      name: data.name,
      brand: data.brand,
      category: data.category,
      imageUrl: data.imageUrl,
    },
  });
}
