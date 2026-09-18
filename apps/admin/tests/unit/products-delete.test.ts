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
import { deleteProductAction, mergeProductsAction } from '@/lib/actions';
import { COOKIE_NAMES } from '@/lib/cookies';
import { buildMergeSearchUrl } from '@/app/(admin)/products/[id]/merge/merge-tool';
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

describe('Product Deletion Server Actions & Merge Routing', () => {
  it('deleteProductAction calls DELETE /v1/admin/products/:id?version=:version and revalidates paths', async () => {
    const productId = randomUUID();
    const version = 3;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: async () => '',
    });

    const result = await deleteProductAction(productId, version);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://localhost:4000/v1/admin/products/${productId}?version=${version}`);
    expect(init.method).toBe('DELETE');
    expect(revalidatePath).toHaveBeenCalledWith(`/products/${productId}`);
  });

  it('deleteProductAction catches 409 conflict and returns structured error payload', async () => {
    const productId = randomUUID();
    const version = 1;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/problem+json' }),
      json: async () => ({
        status: 409,
        code: 'product_has_pantry_items',
        title: 'Cannot delete product in use',
        detail: 'Cannot delete product: used by 3 stash items.',
        pantryItemCount: 3,
      }),
    });

    const result = await deleteProductAction(productId, version);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('product_has_pantry_items');
      expect(result.detail).toContain('used by 3 stash items');
    }
  });

  it('deleteProductAction catches 409 version_conflict and returns typed currentVersion', async () => {
    const productId = randomUUID();
    const version = 1;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/problem+json' }),
      json: async () => ({
        status: 409,
        code: 'version_conflict',
        title: 'The product was modified by another user',
        currentVersion: 2,
      }),
    });

    const result = await deleteProductAction(productId, version);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('version_conflict');
    }
  });

  it('Source-mode merge flow: targetId is candidate target and sourceIds is blocked product ID', async () => {
    const blockedProductId = randomUUID();
    const candidateTargetId = randomUUID();
    const candidateVersion = 4;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        targetId: candidateTargetId,
        movedRecords: 2,
        movedReviews: 1,
        newReviewCount: 5,
        newRatingCount: 5,
        newBuyAgainCount: 3,
        newBuyAgainOnSaleCount: 1,
        newWontBuyCount: 1,
      }),
    });
    const result = await mergeProductsAction(candidateTargetId, [blockedProductId], candidateVersion);

    expect(result.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://localhost:4000/v1/admin/products/${candidateTargetId}/merge`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.targetId).toBe(candidateTargetId);
    expect(body.sourceIds).toEqual([blockedProductId]);
    expect(body.version).toBe(candidateVersion);

    expect(revalidatePath).toHaveBeenCalledWith('/products');
  });

  it('buildMergeSearchUrl: direction=into is retained across search submissions', () => {
    const productId = '12345678-1234-1234-1234-123456789abc';

    // Both query and direction=into
    expect(buildMergeSearchUrl(productId, 'organic milk', 'into')).toBe(
      `/products/${productId}/merge?q=organic+milk&direction=into`,
    );

    // Only direction=into, empty query
    expect(buildMergeSearchUrl(productId, '', 'into')).toBe(
      `/products/${productId}/merge?direction=into`,
    );

    // Normal winner mode (no direction)
    expect(buildMergeSearchUrl(productId, 'apple', undefined)).toBe(
      `/products/${productId}/merge?q=apple`,
    );

    // No query and no direction
    expect(buildMergeSearchUrl(productId)).toBe(`/products/${productId}/merge`);
  });
});
