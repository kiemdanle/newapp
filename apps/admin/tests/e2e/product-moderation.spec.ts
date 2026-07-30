// apps/admin/tests/e2e/product-moderation.spec.ts
// Phase 6: unified moderation queue (new-product submissions + active-product
// revisions), revision detail/comparison, decisions, stale-revision recovery,
// direct photo correction, and the same-origin private-media proxy.

import { test, expect } from '@playwright/test';
import { loginAsAdmin, resetStore } from './admin-helpers';
import { FIXTURE } from './mock-store';

test.beforeEach(async ({ request }) => {
  await resetStore(request);
});

test.describe('moderation queue', () => {
  test('lists both new-product and revision items, and type filters narrow it', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/products/pending');

    await expect(page.getByRole('link', { name: 'New Scanned Snacks' })).toBeVisible();
    // Two seeded revisions target the same active product, so this text is
    // expected to appear twice in the "all" view.
    await expect(page.getByText(FIXTURE.activeProductId).first()).toBeVisible();

    await page.goto('/products/pending?type=new');
    await expect(page.getByRole('link', { name: 'New Scanned Snacks' })).toBeVisible();
    await expect(page.getByText(FIXTURE.activeProductId)).not.toBeVisible();

    await page.goto('/products/pending?type=revision');
    await expect(page.getByRole('link', { name: 'New Scanned Snacks' })).not.toBeVisible();
    await expect(page.getByText(FIXTURE.activeProductId).first()).toBeVisible();
  });

  test('shows an empty state when a filter matches nothing', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/products/pending?type=new&status=changes_required');
    await expect(page.getByText('No items match these filters.')).toBeVisible();
  });
});

test.describe('revision detail', () => {
  test('compares live vs proposed metadata and photo counts', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/products/pending/${FIXTURE.pendingEditId}`);

    await expect(page.getByRole('heading', { name: /Revision to Active Cereal/ })).toBeVisible();
    await expect(page.getByText('Active Cereal (renamed)')).toBeVisible();
    await expect(page.getByText('Live photos (1)')).toBeVisible();
    await expect(page.getByText('Proposed photos (2)')).toBeVisible();
  });

  test('approving a healthy revision returns to the queue', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/products/pending/${FIXTURE.pendingEditId}`);

    await page.getByRole('button', { name: 'Approve' }).click();
    await page.waitForURL(/\/products\/pending$/, { timeout: 15_000 });
  });

  test('requesting changes requires a non-empty reason', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/products/pending/${FIXTURE.pendingEditId}`);

    await page.getByRole('button', { name: 'Request Changes' }).click();
    const send = page.getByRole('button', { name: 'Send' });
    await expect(send).toBeDisabled();

    await page.getByPlaceholder('Reason for requesting changes').fill('Please fix the name.');
    await expect(send).toBeEnabled();
    await send.click();
    await page.waitForURL(/\/products\/pending$/, { timeout: 15_000 });
  });

  test('a stale revision shows rebase/supersede recovery instead of an ordinary decision', async ({ page }) => {
    await loginAsAdmin(page);
    // Bump the live product's version so `staleEditId`'s baseProductVersion (1)
    // no longer matches — this is the only path a real API would ever produce a
    // stale revision through (a direct correction or a concurrent approval).
    await page.goto(`/products/${FIXTURE.activeProductId}`);
    await page.getByLabel('Name').fill('Active Cereal Renamed By Admin');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.goto(`/products/pending/${FIXTURE.staleEditId}`);
    await expect(page.getByRole('heading', { name: 'Stale revision recovery' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rebase' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supersede' })).toBeVisible();
    // The ordinary decision controls are not the path forward for a stale edit.
    await expect(page.getByRole('button', { name: 'Approve' })).not.toBeVisible();
  });

  test('supersede closes a stale revision and returns to the queue', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/products/${FIXTURE.activeProductId}`);
    await page.getByLabel('Name').fill('Active Cereal Renamed By Admin');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.goto(`/products/pending/${FIXTURE.staleEditId}`);
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Supersede' }).click();
    await page.waitForURL(/\/products\/pending$/, { timeout: 15_000 });
  });
});

test.describe('direct photo correction', () => {
  test('reorders and removes a live product photo', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/products/${FIXTURE.pendingProductId}`);

    await expect(page.getByText('Cover')).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Remove photo' }).click();
    await expect(page.getByText('No photos.')).toBeVisible();
  });
});

test.describe('private media proxy', () => {
  test('serves bytes for an authenticated admin session', async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.get(
      `/api/admin-product-media/product/${FIXTURE.pendingProductId}/${FIXTURE.pendingProductPhotoId}/thumb`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/webp');
    expect(res.headers()['cache-control']).toContain('no-store');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    const body = await res.body();
    expect(body.length).toBeGreaterThan(0);
    // The proxy response never carries a bearer token or the upstream URL.
    expect(res.headers()['authorization']).toBeUndefined();
    expect(res.headers()['location']).toBeUndefined();
  });

  test('denies an anonymous request before it ever reaches this route (redirected by the auth middleware first)', async ({
    browser,
    baseURL,
  }) => {
    // The whole admin app's auth middleware redirects any request to a
    // protected path — API routes included — to `/login` when there is no
    // access cookie at all, before this route's own handler (and its own
    // fast-fail 401 for a present-but-invalid cookie) ever runs. A fresh,
    // cookie-less context reproduces exactly that "never authenticated" case.
    const anonContext = await browser.newContext(baseURL ? { baseURL } : {});
    const res = await anonContext.request.get(
      `/api/admin-product-media/product/${FIXTURE.pendingProductId}/${FIXTURE.pendingProductPhotoId}/thumb`,
      { maxRedirects: 0 },
    );
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/login');
    await anonContext.close();
  });

  test('404s cleanly on an invalid target kind', async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.get(
      `/api/admin-product-media/not-a-kind/${FIXTURE.pendingProductId}/${FIXTURE.pendingProductPhotoId}/thumb`,
    );
    expect(res.status()).toBe(404);
  });

  test('404s cleanly on a cross-product photoId substitution', async ({ page }) => {
    await loginAsAdmin(page);
    // `pendingProductPhotoId` belongs to `pendingProductId`, not `activeProductId` —
    // the parent-bound lookup must 404 rather than serve it under the wrong parent.
    const res = await page.request.get(
      `/api/admin-product-media/product/${FIXTURE.activeProductId}/${FIXTURE.pendingProductPhotoId}/thumb`,
    );
    expect(res.status()).toBe(404);
  });

  test('sets its own no-store/nosniff headers even when the upstream 404s', async ({ page }) => {
    await loginAsAdmin(page);
    const missingPhotoId = '99999999-9999-4999-8999-999999999999';
    const res = await page.request.get(
      `/api/admin-product-media/product/${FIXTURE.pendingProductId}/${missingPhotoId}/thumb`,
    );
    expect(res.status()).toBe(404);
    expect(res.headers()['cache-control']).toContain('no-store');
  });
});
