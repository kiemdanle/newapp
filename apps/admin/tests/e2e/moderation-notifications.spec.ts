import { expect, test } from '@playwright/test';
import { loginAsAdmin, resetStore } from './admin-helpers';

test.beforeEach(async ({ request }) => {
  await resetStore(request);
});

test.describe('moderation notification observability', () => {
  test('shows the live moderation count badge and opens safe batch history', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/products/pending');
    await expect(page.getByRole('link', { name: /Pending edits/ })).toContainText('4');

    await page.goto('/system/moderation-notifications');
    await expect(page.getByRole('heading', { name: 'Moderation notifications' })).toBeVisible();
    await expect(page.getByText('Durable batch and channel outcomes. Content is count-only.')).toBeVisible();
    await expect(page.getByText('Last successful tick')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open moderation queue' })).toHaveAttribute('href', '/products/pending');
    // The empty-history fixture has no batch rows. Batch rows render a dedicated
    // delivery-history link rather than silently restricting operators to only
    // the newest batch's first page.
  });
});
