// apps/admin/tests/e2e/admin-helpers.ts
// Shared helpers for the Phase K admin E2E specs. `loginAsAdmin` drives the real
// login form (password → TOTP) against the mock API so each spec starts
// authenticated; `resetStore` re-seeds the mock's in-memory data so specs are
// order-independent despite Playwright reusing one mock-server process.

import { type Page, type APIRequestContext, expect } from '@playwright/test';
import { authenticator } from 'otplib';
import { E2E_ADMIN_ENROLLED } from './mock-api-constants';

const MOCK_API = process.env.MOCK_API_BASE ?? 'http://localhost:4099';

/** Re-seed the mock store. Call at the top of every spec for a known state. */
export async function resetStore(request: APIRequestContext): Promise<void> {
  const res = await request.post(`${MOCK_API}/v1/dev/reset`);
  expect(res.ok()).toBeTruthy();
}

/** Sign in through the real UI as the TOTP-enrolled admin and land on `/`. */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_ADMIN_ENROLLED.email);
  await page.getByLabel('Password').fill(E2E_ADMIN_ENROLLED.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  const code = authenticator.generate(E2E_ADMIN_ENROLLED.totpSecret);
  await page.getByLabel('Authenticator code').fill(code);
  await page.getByRole('button', { name: 'Verify' }).click();

  await page.waitForURL('http://localhost:4001/', { timeout: 15_000 });
}
