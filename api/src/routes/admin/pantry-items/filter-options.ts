import type { FastifyInstance } from 'fastify';
import { adminPantryFilterOptionsSchema } from '@expyrico/shared';
import { getPrisma } from '../../../db.js';
import { getRedis } from '../../../redis.js';

const CACHE_KEY = 'admin:pantry:filter_options:v1';
const CACHE_TTL_SECONDS = 300; // 5 minutes

export async function adminPantryItemsFilterOptionsRoute(app: FastifyInstance) {
  app.get('/filter-options', async () => {
    const redis = getRedis();

    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return adminPantryFilterOptionsSchema.parse(JSON.parse(cached));
      }
    } catch {
      // Fallback to database query if Redis read fails
    }

    const prisma = getPrisma();

    const [locationRows, recordCategoryRows, productCategoryRows, recordBrandRows, productBrandRows] =
      await Promise.all([
        prisma.record.findMany({
          where: { location: { not: null } },
          distinct: ['location'],
          select: { location: true },
          take: 100,
        }),
        prisma.record.findMany({
          where: { category: { not: null } },
          distinct: ['category'],
          select: { category: true },
          take: 100,
        }),
        prisma.product.findMany({
          where: { category: { not: null } },
          distinct: ['category'],
          select: { category: true },
          take: 100,
        }),
        prisma.record.findMany({
          where: { brand: { not: null } },
          distinct: ['brand'],
          select: { brand: true },
          take: 50,
        }),
        prisma.product.findMany({
          where: { brand: { not: null } },
          distinct: ['brand'],
          select: { brand: true },
          take: 50,
        }),
      ]);

    const cleanSort = (items: (string | null | undefined)[]) =>
      Array.from(
        new Set(
          items
            .map((s) => s?.trim())
            .filter((s): s is string => Boolean(s && s.length > 0)),
        ),
      ).sort((a, b) => a.localeCompare(b));

    const locations = cleanSort(locationRows.map((r) => r.location));
    const categories = cleanSort([
      ...recordCategoryRows.map((r) => r.category),
      ...productCategoryRows.map((p) => p.category),
    ]);
    const brands = cleanSort([
      ...recordBrandRows.map((r) => r.brand),
      ...productBrandRows.map((p) => p.brand),
    ]);

    const result = { locations, categories, brands };

    try {
      await redis.setex(CACHE_KEY, CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch {
      // Ignore cache write errors
    }

    return adminPantryFilterOptionsSchema.parse(result);
  });
}
