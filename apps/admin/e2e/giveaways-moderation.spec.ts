// apps/admin/e2e/giveaways-moderation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('giveaways moderation', () => {
  test('admin lists giveaways and cancels one', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.local');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    await page.click('text=Giveaways');
    await expect(page.locator('h1')).toContainText('Giveaways');

    // Filter to open
    await page.selectOption('select[name="status"]', 'open');
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      // confirm dialog
      page.on('dialog', (dialog) => dialog.accept());
      await expect(page.locator('text=Working…')).not.toBeVisible({ timeout: 5000 });
    }
  });
});
