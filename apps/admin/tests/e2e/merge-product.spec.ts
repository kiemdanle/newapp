// apps/admin/tests/e2e/merge-product.spec.ts
// Phase K: an admin opens the dedicated merge tool for the winner product,
// searches for the seeded duplicate, selects it, and merges. The loser is then
// marked merged_into and the winner's denorm tallies absorb the loser's.

import { test, expect } from '@playwright/test';
import { loginAsAdmin, resetStore } from './admin-helpers';
import { FIXTURE } from './mock-store';

test.beforeEach(async ({ request }) => {
  await resetStore(request);
});

test('admin merges a duplicate product into the winner', async ({ page }) => {
  await loginAsAdmin(page);

  // The merge tool only fetches candidates once a search term is present.
  await page.goto(`/products/${FIXTURE.winnerProductId}/merge`);
  await expect(page.getByRole('heading', { name: /Merge into/i })).toBeVisible();

  await page.getByLabel('Search candidates').fill('Dup');
  await page.getByRole('button', { name: 'Search' }).click();

  // The winner is filtered out of its own candidate list; tick the loser.
  await page.getByRole('checkbox', { name: 'Select Dup Milk Duplicate' }).check();

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Merge 1 into this product/ }).click();

  // On success the tool routes back to the winner detail page.
  await page.waitForURL(new RegExp(`/products/${FIXTURE.winnerProductId}$`), { timeout: 15_000 });

  // The loser now shows up under the merged filter on the products list.
  await page.goto('/products?status=merged_into');
  await expect(page.getByRole('link', { name: 'Dup Milk Duplicate' })).toBeVisible();
});
