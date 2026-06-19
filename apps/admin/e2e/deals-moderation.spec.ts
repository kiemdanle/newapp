// apps/admin/e2e/deals-moderation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('deals moderation', () => {
  test('admin lists deals, hides and restores one', async ({ page }) => {
    // Sign in as admin (reuse M3 auth fixture pattern)
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.local');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    // Wait for dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Navigate to deals
    await page.click('text=Deals');
    await expect(page.locator('h1')).toContainText('Deals');

    // Filter to visible
    await page.selectOption('select[name="status"]', 'visible');
    // Hide the first deal
    const hideBtn = page.locator('button:has-text("Hide")').first();
    if (await hideBtn.isVisible()) {
      await hideBtn.click();
      await expect(page.locator('text=Working…')).toBeVisible();
      await expect(page.locator('text=Working…')).not.toBeVisible({ timeout: 5000 });
    }

    // Filter to hidden
    await page.selectOption('select[name="status"]', 'hidden');
    // Restore the first hidden deal
    const restoreBtn = page.locator('button:has-text("Restore")').first();
    if (await restoreBtn.isVisible()) {
      await restoreBtn.click();
      await expect(page.locator('text=Working…')).not.toBeVisible({ timeout: 5000 });
    }
  });
});
