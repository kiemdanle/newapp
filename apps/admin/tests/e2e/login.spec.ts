// apps/admin/tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { E2E_ADMIN_ENROLLED, E2E_ADMIN_FRESH } from './mock-api-constants';
import { ADMIN_PORT } from './admin-helpers';

test('admin can sign in with password + TOTP and trust device for 60 days', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_ADMIN_ENROLLED.email);
  await page.getByLabel('Password').fill(E2E_ADMIN_ENROLLED.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByLabel('Authenticator code')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByLabel('Trust this device for 60 days')).toBeChecked();

  const code = authenticator.generate(E2E_ADMIN_ENROLLED.totpSecret);
  await page.getByLabel('Authenticator code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();

  await page.waitForURL(`http://localhost:${ADMIN_PORT}/`, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  // Verify trusted device cookie was set
  const cookies = await page.context().cookies();
  const trustedCookie = cookies.find((c) => c.name === 'pantry_admin_trusted_device');
  expect(trustedCookie).toBeDefined();
  expect(trustedCookie?.value).toBe('mock-trusted-device-token');
});

test('subsequent login from trusted device bypasses TOTP challenge', async ({ page, context }) => {
  // Pre-seed trusted device cookie
  await context.addCookies([
    {
      name: 'pantry_admin_trusted_device',
      value: 'mock-trusted-device-token',
      domain: 'localhost',
      path: '/',
    },
  ]);

  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_ADMIN_ENROLLED.email);
  await page.getByLabel('Password').fill(E2E_ADMIN_ENROLLED.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Directly lands on overview without seeing OTP challenge
  await page.waitForURL(`http://localhost:${ADMIN_PORT}/`, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});

test('admin can log out and is redirected to /login, preserving trusted device', async ({ page, context }) => {
  // Login first
  await context.addCookies([
    {
      name: 'pantry_admin_trusted_device',
      value: 'mock-trusted-device-token',
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_ADMIN_ENROLLED.email);
  await page.getByLabel('Password').fill(E2E_ADMIN_ENROLLED.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`http://localhost:${ADMIN_PORT}/`, { timeout: 10_000 });

  // Click Logout
  await page.getByRole('button', { name: /sign out/i }).click();
  await page.waitForURL('**/login', { timeout: 10_000 });
  await expect(page.getByLabel('Email')).toBeVisible();

  // Session cookies cleared, trusted device cookie retained
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'pantry_admin_access')?.value ?? '').toBe('');
  expect(cookies.find((c) => c.name === 'pantry_admin_trusted_device')?.value).toBe('mock-trusted-device-token');
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
