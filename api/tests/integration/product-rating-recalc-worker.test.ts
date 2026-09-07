// api/tests/integration/product-rating-recalc-worker.test.ts
import { describe, expect, it } from 'vitest';
import { lockProductForReviewMutation, recomputeAndSyncProductTallies } from '../../src/services/reviews/product-tallies.js';
import { makeProduct, makeReview, makeUser } from '../helpers/factories.js';
import { getPrisma } from '../../src/db.js';

describe('synchronous product-tallies durability', () => {
  it('tallies visible reviews by rating and ignores hidden/deleted', async () => {
    const prisma = getPrisma();
    const product = await makeProduct();
    const u1 = await makeUser({ email: `pr1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `pr2-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `pr3-${Date.now()}@t.l` });
    const u4 = await makeUser({ email: `pr4-${Date.now()}@t.l` });
    await makeReview({ userId: u1.id, productId: product.id, rating: 'buy_again', body: 'great' });
    await makeReview({ userId: u2.id, productId: product.id, rating: 'wont_buy', body: null });
    await makeReview({ userId: u3.id, productId: product.id, rating: 'buy_again', body: null, status: 'hidden' });
    await makeReview({ userId: u4.id, productId: product.id, rating: 'wont_buy', body: null, status: 'deleted' });

    await prisma.$transaction(async (tx) => {
      await lockProductForReviewMutation(tx, product.id);
      await recomputeAndSyncProductTallies(tx, product.id);
    });

    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.ratingCount).toBe(2); // only visible
    expect(after?.buyAgainCount).toBe(1);
    expect(after?.wontBuyCount).toBe(1);
    expect(after?.reviewCount).toBe(1); // only visible with body
  });

  it('handles a product with zero visible reviews', async () => {
    const prisma = getPrisma();
    const product = await makeProduct();
    await prisma.$transaction(async (tx) => {
      await lockProductForReviewMutation(tx, product.id);
      await recomputeAndSyncProductTallies(tx, product.id);
    });
    const after = await prisma.product.findUnique({ where: { id: product.id } });
    expect(after?.ratingCount).toBe(0);
    expect(after?.reviewCount).toBe(0);
  });
});
