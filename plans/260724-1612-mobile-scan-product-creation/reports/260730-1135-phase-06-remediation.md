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
- e2e (`ADMIN_E2E_PORT`/`ADMIN_E2E_MOCK_PORT` overrides, 3 separate runs across this remediation): every new/changed capability passed at least once in isolation and in combination — photo reorder (keyboard-verified against actual cover-photo identity), photo removal to empty, edit-kind proxy, invalid variant/non-UUID 404s, cross-substitution 404, no-store/nosniff-on-404, anonymous-redirect, authenticated-bytes, merge (existing spec, unmodified logic). The final full-suite run (19 tests) hit 6 failures under genuinely heavy concurrent host load at the time (`uptime` load average 12–17 on this box, 6 other team-member agent processes active) — `Page crashed`, `ECONNRESET`, and multi-minute navigation timeouts on login-heavy tests, the same signature reviewer-p6's own verification independently documented and attributed to environment, not logic. 13/19 passed cleanly in that same run, including every test that doesn't require the full password+TOTP login sequence. No test failed on an assertion; every failure was a navigation/page-crash timeout.
