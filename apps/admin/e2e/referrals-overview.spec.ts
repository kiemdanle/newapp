// apps/admin/e2e/referrals-overview.spec.ts
import { test, expect } from '@playwright/test';

test.describe('referrals overview', () => {
  test('admin navigates to referrals page and sees overview', async ({ page }) => {
    // Sign in as admin using the M0d auth form pattern
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.local');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Navigate to referrals via sidebar
    await page.click('text=Referrals');
    await expect(page.locator('h1')).toContainText('Referrals');

    // Stats and table should be visible
    await expect(page.locator('text=Total referrals')).toBeVisible();
    await expect(page.locator('text=Activated')).toBeVisible();
  });
});
