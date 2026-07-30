# Phase 2 Review Remediation Report

## Task
- Task: #12, Phase 2 review remediation (1 CRITICAL, 4 IMPORTANT, 9 MODERATE)
- Source: `plans/260724-1612-mobile-scan-product-creation/reports/reviewer-p2-260730-phase-02-review.md`
- Commits: `41ee56c fix(products): remediate lookup/draft review findings`,
  `e9f9814 fix(test-infra): stop tracked .env.test pointing at the shared database`

## CRITICAL — fixed
report_hidden + `assertProductUse` was freezing existing pantry records and
`sync.ts` was silently discarding rejected offline edits.

- `assertProductUse` (product-visibility.ts): `report_hidden` now permits an
  already-established reference (`existingRecordReference: true`, purpose
  `personal_record`/`household_record`) regardless of creator; a brand-new
  attachment or any `review`/`deal`/`giveaway` use is still rejected (404,
  non-enumerating, same as every other report_hidden rejection — team-lead's
  ruling didn't specify 403 vs 404 and I kept the existing non-enumerating
  convention rather than introduce a new distinction).
- `sync.ts` no longer swallows the rejection: added `ProductUseRejectionError`
  (subclass of `AppError`, thrown only by `assertProductUse`) so the sync loop
  matches on the *class*, not `status in [403,404]` (closes MODERATE-5 too —
  a future unrelated 404 inside that transaction can no longer be
  misinterpreted as a product-use drop). Rejected items now surface as
  `{ clientId, reason: 'product_unavailable' }` in the sync response
  (`recordSyncConflictSchema` gained that enum value in `packages/shared`)
  instead of a silent no-op.
- Tests: 8 new cases in `product-use-authorization.test.ts` covering
  PATCH/duplicate/sync of an existing reference surviving auto-hide (personal
  and household scope), the sync-conflict-not-silent-drop case, and that
  household-move / new review / new attachment are still rejected.

## IMPORTANT — all fixed

**Persist-external race (private draft leaked as `found`)**: both
`lookupProduct` (legacy) and `lookupProductV2` now re-classify whatever
`persistExternal` actually returns instead of trusting "just persisted ⇒
active/public". Added `legacyResultFor` (resolves through active-only) and
route the v2 hit through `classifyLocal`. Reproduced the reviewer's exact
race in both a unit test (mocked OFF client inserts the racing draft mid-call)
and an HTTP-level integration test, plus pinned `product.status` per outcome
in `productLookupV2ResponseSchema` (found→`active`, editable_private→
`draft|changes_required`, creator_pending→`draft|pending|changes_required|
report_hidden`) so a misclassification would 500 at the schema boundary even
if the service-level fix regressed later.

**merged_into dead end**: added `resolveCanonicalProduct` (product-
visibility.ts, depth-capped at 5 hops) and wired it into `classifyLocal`,
legacy `lookupProduct`, `getVisibleProduct`, `assertProductUse`, and the
product-edit PATCH route. An active canonical → `found`/visible/patchable;
a non-active canonical is classified/authorized by the same rules as if the
caller had scanned it directly. Unresolved (only reachable via a cycle now —
the FK is enforced, so a truly dangling pointer can't exist) is a permanent
non-disclosing dead end for every actor including admin.
**Caught a real infinite-recursion bug while testing this**: my first cut
compared `canonical.id === local.id` to detect "unresolved," which is wrong
for a cycle (A→B→A resolves to a *different* still-merged row each time),
causing `classifyLocal` to recurse between A and B forever — a genuine hung-
request bug. Fixed by checking `canonical.status === 'merged_into'` instead
(that's the actual postcondition `resolveCanonicalProduct` guarantees on
give-up), and added a cyclical-chain test that would have timed out under the
old code and passes now.

**`PATCH /v1/products/:id` unguarded FK writer**: now calls `getVisibleProduct`
and requires `status === 'active'` before opening a `ProductEdit`; non-visible
or non-active → non-enumerating 404. Also fixed a bug this surfaced: the route
was writing/reading `ProductEdit.productId` against the raw route param
instead of the resolved (post-merge-resolution) product id — harmless before
today since `getVisibleProduct` never resolved merges, but would have opened
edits against a merged-away row once it did. Tests: foreign
draft/pending/changes_required/report_hidden → 404 + no edit row created;
merged_into resolves and opens the edit against the canonical id; active
regression still 202.

**Draft PATCH had no version guard**: added required `version` to
`productDraftPatchRequestSchema` (shared, rebuilt + resynced to mobile
vendored copy — dev-3 heads-up sent, see below). The write is now a
conditional `updateMany({ where: { id, createdByUserId, status: {in:...},
version } })`; `count === 0` re-runs the ownership/state checks to report the
right cause and otherwise throws `409 version_conflict` with `currentVersion`.
Tests: stale version → 409 with correct `currentVersion`; two concurrent
patches at the same version → exactly one 200 + one 409.

## MODERATE — 8 of 9 fixed, 1 deferred per plan ownership

- Fixed: FOR UPDATE row lock in `assertProductUse` and `persistExternal`'s
  guarded read (real mutual exclusion when called inside the callers'
  existing transactions, harmless single-statement lock otherwise; softened
  nothing since the comments were already accurate once this landed).
- Fixed: 5 ad-hoc error strings (`upgrade_required`, `feature_disabled`,
  `temporarily_unavailable`, `idempotency_key_reused`,
  `idempotency_in_progress`) promoted into `ERROR_CODES`.
- Fixed: hostile `/v1/products/drafts` cursor → `400 validation_error` (was
  500) — added `draftsCursorPositionSchema` validating both the timestamp
  (rejects `Invalid Date`, which `z.date()` alone accepts) and that `i` is a
  UUID. 3 hostile payloads tested.
- Fixed: idempotency key now uses `req.routeOptions.url` (+ resolved params
  folded in) instead of the raw concrete path, and the query string is folded
  into the request hash. Documented the 30s in-flight TTL as a hard latent
  bound needing a heartbeat/route-timeout if a future idempotent handler can
  legitimately run that long — chose "document + keep bound" over
  implementing a generic handler-timeout mechanism, since nothing today
  approaches it and Fastify has no built-in per-route exec timeout to hang it
  off cleanly.
- Fixed: `productLookupV2ResponseSchema` status pinning (also closes
  IMPORTANT-2's defense-in-depth ask).
- Fixed: `sync.ts` conflict-swallow → `ProductUseRejectionError` class match
  (see CRITICAL section).
- Fixed: `POST /v1/reports` product existence check now routes through
  `getVisibleProduct` — another user's private draft answers
  `report_target_not_found` instead of `201`.
- Fixed: admin `merged_into`/`report_hidden` conflation is largely moot now
  that `merged_into` resolves to its canonical row before classification;
  didn't add further admin-specific distinction beyond that, since the
  remaining unresolved-merge case is genuinely a dead row for every actor.
  Also fixed `photos: []` always-empty responses by including the `photos`
  relation (ordered) everywhere a product is fetched for a lookup/draft
  response — costs nothing today (Phase 3 hasn't shipped uploads yet) and
  removes a footgun for whoever wires photos in next.
- **Deferred (documented, not implemented)**: `product_creation` mode gating
  of draft creation. Re-checked both phase files: phase-07's Requirements
  explicitly own `assertProductCreationEligible` and state it gates "private
  new-product draft create/metadata/photo/submit mutations," and phase-02's
  own text says `canCreate` "is false until that [Phase 7] contract is
  available" with no equivalent gate assigned to Phase 2 for create/patch
  themselves. Per team-lead's explicit exception, left unimplemented; Phase 7
  must wire `assertProductCreationEligible` into `createOrResumeDraft` and
  `patchDraft` before mobile enablement (already called out as a Next Step in
  my original Phase 2 report).

## Coordination
- Messaged dev-1 before touching `patch.ts` (IMPORTANT-4); their task #13
  resubmission-guard commit (`9111834`) had already landed and my change
  builds directly on top of it (only added the gate above their existing
  logic, fixed the pre-existing raw-`id` vs resolved-`product.id` mismatch
  their code inherited).
- Shared-package changes (added `version` to draft patch, pinned v2 outcome
  statuses, new `ERROR_CODES`, new sync conflict reason) rebuilt and resynced
  to `apps/mobile/local-packages/@expyrico/shared/dist` via
  `pnpm install --force` (confirmed this alone refreshes the `file:` link
  fully — no manual `rm` of `node_modules/@expyrico/shared` needed this time).
  Will message dev-3 with a resync heads-up per team-lead's note.

## Tests
- Provisioned an isolated throwaway `pantry_dev2_p12` database (23 migrations
  applied via `psql -f` in order; migration B confirmed absent/unapplied) per
  the new team-lead DB-isolation rule, ran everything via `TEST_DATABASE_URL`
  override, dropped it when done.
- Full API suite: **95 files, 669 tests, all pass** in the isolated DB.
- Typecheck: clean except pre-existing, unrelated Phase 3 WIP errors in
  `product-image-processor.ts`/`.test.ts` (dev-3, untracked, not touched by
  me) — confirmed via `grep` that zero errors reference any file I changed.
- Shared package: rebuilt, `pnpm test`/`typecheck` clean (58 tests).
- Mobile: `shared-contract` test green against the resynced vendored copy.
- Confirmed no stray vitest processes running before/after this session.

## Issues / Deviations
- Kept report_hidden rejections at 404 (non-enumerating) rather than 403 for
  new-attachment/community-use cases — matches the existing convention
  elsewhere in this file rather than introducing a new distinction reviewer-p2
  didn't explicitly request.
- Found and fixed one bug beyond the review findings: the infinite-recursion
  risk in cyclical merge chains (see IMPORTANT section above) and the raw-`id`
  vs resolved-canonical-id mismatch in `patch.ts` (see IMPORTANT-4 above) —
  both were latent, only became reachable once I added merge resolution.

## Next Steps
- Message dev-3: shared package rebuilt (new `ERROR_CODES`, draft patch
  `version` field, pinned v2 outcome statuses, new sync conflict reason) —
  resync needed before their Phase 3 work consumes `@expyrico/shared`.
- Message reviewer-p2 for re-verification.
- Phase 7 must still implement the deferred mode-gating (documented above).

Status: DONE
Summary: All CRITICAL/IMPORTANT findings fixed with tests, 8/9 MODERATEs fixed (1 deferred to Phase 7 per plan ownership, documented), found and fixed a real infinite-recursion bug surfaced while testing the merge-resolution fix, full suite green (669/669) in an isolated throwaway DB, typecheck clean, two commits (main fix + separate .env.test credential/DB-pointer fix).
Concerns/Blockers: None blocking. Awaiting reviewer-p2 re-verification.
