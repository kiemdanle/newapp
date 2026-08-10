// apps/admin/tests/e2e/suspend-user.spec.ts
// Phase K: an admin finds the seeded user, suspends them from the detail page,
// and the suspended account is then rejected at login (401).

import { test, expect } from '@playwright/test';
import { loginAsAdmin, resetStore, MOCK_API } from './admin-helpers';
import { FIXTURE, VICTIM_EMAIL, VICTIM_PASSWORD } from './mock-store';

test.beforeEach(async ({ request }) => {
  await resetStore(request);
});

test('admin suspends a user, who can no longer sign in', async ({ page, request }) => {
  // This spec's own polling window sits on top of three cold-compiled
  // `next dev` route hits (login, users list, user detail) before it even
  // starts — comfortably inside Playwright's 30s per-test default on a quiet
  // machine, but not on a shared/loaded box. Reproduced twice: once blowing
  // the outer 30s test timeout before the polling loop even got its full
  // window, once blowing the inner toPass() window on its own even after
  // fixing the outer one — both failures' own page snapshots already showed
  // "Reactivate"/"suspended", proving the suspend action itself always
  // succeeds; only the margins were too tight for this box's load. Triples
  // the outer timeout (test.slow()) and widens the inner poll to match,
  // rather than guessing a single bigger magic number for either alone.
  test.slow();
  await loginAsAdmin(page);

  await page.goto('/users');
  await page.getByLabel('Search').fill('victim');
  // `Apply` is a plain `<form method="get">` submit — a full page navigation,
  // not a client-side transition. Clicking the victim link before that
  // navigation lands races the two navigations: the link's own click can be
  // swallowed by the in-flight Apply submit, leaving the page on the
  // (fully rendered, unfiltered-URL) `/users` list forever — observed via
  // trace as the retry loop below polling a `Suspend` button that never
  // exists because we're on the wrong page. Wait for the filtered URL to
  // land before clicking into the detail page.
  await Promise.all([
    page.waitForURL(/\/users\?/),
    page.getByRole('button', { name: 'Apply' }).click(),
  ]);
  await page.getByRole('link', { name: VICTIM_EMAIL }).click();

  // Suspend runs through a native confirm() — accept every dialog this raises.
  page.on('dialog', (d) => d.accept());

  // Clicking Suspend drives a server action that PATCHes the API. The detail
  // page is freshly navigated, so the first click can land before the client
  // island hydrates (a no-op). Re-click until the backend status actually flips
  // — this proves the UI → action → API path fired end-to-end.
  //
  // A first click's action can still be in flight (button disabled, label still
  // "Suspend" until the server action resolves and revalidates) when a retry
  // re-enters this callback. `suspend.click()` with no timeout auto-waits for
  // the button to become enabled — but once the in-flight action finally
  // resolves, the button is unmounted entirely (status flips to suspended, so
  // "Suspend" is replaced by "Reactivate"), and the locator sits waiting for an
  // element that will never come back, hanging past the outer `toPass` window
  // until the whole test times out (proven via trace: the second click's own
  // Playwright log shows "element was detached from the DOM, retrying" with no
  // further dialog ever firing). Only click while the button is actually
  // clickable, and bound the click itself so a mid-flight unmount can never
  // block this callback past its own retry.
  await expect(async () => {
    const suspend = page.getByRole('button', { name: 'Suspend' });
    // `isVisible()` never waits — it reads current DOM state immediately, so it
    // can't itself get stuck once the button is gone. `isEnabled()`/`click()`
    // both auto-wait for the locator to resolve, which is exactly what hangs
    // once the button is unmounted for good; bounding the click is what
    // actually matters here.
    if (await suspend.isVisible()) {
      await suspend.click({ timeout: 2_000 }).catch(() => {});
    }
    const res = await request.get(`${MOCK_API}/v1/admin/users/${FIXTURE.victimUserId}`);
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).status).toBe('suspended');
  }).toPass({ timeout: 60_000 });

  // The suspended account is rejected at login (mock returns 401 for non-active).
  const login = await request.post(`${MOCK_API}/v1/auth/login`, {
    data: { email: VICTIM_EMAIL, password: VICTIM_PASSWORD },
  });
  expect(login.status()).toBe(401);
});
