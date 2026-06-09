import type { Product } from '@prisma/client';
import { getPrisma } from '../../db.js';

/**
 * Fuzzy product search via pg_trgm similarity on `name + ' ' + brand`,
 * threshold > 0.3, ordered by similarity desc, then review_count desc.
 *
 * Columns are aliased to the Prisma camelCase shape so callers can pass rows
 * straight into `toApiProduct(...)`.
 */
export async function searchProducts(q: string, limit: number): Promise<Product[]> {
  const prisma = getPrisma();
  return prisma.$queryRaw<Product[]>`
    SELECT
      id,
      barcode,
      qr_payload              AS "qrPayload",
      name,
      brand,
      category,
      image_url               AS "imageUrl",
      default_shelf_life_days AS "defaultShelfLifeDays",
      source,
      source_id               AS "sourceId",
      is_community_eligible   AS "isCommunityEligible",
      buy_again_count         AS "buyAgainCount",
      buy_again_on_sale_count AS "buyAgainOnSaleCount",
      wont_buy_count          AS "wontBuyCount",
      rating_count            AS "ratingCount",
      review_count            AS "reviewCount",
      created_by_user_id      AS "createdByUserId",
      status,
      merged_into_product_id  AS "mergedIntoProductId",
      created_at              AS "createdAt",
      updated_at              AS "updatedAt"
    FROM products
    WHERE status = 'active'
      AND similarity(coalesce(name, '') || ' ' || coalesce(brand, ''), ${q}) > 0.3
    ORDER BY similarity(coalesce(name, '') || ' ' || coalesce(brand, ''), ${q}) DESC,
             review_count DESC
    LIMIT ${limit}
  `;
}
