import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  adminPantryItemsQuerySchema,
  adminPantryItemRowSchema,
  adminPantryItemsListSchema,
  adminPantryItemDetailSchema,
  adminPantryItemPatchSchema,
  adminPantryFilterOptionsSchema,
} from './pantry-items.js';

const now = new Date().toISOString();

describe('adminPantryItemsQuerySchema', () => {
  it('applies standard defaults when query is empty', () => {
    const parsed = adminPantryItemsQuerySchema.parse({});
    expect(parsed).toEqual({
      productType: 'all',
      status: 'all',
      sortBy: 'expiryDate',
      sortOrder: 'asc',
      page: 1,
      limit: 25,
    });
  });

  it('coerces string numbers for page and limit', () => {
    const parsed = adminPantryItemsQuerySchema.parse({
      page: '3',
      limit: '50',
    });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(50);
  });

  it('accepts and parses expired status in query', () => {
    const parsed = adminPantryItemsQuerySchema.parse({
      status: 'expired',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(parsed.status).toBe('expired');
    expect(parsed.sortBy).toBe('createdAt');
    expect(parsed.sortOrder).toBe('desc');
  });

  it('rejects invalid status', () => {
    expect(() =>
      adminPantryItemsQuerySchema.parse({ status: 'invalid_status' }),
    ).toThrow();
  });

  it('rejects limit exceeding 100 or below 1', () => {
    expect(() =>
      adminPantryItemsQuerySchema.parse({ limit: '0' }),
    ).toThrow();
    expect(() =>
      adminPantryItemsQuerySchema.parse({ limit: '150' }),
    ).toThrow();
  });
});

describe('adminPantryItemRowSchema and adminPantryItemsListSchema', () => {
  const validRow = {
    id: randomUUID(),
    userId: randomUUID(),
    userName: 'Jane Doe',
    userEmail: 'jane@example.com',
    productId: randomUUID(),
    productName: 'Organic Whole Milk',
    productBarcode: '8935001234567',
    customName: null,
    displayName: 'Organic Whole Milk',
    brand: 'Happy Cow',
    category: 'Dairy',
    expiryDate: '2026-09-20',
    purchaseDate: '2026-09-10',
    quantity: 2,
    unit: 'bottle',
    price: 3.5,
    store: 'City Mart',
    location: 'Fridge',
    status: 'active' as const,
    photoUrl: 'https://cdn.example.com/pantry/1.jpg',
    photoCount: 1,
    householdId: null,
    householdName: null,
    createdAt: now,
    updatedAt: now,
  };

  it('parses valid row and supports expired status', () => {
    const row = adminPantryItemRowSchema.parse({
      ...validRow,
      status: 'expired',
    });
    expect(row.status).toBe('expired');
    expect(row.displayName).toBe('Organic Whole Milk');
  });

  it('parses valid list response', () => {
    const list = adminPantryItemsListSchema.parse({
      items: [validRow],
      total: 1,
      page: 1,
      limit: 25,
      totalPages: 1,
    });
    expect(list.items).toHaveLength(1);
    expect(list.total).toBe(1);
  });
});

describe('adminPantryItemDetailSchema', () => {
  const detailData = {
    id: randomUUID(),
    userId: randomUUID(),
    userName: 'John Smith',
    userEmail: 'john@example.com',
    productId: null,
    productName: null,
    productBarcode: null,
    customName: 'Homemade Bread',
    displayName: 'Homemade Bread',
    brand: null,
    category: 'Bakery',
    expiryDate: '2026-09-18',
    purchaseDate: null,
    quantity: 1,
    unit: 'loaf',
    price: null,
    store: null,
    location: 'Pantry Counter',
    status: 'active' as const,
    photoUrl: null,
    photoCount: 0,
    householdId: null,
    householdName: null,
    createdAt: now,
    updatedAt: now,
    notes: 'Baked fresh on Tuesday',
    photoUrls: [],
    notifyAt: [new Date('2026-09-17T09:00:00.000Z').toISOString()],
    consumedAt: null,
    discardedAt: null,
    discardReason: null,
    user: {
      id: randomUUID(),
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Smith',
      country: 'US',
      status: 'active',
    },
    product: null,
    household: null,
    pushLogsCount: 2,
    giveawaysCount: 0,
  };

  it('parses detailed pantry item with null product and household', () => {
    const parsed = adminPantryItemDetailSchema.parse(detailData);
    expect(parsed.customName).toBe('Homemade Bread');
    expect(parsed.product).toBeNull();
    expect(parsed.household).toBeNull();
    expect(parsed.pushLogsCount).toBe(2);
  });
});

describe('adminPantryItemPatchSchema', () => {
  it('accepts valid partial patch payload with expired status', () => {
    const patch = adminPantryItemPatchSchema.parse({
      status: 'expired',
      notes: 'Expired before consumption',
      location: 'Bin',
    });
    expect(patch.status).toBe('expired');
    expect(patch.location).toBe('Bin');
  });

  it('enforces string bounds matching mobile recordSchema limits', () => {
    expect(() =>
      adminPantryItemPatchSchema.parse({
        brand: 'a'.repeat(121),
      }),
    ).toThrow();

    expect(() =>
      adminPantryItemPatchSchema.parse({
        location: 'a'.repeat(51),
      }),
    ).toThrow();

    expect(() =>
      adminPantryItemPatchSchema.parse({
        discardReason: 'a'.repeat(51),
      }),
    ).toThrow();

    expect(() =>
      adminPantryItemPatchSchema.parse({
        notes: 'a'.repeat(2001),
      }),
    ).toThrow();
  });

  it('rejects negative quantity or quantity exceeding 100,000', () => {
    expect(() =>
      adminPantryItemPatchSchema.parse({ quantity: -1 }),
    ).toThrow();

    expect(() =>
      adminPantryItemPatchSchema.parse({ quantity: 100_001 }),
    ).toThrow();
  });

  it('validates ISO date format YYYY-MM-DD for expiryDate and purchaseDate', () => {
    expect(
      adminPantryItemPatchSchema.parse({
        expiryDate: '2026-10-15',
        purchaseDate: '2026-09-01',
      }),
    ).toMatchObject({
      expiryDate: '2026-10-15',
      purchaseDate: '2026-09-01',
    });

    expect(() =>
      adminPantryItemPatchSchema.parse({ expiryDate: '15/10/2026' }),
    ).toThrow();
  });
});

describe('adminPantryFilterOptionsSchema', () => {
  it('parses string arrays for filter options', () => {
    const parsed = adminPantryFilterOptionsSchema.parse({
      locations: ['Cabinet', 'Fridge', 'Pantry'],
      categories: ['Beverages', 'Dairy', 'Produce'],
      brands: ['Brand A', 'Brand B'],
    });
    expect(parsed.locations).toEqual(['Cabinet', 'Fridge', 'Pantry']);
    expect(parsed.categories).toHaveLength(3);
    expect(parsed.brands).toHaveLength(2);
  });
});
