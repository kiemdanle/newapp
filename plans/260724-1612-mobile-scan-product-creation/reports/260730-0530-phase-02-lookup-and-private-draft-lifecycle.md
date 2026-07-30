# Phase 2 Implementation Report — Lookup and Private Draft Lifecycle

## Executed Phase
- Phase: phase-02-lookup-and-private-draft-lifecycle
- Plan: plans/260724-1612-mobile-scan-product-creation
- Status: completed
- Commit: `4e29c39 feat(products): add private draft lifecycle`

## Plan Approval
Sent implementation plan to team-lead before coding; approved with 3 conditions,
all applied:
1. Barcode fallback: attempt all sources regardless of one being unavailable;
   `found` always wins; `temporarily_unavailable` only when nothing was found
   AND some source was unavailable; `not_found` only when every source
   conclusively missed. (Not an immediate short-circuit as I'd originally
   proposed.)
2. Idempotency in-flight reservation: bounded wait (40ms poll / 2s deadline);
   on timeout while the reservation still exists, return a retryable 409
   (`idempotency_in_progress`) rather than re-executing — re-executing could
   race a still-alive original holder. Only a *vacated* reservation (TTL/crash)
   lets the new request become executor.
3. Confirmed legacy-lookup scope (active-only visibility + skip backfill on
   private short-circuit only), admin/reports/resolve.ts no-op finding,
   unconditional submit-disabled, legacy create always `upgrade_required`,
   `canCreate:false` everywhere, and `idempotency_key_reused` as a literal
   string code (no shared-package edit).

## Files Created
- `api/src/services/products/product-visibility.ts` — `getVisibleProduct`,
  `assertProductUse` (central read/use authorization).
- `api/src/services/products/product-drafts.ts` — `createOrResumeDraft`,
  `patchDraft`, `submitDraft` (feature-disabled), `listDrafts`.
- `api/src/routes/products/{lookup-v2,drafts,draft-update,submit}.ts`.
- Tests: `api/src/services/products/lookup.test.ts` (unit, 27 cases);
  `api/tests/integration/{products-visibility,product-use-authorization,
  products-draft-lifecycle,products-report-autohide}.test.ts`.

## Files Modified
- `api/src/plugins/idempotency.ts` — actor-bound atomic Lua reserve-or-read,
  bounded wait, 409 on hash mismatch / still-in-flight timeout, release
  reservation on 5xx.
- `api/src/services/products/{off-client,upcitemdb-client}.ts` — explicit
  `{status:'found'|'not_found'|'unavailable'}` outcomes; 404→not_found,
  breaker-open/timeout/5xx→unavailable (fallback), unparseable-but-not-clearly-
  missing payload→unavailable (never fabricate a conclusive miss).
- `api/src/services/products/lookup.ts` — `findLocalExact` shared helper;
  `lookupProduct` (legacy) returns `{product, privateReservation}`;
  `lookupProductV2` full classification; `persistExternal` race-safe
  (transaction re-read, never overwrites `source:'user'`/non-active rows, P2002
  recovery via fresh read after rollback).
- `api/src/routes/products/lookup.ts` — active-only local visibility, skips
  external call/backfill on a private short-circuit only.
- `api/src/routes/products/get.ts` — uses `getVisibleProduct`.
- `api/src/routes/products/create.ts` — always `410 upgrade_required`.
- `api/src/routes/{records/create,records/patch,records/duplicate,reviews/create,
  deals/create,giveaways/create}.ts`, `api/src/services/records/sync.ts` — call
  `assertProductUse`; patch/sync wrap the check + write in one transaction
  (scope-transition races); sync catches the rejection per-item (drops that
  item silently, same as its existing membership-drop pattern) instead of
  failing the whole batch.
- `api/src/services/reports/repository.ts` — product auto-hide writes
  `report_hidden`, never legacy `pending`.
- `api/src/routes/products/index.ts` — registers the 4 new routes.

## Tasks Completed
- [x] Task 1: idempotency hardening (11 tests: same-body replay, cross-user
      isolation, concurrent-once, 5xx-not-cached, mismatch→409, abandoned
      vacate→fresh retry, still-in-flight→retryable 409, TTL).
- [x] Task 2: explicit source/local-visibility outcomes; legacy active-only;
      v2 full classification incl. admin/report_hidden/merged edge cases.
- [x] Task 3: `getVisibleProduct`/`assertProductUse` wired into every listed
      writer + detail route; offline-sync batch and household PATCH-move
      matrices covered.
- [x] Task 4: create/resume/patch/list lifecycle with server-rechecked
      conclusive miss, race translation, cursor pagination (reused Phase 1
      `encodeCursor`/`decodeCursor`); submit unconditionally feature-disabled
      (no stub-accept); legacy create direct-call regression.
- [x] Task 5: full focused suites + `pnpm test` (full API suite) + typecheck,
      commit.

## Tests Status
- Typecheck: clean (`pnpm --dir api typecheck`).
- Full API suite: **558/558 pass, 88 files**, run twice consecutively clean.
- New/changed test files: idempotency (11), products-lookup (19),
  lookup.test.ts unit (27), products-visibility (14), product-use-authorization
  (20), products-draft-lifecycle (23), products-report-autohide (3),
  products-create (5), admin/reports (regression case added).

## Issues / Deviations
- **admin/reports/resolve.ts**: per team-lead's approval, left functionally
  unchanged — it has no product-status write path at all (only `maybeAutoHide`
  did), so there was nothing to switch to `report_hidden`. Added a regression
  test instead of a forced no-op edit.
- **Environment flakiness during verification** (not a code defect): the
  shared `pantry_test` Postgres/Redis and shared dev VM show real, escalating
  cross-test contamination under concurrent multi-agent load — three
  consecutive full-suite runs showed 8, 48, then 2 unrelated failures (files
  I never touched: sessions, score-recalc-worker, admin/system-settings,
  admin/users) before stabilizing to two consecutive clean 558/558 runs once
  load subsided. Root-caused one of my own draft-lifecycle test failures
  earlier in this same investigation to a genuine **pre-existing** test-infra
  quirk (confirmed reproducible on the *original, unmodified* `git show
  HEAD:api/tests/integration/products-lookup.test.ts`): a module's eager
  `getConfig()` call can cache a wrong `JWT_ACCESS_SECRET` when a `vi.doMock +
  vi.resetModules() + dynamic import` file is run **alone/first**, before
  `tests/helpers/setup.ts`'s raw top-level env-loading code has run; it
  self-heals once any earlier file in the same process has primed
  `process.env`, so it never surfaces in a full-suite run. Not something I
  introduced or fixed (out of my file ownership); flagging for whoever owns
  test infra, since it will bite the next person who runs one of these mocked
  files in isolation as their very first/only file.
- `api/.env.test`'s committed `DATABASE_URL` still points at shared `pantry`,
  not `pantry_test`, per dev-1's Phase 1 note — did not commit my local
  repoint (already present from a prior session, left as-is, not staged).
- Confirmed no `prisma migrate` command was run against any DB; migration B
  remains untouched/unapplied.

## Success Criteria (phase file)
- [x] Installed clients retain legacy lookup semantics (envelope unchanged for
      active/miss/error) until intentionally retired.
- [x] V2 distinguishes visible/creator-private/non-disclosing under-
      review/full-miss/unavailable.
- [x] Full miss never queues backfill; draft create independently reconfirms
      eligibility via a fresh `lookupProductV2` call.
- [x] Idempotency cannot replay private responses across actors/bodies or
      double-execute concurrently (Lua-atomic reserve, actor-scoped key).
- [x] Every listed product FK writer enforces active/submitted-creator-personal
      policy, including record PATCH scope transitions and offline sync.
- [x] Legacy create cannot bypass moderation (always `upgrade_required`, no
      insert, in every `product_creation` mode value).
- [x] Draft mutation/submission enforce ownership and state; submission is
      blocked outright pending Phase 7 (no stub-accept).

## Next Steps
- Phase 3 depends on this: `getVisibleProduct`/`assertProductUse` are the
  authorization primitives its media-delivery routes should call.
- Phase 4 depends on this for the visibility/draft-lifecycle contracts it
  builds moderation on top of.
- Phase 7 must implement `assertProductCreationEligible`, wire it into
  `createOrResumeDraft`/`patchDraft`/(future) photo routes, replace
  `submitDraft`'s unconditional 403 with real abuse-token verification +
  transition to `pending`, and supply real `canCreate` values to lookup-v2.
- Flagging the shared-DB/VM contention and the pre-existing config-cache test
  quirk above for whoever owns team test infrastructure; no action taken by me
  since neither is in this phase's file ownership.

Status: DONE
Summary: Phase 2 complete — hardened idempotency, lookup v2 with non-disclosing outcomes plus active-only legacy lookup, creator-private draft create/resume/patch/list (submit intentionally feature-disabled), and centralized product-use authorization across every listed writer; full 558-test API suite green twice, typecheck clean, committed.
Concerns/Blockers: None blocking. Two environmental notes documented above (shared test-DB/VM contention under concurrent multi-agent load; a pre-existing, unrelated getConfig-caching test-infra quirk visible only when certain mocked files run alone/first) — informational only, not Phase 2 defects, not in this phase's file ownership.
