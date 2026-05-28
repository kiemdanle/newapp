// apps/admin/tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { E2E_ADMIN_ENROLLED, E2E_ADMIN_FRESH } from './mock-api-constants';

test('admin can sign in with password + TOTP and lands on /', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_ADMIN_ENROLLED.email);
  await page.getByLabel('Password').fill(E2E_ADMIN_ENROLLED.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByLabel('Authenticator code')).toBeVisible({ timeout: 10_000 });
  const code = authenticator.generate(E2E_ADMIN_ENROLLED.totpSecret);
  await page.getByLabel('Authenticator code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();

  await page.waitForURL('http://localhost:4001/', { timeout: 10_000 });
  await expect(page.getByText(/implemented in M3/i)).toBeVisible();
});

test('fresh admin without TOTP sees enrollment step with QR + recovery codes', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_ADMIN_FRESH.email);
  await page.getByLabel('Password').fill(E2E_ADMIN_FRESH.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Enrollment step renders the QR + the "shown only once" warning + the 10 codes.
  await expect(page.getByAltText('TOTP enrollment QR code')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/shown only once/i)).toBeVisible();
  await expect(page.getByText('AAAA-1111')).toBeVisible();
  await expect(page.getByText('JJJJ-0000')).toBeVisible();
});

test('unauthenticated visit to / is redirected to /login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await page.waitForURL('**/login?next=%2F', { timeout: 10_000 });
});
