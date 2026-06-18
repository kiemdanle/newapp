// apps/admin/tests/e2e/suspend-user.spec.ts
// Phase K: an admin finds the seeded user, suspends them from the detail page,
// and the suspended account is then rejected at login (401).

import { test, expect } from '@playwright/test';
import { loginAsAdmin, resetStore } from './admin-helpers';
import { FIXTURE, VICTIM_EMAIL, VICTIM_PASSWORD } from './mock-store';

const MOCK_API = process.env.MOCK_API_URL ?? 'http://localhost:4099';

test.beforeEach(async ({ request }) => {
  await resetStore(request);
});

test('admin suspends a user, who can no longer sign in', async ({ page, request }) => {
  await loginAsAdmin(page);

  await page.goto('/users');
  await page.getByLabel('Search').fill('victim');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('link', { name: VICTIM_EMAIL }).click();

  // Suspend runs through a native confirm() — accept every dialog this raises.
  page.on('dialog', (d) => d.accept());

  // Clicking Suspend drives a server action that PATCHes the API. The detail
  // page is freshly navigated, so the first click can land before the client
  // island hydrates (a no-op). Re-click until the backend status actually flips
  // — this proves the UI → action → API path fired end-to-end. Once suspended,
  // the control becomes Reactivate, so the guarded click stops firing.
  await expect(async () => {
    const suspend = page.getByRole('button', { name: 'Suspend' });
    if (await suspend.isVisible()) await suspend.click();
    const res = await request.get(`${MOCK_API}/v1/admin/users/${FIXTURE.victimUserId}`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).status).toBe('suspended');
  }).toPass({ timeout: 20_000 });

  // The suspended account is rejected at login (mock returns 401 for non-active).
  const login = await request.post(`${MOCK_API}/v1/auth/login`, {
    data: { email: VICTIM_EMAIL, password: VICTIM_PASSWORD },
  });
  expect(login.status()).toBe(401);
});
