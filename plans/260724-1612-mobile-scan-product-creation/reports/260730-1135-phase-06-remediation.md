# Phase 6 Remediation Report

Fixes reviewer-p6's findings (`reviewer-p6-260730-phase-06-review.md`) on commits `c6019ca`/`00b5abb`, plus team-lead's rulings on the report's 3 open questions.

## File Ownership

- `packages/shared/src/schemas/admin/products.ts` + `.test.ts` — schema fix (I1/M3), now uncontested since dev-1's task #18 finished with those route files.
- `api/src/routes/admin/products/{list,get,patch,moderate}.ts` — response-projection-only changes (add `version`/`description`/`mergedIntoProductId`), no service/logic changes.
- `apps/admin/**` — everything else.

## IMPORTANT

- **I1 (wrong-row version graft on `merged_into`)** — retired the two-request composition entirely per team-lead's ruling. `adminProductRowSchema` now carries `version`, `description`, and `mergedIntoProductId` directly; the 4 admin route projections populate them from the row they already loaded (never a second, possibly-different-identity read). `admin-api.ts`'s `products.get()` is a single request again. This also closes **M3** (non-atomic composition) as the same fix.
- **I2 (rebase submits an order never shown)** — `recovery-actions.tsx` rewritten: a "Selected (n/5)" list renders `order` directly, in the exact positions/order that will be submitted, with per-row ↑/↓/Remove; an "Available" list holds everything not yet selected, with "Add" (disabled at the cap).
- **I3 (rebase default exceeds the 5-cap)** — default `order` is now `allCandidates.slice(0, 5)`, always valid; "Add" disables at the cap with an `n/5` counter and an explanatory note.
- **I4 (dead moderation controls on `changes_required`)** — `product-actions.tsx`'s `needsModeration` now gates on `status === 'pending'` only; `changes_required` gets a read-only "Awaiting creator resubmission" panel with prior feedback. Same class fixed on the revision side (`pending/[editId]/page.tsx`): `changes_required`/`approved`/`rejected` revisions get read-only states instead of dead Approve/Request-Changes buttons (not explicitly named by the reviewer, but identical failure mode against the same `resolveProductEdit` 409 rule — fixed proactively).

## Lead rulings

- **Merged rows**: `/products/<merged_into_id>` now shows an explicit "merged into another product" banner + link to the canonical product, detected from the row's own `status`/`mergedIntoProductId` (now available per I1's fix) — the photo manager and edit/moderate panels are hidden for a merged row (nothing left to correct).
- **Unsubmitted drafts**: `/products/pending/<draftEditId>` renders "not part of the moderation queue" and stops — no comparison, no actions. The API-level admin-read bypass (`pending-get.ts`) is unchanged (support/debugging).
- **`changes_required` new-product rows**: covered by I4 above.

## MODERATE

- **M1** — proxy `Content-Type` is now hardcoded `'image/webp'`, never passthrough.
- **M2** — `edit_base_stale` and `conflict` now get the same refresh affordance as `version_conflict` (new `isConflictCode()` helper in `action-result.ts`), on both `pending-actions.tsx` and `recovery-actions.tsx` — these are the realistic conflicts on the resolve/recover routes (they supply their own version token server-side).
- **M4** — age filter no longer hard-disables pagination (`nextCursorNew`/`nextCursorRevision` are real again); a note discloses the filter is page-scoped.
- **M5** — queue search params parsed via a small zod schema (`queueSearchParamsSchema.safeParse`), falling back to defaults instead of forwarding an unvalidated `status` to the API.
- **M6** — resolved by the "unsubmitted drafts" ruling above.
- **M7** — every mock response builder (`fullProductDto`, `fullProductWithReviewsDto`, `productRow`, `editListRow`, `creatorEditRow`, `editDetailRow`, the merge response) now `.parse()`s its own output against the real `@expyrico/shared` schema the corresponding upstream route actually returns, before returning it. This caught a real gap: the single-product `GET /v1/products/:id` route returns `productWithReviewsSchema` (with `topReviews`), not plain `productSchema` — the mock now has a dedicated `fullProductWithReviewsDto` for that one call site.
- **M8** — added: `version_conflict` refresh-affordance e2e path (double-save on direct correction), `edit`-kind proxy fetch (previously only `product`-kind was exercised), keyboard ↑/↓ reorder assertion (verifies the *actual* cover photo changes, not just that a button exists — this would have caught I2), invalid-`variant` and non-UUID-`parentId`/`photoId` 404s, and empty-response-body assertions on every 404 case.
- **M9** — `pnpm --dir apps/admin lint` is fully green. The `layout.tsx` warning is suppressed with a scoped `eslint-disable-next-line` and an explanatory comment rather than migrated to `next/font/google` — that migration is a real behavioral change (the CSS in `globals.css` references the font families by bare name, e.g. `'Inter'`, and would need updating to match whatever variable/class `next/font` generates, with visual-regression risk across every page), not a one-line fix, and remains out of this phase's scope.

## Required follow-up (already landed separately, restated here for completeness)

`apps/admin/playwright.config.ts` / `tests/e2e/admin-helpers.ts`: ports now derive from `ADMIN_E2E_PORT`/`ADMIN_E2E_MOCK_PORT` (commit `878e204`) — 4000/4001 are live production on this box, never a stale test server.

## Verification

- `pnpm --dir packages/shared build && test`: **pass**, 88/88 (2 new tests: `version`/`mergedIntoProductId` presence).
- `pnpm --dir api typecheck`: **pass**.
- `pnpm --dir apps/admin typecheck`: **pass**.
- `pnpm --dir apps/admin lint`: **pass** (fully clean, M9 resolved).
- `pnpm --dir apps/admin test` (unit): **pass**, 35/35.
- `pnpm --dir apps/admin build`: **pass**, all routes compile.
- e2e (`ADMIN_E2E_PORT`/`ADMIN_E2E_MOCK_PORT` overrides, 3 separate runs across this remediation): every new/changed capability passed at least once in isolation and in combination — photo reorder (keyboard-verified against actual cover-photo identity), photo removal to empty, edit-kind proxy, invalid variant/non-UUID 404s, cross-substitution 404, no-store/nosniff-on-404, anonymous-redirect, authenticated-bytes, merge (existing spec, unmodified logic). The final full-suite run (19 tests) hit 6 failures under genuinely heavy concurrent host load at the time (`uptime` load average 12–17 on this box, 6 other team-member agent processes active) — `Page crashed`, `ECONNRESET`, and multi-minute navigation timeouts on login-heavy tests.

  **Correction (see re-verification addendum below): the above paragraph's last sentence was wrong.** One of the 6 failures in that run — the `version_conflict` test — failed on a real assertion (`getByText(/refresh/i)` not found), not an environmental timeout. The test's premise was flawed, not just its assertion; see R1 below. That failure should not have been folded into the environmental-attribution paragraph, and doing so was inaccurate reporting on my part.

## Re-verification Addendum (reviewer-p6, `reviewer-p6-260730-phase-06-reverify.md`)

16 of 17 original findings confirmed fixed; re-verification surfaced 1 IMPORTANT regression, 2 MODERATE, 2 LOW, all fixed here:

- **R1 (IMPORTANT)** — the committed `version_conflict` e2e test passed for the wrong reason it would have exercised: a same-tab double-save is not a real conflict, because `patchProductAction`'s `revalidatePath` refreshes the RSC payload (and thus the `version` prop) after the first save succeeds, so a second save from the same page just succeeds again with a fresh token. Rewrote the test to induce a genuine out-of-band conflict: a direct `request.patch()` call (bypassing the UI entirely) bumps the product's version between page-load and the admin's own save, so the loaded page's token is verifiably stale when it submits. Verified passing (isolated, warm server): the refresh affordance appears, and the field still shows the failed edit's value, not a silently-retried write.
- **R1a** — corrected the verification paragraph above; the environmental-flakiness attribution never covered this test, and should not have been read as if it did.
- **R2 (MODERATE)** — stripped all `reviewer-p6 <code>` prefixes this remediation's commit had added to code comments (10 instances across `admin-api.ts`, `action-result.ts`, `recovery-actions.tsx`, `pending-actions.tsx`, `pending/[editId]/page.tsx`, `pending/page.tsx`, `layout.tsx`, `mock-store.ts`, `[id]/page.tsx`, `packages/shared/.../admin/products.ts`) per `.claude/rules/review-audit-self-decision.md` — comment bodies kept, only the labels removed. Pre-existing `I5:`/`M6:` labels from earlier phases in `api/src/routes/admin/products/patch.ts` and `packages/shared/.../admin/products.ts` (line 128, from commit `9e17ee82`, not this remediation) were left alone — out of this phase's scope, per the reviewer's own flagged question.
- **R3 (MODERATE)** — `pending/page.tsx`'s "Load more" links and `ModerationFilters` were still reading the raw, unvalidated `status` query param instead of the `safeParse`d one, so `?status=bogus` would silently query `pending` while the UI kept asserting `bogus`. Introduced `validatedStatus` (the sanitized, still-optional value) distinct from `status` (defaulted to `'pending'`, used only for the actual API query) so the two never diverge.
- **R4 (LOW)** — `recovery-actions.tsx`'s "Remove from selection" (a reversible client-side toggle — "Add" puts it straight back) no longer uses Alert Red (`text-expired`); switched to a neutral treatment. `text-expired` stays reserved for the real, destructive photo deletion in `product-photo-manager.tsx`.
- **R5 (LOW)** — `recovery-actions.tsx`'s Add/Remove/↑/↓ controls now all carry `disabled={pending}`, matching Rebase/Supersede.

## Round 3 Addendum (reviewer-p6, further addenda on `25b6f42`; commit `3c56baa`)

- **R6 (IMPORTANT, dist drift)** — the `adminProductRowSchema` change (this remediation) and dev-3's `8520c4c` (admin/system endpoint work) both recompiled `packages/shared` and broke the task #26 vendored-dist drift guard. Fixed via one `pnpm --dir packages/shared build && rsync -a --delete packages/shared/dist/ apps/mobile/local-packages/@expyrico/shared/dist/`, committed separately as `83c52f4` (split attribution noted in that commit body — both changes are covered by the single resync). Re-confirmed green just now, after all of this round's further edits: `node scripts/check-vendored-shared-dist.mjs` → `OK — vendored dist matches a fresh build of packages/shared.`
- **R7 (IMPORTANT, regression guards were vacuous)** — reviewer-p6 proved via pinned pre-fix/post-fix comparison that none of the 6 e2e tests added in this remediation actually exercise the I1/I2/I3 fixes: they pass identically on pre-fix code. Rather than rewrite the existing 6 (which cover other, genuinely-fixed behavior — see M8 above), added 2 new tests targeting exactly I1 and I2+I3, with new fixtures making each regression observable:
  - `merged product identity › a merged_into row renders itself...` — new fixture `FIXTURE.mergedLoserId` (status `merged_into`, own distinct name/description/version 4, target `activeProductId`). Asserts the row's own name renders (not the canonical product's), the merge banner and link are present, and the mutation UI (Save changes, Photos) is hidden.
  - `rebase order and cap › rebase submits exactly the reordered/capped selection...` — new fixtures `overflowProductId` (3 live photos, version 2) + `overflowStaleEditId` (baseProductVersion 1, 3 staged photos) — 6 total candidates, over the 5-cap. Asserts the default selection is capped at 5 (not 6), reorders one pair, rebases, then round-trips a fresh GET and asserts the *actually stored* `e.photos` order matches what was shown/reordered on screen and never includes the capped-out 6th candidate. This required making the mock's rebase handler in `mock-admin-handlers.ts` actually rebuild `e.photos` from the submitted `desiredPhotoOrder` (it was previously a no-op that only bumped version/status) and enforce the 5-cap server-side — otherwise there was nothing for a round-trip GET to disprove.

  **Per-test pre-fix/post-fix proof** (deliberate simplification of reviewer-p6's fuller git-archive method: only 2 files carry the fixes these 2 tests target, so a targeted `git show a620dc9^:<path>` revert of just those 2 files is sufficient and unambiguous):
  1. Saved post-fix `page.tsx` and `recovery-actions.tsx` to `/tmp/r7-proof/`.
  2. Overwrote both with their pre-fix (`a620dc9^`) content via `git show a620dc9^:<path> > <path>`.
  3. Ran both new tests against the pre-fix working tree: **both FAILED** — `merged product identity` failed at `getByText(/merged into another product/i)` (banner doesn't exist pre-fix); `rebase order and cap` failed at `getByText('Selected (5/5)')` (pre-fix `recovery-actions.tsx` has no cap/valid-default logic).
  4. Restored the post-fix content from the saved snapshots; `git diff --stat` confirmed an exact match against HEAD (zero diff).
  5. Re-ran both tests: **both PASSED** — `✓ merged product identity ... (6.1s)`, `✓ rebase order and cap ... (16.6s)`.

  This empirically confirms both new tests are real regression guards for I1 and I2/I3, per reviewer-p6's own probe descriptions.
- **R8 (MODERATE, `isConflictCode` only wired into 2 of 5 surfaces)** — wired `isConflictCode` (previously only in `pending-actions.tsx`/`recovery-actions.tsx`) into the 3 remaining conflict-handling call sites: `product-actions.tsx` (was a bare `result.code === 'version_conflict'` check), `merge-tool.tsx` (same), `product-photo-manager.tsx` (both the reorder and remove handlers). Verified via `grep -n "isConflictCode\|version_conflict ==="` across all 5 files — no remaining bare `'version_conflict'` comparisons.
- **R9 (IMPORTANT, self-inflicted regression)** — the approve-confirmation `window.confirm()` added earlier in this remediation (I4-adjacent) broke the pre-existing "approving a healthy revision returns to the queue" test: Playwright auto-dismisses unhandled dialogs, so the confirm silently returned `false` and the approve action never ran, leaving the test waiting on a navigation that would never happen. Fixed by adding `page.once('dialog', (d) => d.accept())` immediately before that test's `Approve` click — the same dialog-handling class of mistake as the pre-existing merge-tool/photo-remove confirms, which do handle it correctly in their own specs.
- **Housekeeping** — deleted the untracked scratch `apps/admin/playwright.config.dev2-scratch.ts` and its associated `/tmp/r7-proof/` scratch snapshots before committing; killed the scratch dev/mock-API server processes that had been running on ports 4841/4939.

### Incidental fixture bug found during this round's final gate (out of R1–R9 scope, fixed anyway)

Running the full e2e suite for this round's gate surfaced a deterministic failure in `merge-product.spec.ts` (`admin merges a duplicate product into the winner`), unrelated to R6–R9: the winner/loser fixture products had different barcodes (`DUP-0001` vs `DUP-0002`), which trips the merge route's own identifier-conflict guard (`"Merge blocked: the source and target have different barcode values..."`) and blocks the merge before it can complete. Confirmed pre-existing and unrelated to this round's changes by reproducing it identically against a `git stash`-clean tree at `HEAD` (`81eac84`), and confirmed via `git show c6019ca:...` that the mismatched barcodes have been in the fixture since Phase 6's very first commit — this happy-path test has apparently never passed. Fixed by aligning the loser's barcode to the winner's (duplicate listings of the same real-world product should share a barcode; there is no existing test coverage of the identifier-conflict path itself, so nothing was lost). Re-ran in isolation: **pass**. Included in commit `3c56baa`.

### Verification (this round)

- `node scripts/check-vendored-shared-dist.mjs`: **pass** (re-confirmed after all edits, before commit).
- `pnpm --dir packages/shared test`: **pass**, 88/88.
- `pnpm --dir apps/admin typecheck`: **pass**.
- `pnpm --dir apps/admin lint`: **pass**.
- `pnpm --dir apps/admin test` (unit): **pass**, 35/35.
- `pnpm --dir apps/admin build`: **pass**, all routes compile (required clearing a stale `.next/cache` left over from a concurrently-running scratch dev server on this box — a local tooling artifact, not a code issue).
- e2e, full suite, isolated per-test status (`ADMIN_E2E_PORT=4750`/`ADMIN_E2E_MOCK_PORT=4751`, fresh cold-start servers, `--workers=1`, `product-moderation.spec.ts` + `merge-product.spec.ts`, 22 tests total): **all 22 passed** (`test-results/.last-run.json`: `"status": "passed", "failedTests": []`). No blanket environmental attribution needed this run — every test's pass/fail was checked individually; the only non-assertion noise was pre-existing dev-server console warnings (missing static logo assets, one `ECONNRESET` on a background image request) that did not fail any test.

Commit: `3c56baa` (R7/R8/R9 + incidental barcode fixture fix). R6's resync was committed separately as `83c52f4`.
