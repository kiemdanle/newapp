// apps/admin/tests/e2e/moderate-report.spec.ts
// Phase K: a moderator opens the open-reports queue, drills into the seeded
// abuse report on a review, and hides the reported content. After resolving,
// the report leaves the default (open) queue.

import { test, expect } from '@playwright/test';
import { loginAsAdmin, resetStore } from './admin-helpers';

test.beforeEach(async ({ request }) => {
  await resetStore(request);
});

test('moderator hides a reported review', async ({ page }) => {
  await loginAsAdmin(page);

  // The reports list defaults to the open queue; the seeded report targets a review.
  // exact:true avoids matching the sidebar/analytics "Reviews" nav links.
  await page.goto('/reports');
  await expect(page.getByRole('link', { name: 'review', exact: true })).toBeVisible();

  // The Target cell links to the detail page (label is the targetType).
  await page.getByRole('link', { name: 'review', exact: true }).click();
  await expect(page.getByRole('heading', { name: /review report/i })).toBeVisible();

  // Hide content runs through a native confirm() — accept it.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Hide content' }).click();

  // The action revalidates /reports; the resolved report drops out of the open queue.
  await page.goto('/reports');
  await expect(page.getByText('No reports match these filters.')).toBeVisible();
});
