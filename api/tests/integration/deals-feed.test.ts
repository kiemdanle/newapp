import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { issueAccessToken } from '../../src/services/auth/tokens.js';
import { makeDeal, makeProduct, makeUser } from '../helpers/factories.js';

describe('GET /v1/deals', () => {
  it('returns visible deals sorted by score DESC', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `a-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `b-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `c-${Date.now()}@t.l` });
    await makeDeal({ userId: u1.id, productId: p.id, score: 0.2 });
    await makeDeal({ userId: u2.id, productId: p.id, score: 0.8 });
    await makeDeal({ userId: u3.id, productId: p.id, score: 0.5 });
    const res = await app.inject({ method: 'GET', url: '/v1/deals' });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items).toHaveLength(3);
    expect(items[0].score).toBeGreaterThanOrEqual(items[1].score);
    await app.close();
  });

  it('excludes hidden and deleted deals', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `h1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `h2-${Date.now()}@t.l` });
    const u3 = await makeUser({ email: `h3-${Date.now()}@t.l` });
    await makeDeal({ userId: u1.id, productId: p.id, status: 'hidden' });
    await makeDeal({ userId: u2.id, productId: p.id, status: 'deleted' });
    await makeDeal({ userId: u3.id, productId: p.id, status: 'visible' });
    const res = await app.inject({ method: 'GET', url: '/v1/deals' });
    expect(res.json().items).toHaveLength(1);
    await app.close();
  });

  it('supports sort=new', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u1 = await makeUser({ email: `n1-${Date.now()}@t.l` });
    const u2 = await makeUser({ email: `n2-${Date.now()}@t.l` });
    const d1 = await makeDeal({
      userId: u1.id,
      productId: p.id,
      createdAt: new Date(Date.now() - 10000),
    });
    const d2 = await makeDeal({
      userId: u2.id,
      productId: p.id,
      createdAt: new Date(Date.now()),
    });
    const res = await app.inject({ method: 'GET', url: '/v1/deals?sort=new' });
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toEqual([d2.id, d1.id]);
    await app.close();
  });

  it('supports sort=price_asc and sort=price_desc', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u = await makeUser({ email: `p-${Date.now()}@t.l` });
    const dCheap = await makeDeal({ userId: u.id, productId: p.id, price: 1.99 });
    const dExpensive = await makeDeal({ userId: u.id, productId: p.id, price: 9.99 });

    const resAsc = await app.inject({ method: 'GET', url: '/v1/deals?sort=price_asc' });
    expect(resAsc.statusCode).toBe(200);
    const itemsAsc = resAsc.json().items;
    expect(itemsAsc[0].id).toBe(dCheap.id);

    const resDesc = await app.inject({ method: 'GET', url: '/v1/deals?sort=price_desc' });
    expect(resDesc.statusCode).toBe(200);
    const itemsDesc = resDesc.json().items;
    expect(itemsDesc[0].id).toBe(dExpensive.id);

    await app.close();
  });

  it('filters by search keyword q matching product name or store', async () => {
    const app = await buildServer();
    const p1 = await makeProduct({ name: 'Organic Almond Milk' });
    const p2 = await makeProduct({ name: 'Sourdough Bread' });
    const u = await makeUser({ email: `q-${Date.now()}@t.l` });
    await makeDeal({ userId: u.id, productId: p1.id, storeName: 'Trader Joe' });
    await makeDeal({ userId: u.id, productId: p2.id, storeName: 'Safeway' });

    const resMilk = await app.inject({ method: 'GET', url: '/v1/deals?q=Almond' });
    expect(resMilk.statusCode).toBe(200);
    expect(resMilk.json().items).toHaveLength(1);
    expect(resMilk.json().items[0].product.name).toContain('Almond');

    const resStore = await app.inject({ method: 'GET', url: '/v1/deals?q=Trader' });
    expect(resStore.statusCode).toBe(200);
    expect(resStore.json().items).toHaveLength(1);
    expect(resStore.json().items[0].storeName).toBe('Trader Joe');

    await app.close();
  });

  it('filters by store name and price range', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u = await makeUser({ email: `f-${Date.now()}@t.l` });
    await makeDeal({ userId: u.id, productId: p.id, storeName: 'Costco', price: 15.0 });
    await makeDeal({ userId: u.id, productId: p.id, storeName: 'Aldi', price: 4.0 });

    const resStore = await app.inject({ method: 'GET', url: '/v1/deals?store=Costco' });
    expect(resStore.statusCode).toBe(200);
    expect(resStore.json().items).toHaveLength(1);
    expect(resStore.json().items[0].storeName).toBe('Costco');

    const resPrice = await app.inject({ method: 'GET', url: '/v1/deals?minPrice=10&maxPrice=20' });
    expect(resPrice.statusCode).toBe(200);
    expect(resPrice.json().items).toHaveLength(1);
    expect(resPrice.json().items[0].price).toBe(15.0);

    await app.close();
  });

  it('filters by expiryStatus unexpired', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u = await makeUser({ email: `e-${Date.now()}@t.l` });
    const tomorrow = new Date(Date.now() + 86400000);
    const yesterday = new Date(Date.now() - 86400000);

    await makeDeal({ userId: u.id, productId: p.id, expiryDate: yesterday });
    const dFresh = await makeDeal({ userId: u.id, productId: p.id, expiryDate: tomorrow });

    const res = await app.inject({ method: 'GET', url: '/v1/deals?expiryStatus=unexpired' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().items.map((x: { id: string }) => x.id);
    expect(ids).toContain(dFresh.id);

    await app.close();
  });

  it('returns hybrid store facets from GET /v1/deals/stores', async () => {
    const app = await buildServer();
    const p = await makeProduct();
    const u = await makeUser({ email: `st-${Date.now()}@t.l` });
    await makeDeal({ userId: u.id, productId: p.id, storeName: 'Unique Supermarket' });

    const res = await app.inject({ method: 'GET', url: '/v1/deals/stores' });
    expect(res.statusCode).toBe(200);
    const names = res.json().items.map((s: { name: string }) => s.name);
    expect(names).toContain('Unique Supermarket');
    expect(names).toContain("Trader Joe's");
    expect(names).toContain('Costco');

    await app.close();
  });
});
