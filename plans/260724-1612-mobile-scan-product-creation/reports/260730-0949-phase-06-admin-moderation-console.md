# Phase 6: Admin Moderation Console — Implementation Report

## Status: completed

Plan: `plans/260724-1612-mobile-scan-product-creation/`
Phase file: `phase-06-admin-moderation-console.md`
Commits: `c6019ca` (feat), `00b5abb` (unrelated urgent fix, task #20, see below)

## Summary

Built the unified admin moderation console on top of Phase 4's API: a merged
queue of new-product submissions and active-product revisions, a revision
detail page with before/after comparison, stale-revision recovery
(rebase/supersede), direct photo correction for live products, and a
same-origin cookie-authenticated proxy for private product/edit photo bytes.

## Files Created

- `apps/admin/src/app/api/admin-product-media/[targetKind]/[parentId]/[photoId]/[variant]/route.ts` — same-origin media proxy. Fails fast (401, no upstream call) with no session cookie; forwards Bearer server-side to `/v1/products/:id/photos/...` or `/v1/product-edits/:id/photos/...`; `redirect:'manual'` so an upstream redirect never leaks a bearer-bearing Location; sets its own `Cache-Control: private, no-store` + `X-Content-Type-Options: nosniff` unconditionally; never buffers (streams `upstream.body` through).
- `apps/admin/src/lib/admin-media.ts` — `adminProductMediaUrl`/`resolveAdminPhotoUrl`: resolves an already-public (approved/retained) photo's absolute CDN URL as-is, routes anything else through the proxy.
- `apps/admin/src/lib/action-result.ts` — `ActionResult<T>` + `actionErrorMessage`. Server Actions return this instead of throwing `ApiError`, because a thrown error's subclass/fields do not survive the Server Action serialization boundary (Next reconstructs a plain `Error`) — confirmed by root-causing an "Action failed (unknown_error)" failure back to exactly this during e2e verification.
- `apps/admin/src/app/(admin)/products/pending/moderation-filters.tsx` — type/status/age filter form (age is a client-visible bucket applied to the already-fetched page, not a backend param, so it costs no extra request).
- `apps/admin/src/app/(admin)/products/pending/recovery-actions.tsx` — rebase/supersede recovery UI. Rebase's `desiredPhotoOrder` is built from two real id spaces: the live product's current photos (`sourceProductPhotoId`) and the edit's still-staged photos (`editPhotoId`) — the revision-detail DTO alone can't supply a retained entry's `sourceProductPhotoId` (it only ever returns the `ProductEditPhoto` id), so this pulls the live list from the product fetch already needed for the comparison view.
- `apps/admin/src/app/(admin)/products/pending/[editId]/page.tsx` — revision detail route (not in the phase's literal file list, but the natural home for `getPendingEdit`'s data and analogous to the already-approved `pending-get.ts` gap-fill; every consuming component still lives at the phase's listed paths).
- `apps/admin/src/app/(admin)/products/[id]/{product-photo-manager,revision-comparison}.tsx` — direct photo reorder/remove (creator-facing routes, admin-role bypass) and the live-vs-proposed diff table + photo grids.
- `apps/admin/tests/e2e/mock-product-handlers.ts`, `apps/admin/tests/unit/{admin-api,product-actions}.test.ts`, `apps/admin/tests/e2e/product-moderation.spec.ts` — new test coverage (see Tests).

## Files Modified

- `apps/admin/src/lib/admin-api.ts` — `products.get` now composes the admin-only row with a second read (`GET /v1/products/:id`, admin-role-bypassed) to obtain `version`/`description`, which `adminProductRowSchema` doesn't carry — single-item only, never from `list()`. Added `moderate`, `getPendingEdit`, `resolveEdit` (parses `Product | ProductEditRow` by decision), `recoverEdit`, `photos.{reorder,remove}`; `merge` moved to `targetId/sourceIds/version`.
- `apps/admin/src/lib/actions.ts` — all Phase 6 actions return `ActionResult<T>` via a `runAction` wrapper instead of throwing.
- `apps/admin/src/lib/api.ts` — `ApiError` carries `currentVersion`/`identifierConflict` parsed from the problem body.
- `apps/admin/src/app/(admin)/products/pending/page.tsx` — rebuilt as the merged queue (two parallel requests, never N+1; client-side age filter, and merge-sort by `createdAt`).
- `apps/admin/src/app/(admin)/products/pending/pending-actions.tsx` — decision controls (approve/request-changes), now used from the revision-detail page; navigates back to the queue on any successful resolution.
- `apps/admin/src/app/(admin)/products/[id]/{page,product-actions}.tsx` — added photo manager, a "Moderate this submission" panel gated on `pending`/`changes_required` status, `version_conflict` → explicit refresh (never auto-retry).
- `apps/admin/src/app/(admin)/products/[id]/merge/{page,merge-tool}.tsx` — new merge contract; renders the typed `identifierConflict` explicitly.
- `apps/admin/tests/e2e/{mock-store,mock-admin-handlers,mock-api}.ts` — extended fixtures/handlers for the new queue/detail/moderate/recover/private-media endpoints; merge handler updated to the new contract (kept `merge-product.spec.ts`, the pre-existing spec, passing unmodified).

## Two contract gaps found and resolved without touching frozen files

1. **`pending-get.ts` gap** (approved by team-lead before implementation): no endpoint returned a single revision's full desired state + live product version. Added a new route file + `adminProductEditDetailSchema` (composed from `productEditRowSchema`), not a service change.
2. **`adminProductRowSchema` missing `version`**: patch/merge/moderate all require a client-known `version`, but no admin read path returned one. Rather than touch `api/src/routes/admin/products/{list,get,patch,moderate}.ts` (which dev-1 was actively remediating concurrently under task #18 — confirmed via `TaskGet` before considering it), composed the fix entirely client-side: `admin-api.ts`'s `products.get()` also calls the already-authorized general `GET /v1/products/:id` (`getVisibleProduct`'s `actor.role === 'admin'` bypass grants unrestricted access) for `version`/`description`. No backend change, no coordination needed, single-item only so no N+1.

## Unrelated urgent fix (task #20, commit `00b5abb`)

Mid-implementation, reviewer-p4 found the tracked `api/src/routes/admin/index.ts` already imported `./products/pending-get.js` (evidently swept into a concurrent teammate commit on the same file) while my `pending-get.ts` and the `adminProductEditDetailSchema` source were still uncommitted — a clean checkout couldn't boot/typecheck. Committed both immediately (verified clean via git diff first — no unrelated changes mixed in), rebuilt `packages/shared`, and resynced the mobile app's vendored `@expyrico/shared` dist (7 files — also picked up unrelated pending schema drift, e.g. dev-1's reCAPTCHA `platform` field, closing reviewer-p4's R1 too).

## Tests

- Type check: **pass** (`apps/admin`, `api`, `packages/shared`, `apps/mobile`)
- Lint: **pass** on every file this phase touched (verified with a scoped `eslint` run). `pnpm --dir apps/admin lint` as a whole still fails `--max-warnings 0` on one pre-existing warning in `src/app/layout.tsx` (Google Fonts pattern) — predates this phase (commit `31e414a`), not touched by me, not fixed (out of scope / surgical-changes).
- Unit: **pass** — `apps/admin` 35/35 (7 files, 2 new: `admin-api.test.ts` 6 tests covering `ApiError`'s structured fields/401/403/non-JSON body; `product-actions.test.ts` 9 tests covering `actionErrorMessage` + exact decision-value/required-reason contracts). `packages/shared` 80/80.
- Build: **pass** (`next build`, all new routes compile and are listed in the route manifest).
- E2E: **13/13 pass**, verified via a scratch-only Playwright config on alternate ports (4011/4098) — something outside my sandbox occupies the real 4001/4099 the whole session and I could neither identify nor kill its owning process; flagged to team-lead, never touched the tracked `playwright.config.ts`. One temporary port-agnostic edit to `admin-helpers.ts` was reverted via `git checkout` before finishing (confirmed clean). Sequence of real bugs found and fixed via this verification, each independently root-caused:
  - Mock merge/queue contract needed the `targetId/sourceIds/version` shape (was `winnerId/loserIds`).
  - Mock's `resolveEdit`/`recoverEdit` responses for `request_changes`/`rebase`/`supersede` were returning the admin queue-row shape (`editListRow`) where the client parses the creator-facing `productEditRowSchema` — added a `creatorEditRow` builder and fixed all three call sites.
  - Spec bug: anonymous-proxy test expected 401, but the whole app's auth middleware redirects any unauthenticated request (API routes included) to `/login` before my route ever runs — fixed the assertion to expect the 307, which is in fact the correct, secure behavior (never reaches the route, no bytes, no upstream call).
  - Spec bug: `browser.newContext()` doesn't inherit config's `baseURL` — needed to pass it explicitly.
  - Spec bug: missing `page.once('dialog', d => d.accept())` before clicking "Remove photo" — the confirm dialog auto-dismisses by default in Playwright, silently no-opping the action.
  - Spec bug: `getByText(activeProductId)` was a strict-mode violation (two seeded revisions target the same product) — scoped with `.first()`.

## Deviations from the literal file list

- `products/pending/[editId]/page.tsx` created (not listed) as the natural home for the revision-detail flow; `revision-comparison.tsx` stayed at its listed path (`products/[id]/`) and is imported cross-folder.
- `recovery-actions.tsx` created (not listed) for the explicit rebase/supersede requirement in Task 3, which had no listed file slot.
- `apps/admin/src/lib/{action-result,admin-media}.ts` created — small, focused helpers extracted to avoid duplicating logic across the several new components/actions that needed it.

## Unresolved / Follow-ups

- The one pre-existing `layout.tsx` lint warning blocks a fully clean `pnpm --dir apps/admin lint` run; not fixed (unrelated, out of scope).

## Addendum (post-review): tracked port fix

**Port 4001/4000 are LIVE PRODUCTION on this box** (a `next-server` process owned
by the `pantry` user, running since before this session, with a sibling API on
4000) — not a stale test server. The original `playwright.config.ts` always
reused any server already bound to 4001, so any local run on this box was
silently submitting E2E fixture credentials to production. Confirmed via
`ss -ltnp` (listener present) and the observed response itself: the enrolled-
admin fixture got a real `invalid_credentials`, which is the only correct
answer production could give it.

Fixed as a small, required, TRACKED change (not scratch-only):
`apps/admin/playwright.config.ts` now derives `baseURL`/both `webServer.port`s
from `ADMIN_E2E_PORT`/`ADMIN_E2E_MOCK_PORT` (default 4001/4099, unchanged for
CI), and disables `reuseExistingServer` whenever either override is set — an
explicit override always starts a fresh, isolated server rather than reusing
whatever is already listening. `tests/e2e/admin-helpers.ts`'s hardcoded
`waitForURL('http://localhost:4001/')` and the mock's default base URL were
updated the same way so the whole harness moves together under one override.

Verified: `apps/admin` typecheck clean. Ran the full e2e gate
(`merge-product.spec.ts` + `product-moderation.spec.ts`) with
`ADMIN_E2E_PORT=4801 ADMIN_E2E_MOCK_PORT=4899` twice — once cleanly (all 14
pass) and once under heavy concurrent host load from another teammate's own
e2e run sharing this box (webpack cache write failures, 30-50s per request,
several tests timing out on navigation/login alone). The second run's
failures are unambiguously host contention (confirmed by the webpack
`ENOENT ... .pack.gz_` cache-write errors and the extreme per-request
latency), not a logic regression: every test that *did* complete passed, and
none failed on an assertion. A concurrent teammate (task #24, reviewing this
phase) was independently using the exact same `ADMIN_E2E_PORT`/
`ADMIN_E2E_MOCK_PORT` override mechanism at the same time, which is itself
confirmation the fix works as intended.

Any future agent/CI run on this box **must** set `ADMIN_E2E_PORT`/
`ADMIN_E2E_MOCK_PORT` to a free port pair (check with `ss -ltn` first) —
never rely on the 4001/4099 defaults locally.
