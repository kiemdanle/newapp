import type { FastifyInstance } from 'fastify';
import type { DealStoreFacet } from '@expyrico/shared';
import { getPrisma } from '../../db.js';

const CURATED_STORES = [
  "Trader Joe's",
  'ALDI',
  'Costco',
  'Walmart',
  'Target',
  'Whole Foods',
  'Kroger',
  'Safeway',
  'Lidl',
  'H-E-B',
  'Publix',
];

export async function storesRoute(app: FastifyInstance) {
  app.get(
    '/deals/stores',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (): Promise<{ items: DealStoreFacet[] }> => {
      const prisma = getPrisma();

      const dbStores = await prisma.deal.groupBy({
        by: ['storeName'],
        where: { status: 'visible' },
        _count: { _all: true },
        orderBy: { _count: { storeName: 'desc' } },
        take: 30,
      });

      const storeMap = new Map<string, number>();

      // Add active DB stores first with real counts
      for (const row of dbStores) {
        if (row.storeName && row.storeName.trim()) {
          storeMap.set(row.storeName.trim(), row._count._all);
        }
      }

      // Add curated stores if not already present
      for (const name of CURATED_STORES) {
        if (!storeMap.has(name)) {
          storeMap.set(name, 0);
        }
      }

      const items: DealStoreFacet[] = Array.from(storeMap.entries()).map(([name, count]) => ({
        name,
        count,
      }));

      return { items };
    },
  );
}
