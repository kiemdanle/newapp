import { test, expect } from '@playwright/test';

test.describe('households management', () => {
  test('admin navigates to households page and sees list', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.local');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    await page.click('text=Households');
    await expect(page.locator('h1')).toContainText('Households');
  });

  test('admin opens a household detail and sees dissolve button', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.local');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Dashboard')).toBeVisible();

    await page.click('text=Households');
    // If there are households, click the first one (if none, the page shows empty state)
    const firstHousehold = page.locator('table a').first();
    if (await firstHousehold.isVisible()) {
      await firstHousehold.click();
      await expect(page.locator('text=Dissolve Household')).toBeVisible();
    }
  });
});
