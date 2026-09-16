import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, { value: string }>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { serverAdminApi } from '@/lib/admin-api';
import {
  patchPantryItemAction,
  discardPantryItemAction,
  deletePantryItemAction,
} from '@/lib/actions';
import { COOKIE_NAMES } from '@/lib/cookies';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.API_BASE_URL = 'http://localhost:4000';
  process.env.COOKIE_SECURE = 'false';
  process.env.COOKIE_DOMAIN = '';
  cookieStore.clear();
  cookieStore.set(COOKIE_NAMES.access, { value: 'admin-token-123' });
});

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
  vi.resetModules();
  vi.clearAllMocks();
});

const mockRow = {
  id: randomUUID(),
  userId: randomUUID(),
  userName: 'Alice',
  userEmail: 'alice@example.com',
  productId: null,
  productName: null,
  productBarcode: null,
  customName: 'Almond Butter',
  displayName: 'Almond Butter',
  brand: 'NutCo',
  category: 'Spreads',
  expiryDate: '2026-11-01',
  purchaseDate: '2026-09-01',
  quantity: 1,
  unit: 'jar',
  price: 6.99,
  store: 'Market',
  location: 'Pantry Shelf',
  status: 'active' as const,
  photoUrl: null,
  photoCount: 0,
  householdId: null,
  householdName: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockDetail = {
  ...mockRow,
  notes: 'Crunchy style',
  photoUrls: [],
  notifyAt: [],
  consumedAt: null,
  discardedAt: null,
  discardReason: null,
  user: {
    id: mockRow.userId,
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    country: 'US',
    status: 'active',
  },
  product: null,
  household: null,
  pushLogsCount: 0,
  giveawaysCount: 0,
};

describe('serverAdminApi.pantryItems', () => {
  it('list() appends query parameters and parses list schema', async () => {
    let capturedUrl = '';
    global.fetch = vi.fn(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          items: [mockRow],
          total: 1,
          page: 2,
          limit: 10,
          totalPages: 1,
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const res = await serverAdminApi.pantryItems.list({
      q: 'butter',
      status: 'active',
      page: 2,
      limit: 10,
    });

    expect(capturedUrl).toContain('/v1/admin/pantry-items?');
    expect(capturedUrl).toContain('q=butter');
    expect(capturedUrl).toContain('status=active');
    expect(capturedUrl).toContain('page=2');
    expect(capturedUrl).toContain('limit=10');
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.displayName).toBe('Almond Butter');
  });

  it('filterOptions() fetches and parses filter aggregates', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          locations: ['Cabinet', 'Fridge', 'Pantry'],
          categories: ['Dairy', 'Spreads'],
          brands: ['NutCo'],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const res = await serverAdminApi.pantryItems.filterOptions();
    expect(res.locations).toContain('Fridge');
    expect(res.brands).toContain('NutCo');
  });

  it('get() returns full detail DTO', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockDetail), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await serverAdminApi.pantryItems.get(mockRow.id);
    expect(res.id).toBe(mockRow.id);
    expect(res.notes).toBe('Crunchy style');
    expect(res.user.email).toBe('alice@example.com');
  });
});

describe('pantry item server actions', () => {
  it('patchPantryItemAction updates item and revalidates paths', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(mockDetail), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await patchPantryItemAction(mockRow.id, {
      location: 'Fridge',
    });

    expect(res.ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/pantry-items');
    expect(revalidatePath).toHaveBeenCalledWith(`/pantry-items/${mockRow.id}`);
  });

  it('discardPantryItemAction sends discarded status and reason', async () => {
    let capturedBody = '';
    global.fetch = vi.fn(async (_url, init) => {
      capturedBody = (init as RequestInit).body as string;
      return new Response(
        JSON.stringify({ ...mockDetail, status: 'discarded', discardReason: 'Spoiled' }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const res = await discardPantryItemAction(mockRow.id, 'Spoiled');
    expect(res.ok).toBe(true);
    expect(JSON.parse(capturedBody)).toEqual({
      status: 'discarded',
      discardReason: 'Spoiled',
    });
  });

  it('deletePantryItemAction deletes item and revalidates /pantry-items', async () => {
    global.fetch = vi.fn(async () => {
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    const res = await deletePantryItemAction(mockRow.id);
    expect(res.ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/pantry-items');
  });
});
