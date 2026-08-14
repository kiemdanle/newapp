# Reviewer P4 — Phase 4 remediation re-verification (commit `9e17ee8`)

Follow-up to `reviewer-p4-260730-phase-04-review.md` (findings against `03a4ea7`).
Verdict: **all 1 CRITICAL + 7 IMPORTANT + 8 MODERATE findings resolved and empirically re-verified.**
Not CLEAN overall: **1 new CRITICAL branch-state defect** (not dev-1's) and **2 new MODERATE residuals** below.

## Method

Per my pre-published bar, and not trusting the working tree (it carried concurrent Phase 6/7 edits to
`product-edits.ts`, `product-moderation.ts`, and `packages/shared`):

- **Pinned worktree** `git worktree add /tmp/p4v2 9e17ee8 --detach`, with `@expyrico/shared` re-pointed
  at the worktree's own `packages/shared` and rebuilt from the pinned source, so no dirty workspace
  package leaked in (reviewer-p3's documented worktree caveat).
- **Pre-fix worktree** at `03a4ea7`, shared built from that commit, with only the three remediation
  test files overlaid — to prove the new tests actually fail without the fixes.
- Two throwaway DBs (`pantry_p4rev2`, `pantry_p4pre`), 24 migrations each via `psql -f` in sort order.
  Both dropped. `pantry`/`pantry_test` untouched; no `prisma migrate`; `deferred-migrations/` untouched.
- 13 of my own reproduction tests, run 3× for stability, then deleted. Both worktrees removed.
  `git status` clean of my changes.

## Results

| Run | Result |
|---|---|
| Focused 5 suites @ `9e17ee8` | **80/80 pass** |
| My 13 reproductions @ `9e17ee8` | **13/13 pass**, stable over 3 consecutive runs |
| New remediation tests @ `03a4ea7` (pre-fix) | **16 fail** — every `C1/I1/I2/I3/I4/I5/I7/M1/M2/M7/M8` test fails without the fix |
| Full API suite @ `9e17ee8` | **837/838** — see E1 |
| `tsc --noEmit` api + shared @ `9e17ee8` | **clean** (after neutralising N1 below) |

## Finding-by-finding

**C1 — FIXED at the derivation, as required.** `publishProductEditPhoto` now takes an explicit
`productId` (`product-photos.ts:437-462`) instead of deriving from `photo.productEditId`, and
`approveEdit` passes `product.id` (`product-edits.ts:525`). The intent was not widened to record both
shapes. Verified:

```
C1 publicKey: public/products/768ab454-…/3a39e76e-…   (= productId, editId ed272f28-… absent)
C1 intent keys: ["public/products/768ab454-…/3a39e76e-…"]   → publicKey ∈ intent keys
```

**I1 — FIXED, shape changed; I accept the trade-off.** The XOR check constraint on `ProductEditPhoto`
rules out FK detachment, so approval now deletes the *resolved* edit's photo-slot row
(`product-edits.ts:458-469`) before deleting the `ProductPhoto`. Verified: the previously-500ing
sequence now returns cleanly, the historical `ProductEdit` row survives with `status: 'approved'` and
its full `proposed` snapshot, and only the slot row is gone. **Judgment:** acceptable. The authoritative
history (status, proposed metadata, audit diff with `removedPhotos`) is intact, and the deleted row was
a pointer to a photo that no longer exists anywhere — keeping a dangling pointer would be worse.
Two residual notes, neither blocking, in R3 below.

**I2 — FIXED.** Dedupe now spans the whole merge set with a deterministic keep-one-per-user policy
(`merge.ts:147-172`). Verified both branches: two sources + no target review → 1 survivor on the target;
target review present → the target's own review is the survivor.

**I3 — FIXED, and the race surface is now smaller than I asked for.** The terminal write is a guarded
`updateMany({ where: { id, status: 'pending', version } })` with a typed conflict on `count === 0`
(`product-edits.ts:482-493`). Verified by interleaving a `request_changes` inside `approveEdit`'s
post-pre-check window: approval → `409 version_conflict`, edit ends `changes_required` with the admin's
notes intact. Separately, M1's staleness gate makes approve-vs-supersede **structurally impossible**
(supersede requires stale, approve requires non-stale) — verified: fresh supersede → 409; stale approve
→ `409 edit_base_stale` with `reserveMediaCapacity` called **0** times, i.e. it never reaches publish work.

**I4 — FIXED.** New-product approval writes the position-0 photo's public display URL inside the
reference transaction (`product-moderation.ts:186-194`); revision approval recomputes it **only** when
the relation-backed set actually changed, via an explicit `photoSetChanged` predicate covering
add/remove/reorder (`product-edits.ts:353-357`). Verified: new product gets
`https://media.expyrico.test/products/<productId>/<pubId>/display.webp`; a metadata-only revision on a
legacy product still returns `https://legacy.example/img.jpg` with the rename applied.

**I5 — FIXED.** `ALLOWED_DIRECT_STATUS_TRANSITIONS` restricts the direct-correction route to
`active ↔ report_hidden` (`routes/admin/products/patch.ts:20-23,40-49`). Committed tests confirm
`pending → active` and `→ merged_into` both 409 and leave photos unpublished.

**I6 — FIXED (dev-2).** `apps/admin/src/lib/admin-api.ts:104` now sends
`{ targetId, sourceIds, version }`; `mergeProductsAction` takes three args. A real drift guard exists —
`packages/shared/src/schemas/admin/products.test.ts:233` asserts the legacy `winnerId`/`loserIds` body
is rejected. Remaining `winnerId` hits are a local React prop name and explanatory comments only.

**I7 — FIXED and it genuinely bites.** Both paths inject via `writeAuditLogSpy.mockImplementationOnce`,
which is the last statement inside the reference transaction — so it fires after reservation, intent and
the real byte copy. The new-product test asserts (a) rows unchanged, (b) `countFilesRecursively(public)
=== 0`, (c) intent still `prepared` with keys matching `^public/products/${product.id}/`. There is a
matching edit-path test (`product-edits.test.ts:234`). **Confirmed against pre-fix code: both fail.**

**M1, M2, M3, M4, M6, M7, M8 — all addressed.** Empirically verified M1 (non-stale recovery → 409;
draft rebase → 409, edit stays `draft`), M2 (note-less supersede preserves `unread feedback`), M7
(non-admin approve/request_changes/recover → 403 at service level), M8 (report `targetId` follows to the
target). M3 (supersede re-reads staged photos under the same `FOR UPDATE` lock `assertEditPhotoMutable`
takes — so a racing upload is either visible or blocked, then compensated by its own rollback), M4
(`currentVersionOf(tx, …)`), and M6 (queue projection with `name` + `coverPhoto`) verified by reading.

---

## New findings

### NEW-CRITICAL — `feature/mobile-scan-product-creation` cannot boot or typecheck from a clean checkout (introduced by `3e76b23`, **not** dev-1)

`api/src/routes/admin/index.ts:15` (tracked) does:

```ts
import { adminProductsPendingGetRoute } from './products/pending-get.js';
```

but `api/src/routes/admin/products/pending-get.ts` is **untracked** — `git ls-files --error-unmatch`
returns *"Did you forget to 'git add'?"*. `git log -S"pending-get"` attributes the import to `3e76b23`
("add reCAPTCHA assessment and product_creation mode gate"). Still untracked at current HEAD `81a2250`.

This is invisible locally because the file exists in the shared working tree; it is fatal anywhere else.
My pinned worktree failed immediately:

```
Error: Failed to load url ./products/pending-get.js (resolved id: ./products/pending-get.js)
in /tmp/p4v2/api/src/routes/admin/index.ts. Does the file exist?
→ 3 test suites failed to collect (admin-product-moderation, product-edits, admin/products)
```

Worse, the untracked file imports `adminProductEditDetailSchema`, which exists in **neither** the
committed shared source at `9e17ee8`/HEAD **nor** the current working-tree shared source (0 occurrences
in both) — only in the committed mobile vendored `dist`. So `git add`-ing it alone would not fix it.

I completed this re-verification by deleting that one import line inside my throwaway worktree; every
result above is otherwise from unmodified `9e17ee8` code. A sweep for the general class found exactly
one occurrence — no other tracked file imports an untracked module.

**Recommendation:** dev-3/dev-2 to land `pending-get.ts` plus the `adminProductEditDetailSchema` source
in one commit, or revert the import until Phase 6 is ready. Worth a CI guard: build from a clean clone,
or fail on any tracked import resolving to an untracked path.

### NEW-MODERATE R1 — the mobile vendored `dist` matches neither the committed shared source nor any committed source

Rebuilding `packages/shared` from the pinned `9e17ee8` source and diffing against the committed
`apps/mobile/local-packages/@expyrico/shared/dist` shows drift in **both** directions in the runtime JS:

- **Vendored lags the commit:** `schemas/admin/products.js` is missing dev-1's own M6 additions —
  `adminProductEditCoverPhotoSchema`, and `name`/`coverPhoto` on `adminProductEditRowSchema`.
- **Vendored leads the commit:** `schemas/product-edits.js` exports `adminProductEditDetailSchema`,
  which is in no committed source anywhere.

(The 11 `.d.ts` differences are declaration-emit ordering noise — union member order, property order —
and are not substantive.)

Per the lead, the second half is a known, accepted build artifact riding along, so I am not re-raising it
as contamination. The reportable part is that the artifact was cut from a working tree *before* M6
landed, so plan constraint line 65 ("refresh both vendored/resolved copies") is not actually satisfied by
this commit. Inert today — mobile does not consume admin schemas — but it will silently mislead Phase 5.

Note the drift guard added in this commit checks only that the **merge request schema** rejects the
legacy shape. It does not compare vendored `dist` against a build of `src`, which is the drift class that
actually occurred here.

**Recommendation:** regenerate the vendored copy from committed source once `adminProductEditDetailSchema`
lands, and make the guard a build-and-diff check rather than a schema-shape assertion.

### NEW-MODERATE R2 — the module-scope `writeAuditLogSpy` can leak a queued failure into an unrelated test

`api/tests/integration/admin-product-moderation.test.ts:28` and
`api/tests/integration/admin-product-merge.test.ts:11` create a module-scope
`vi.spyOn(auditLog, 'writeAuditLog')`, and the I7 tests arm it with `mockImplementationOnce(throw)`.
Neither file resets the spy in `afterEach`. `mockImplementationOnce` is a *queue*: if the armed
implementation is ever not consumed — because the code under test fails earlier than expected — the
throw survives into the next test in file order.

This is not hypothetical. In my pre-fix run it did exactly that, producing a bogus failure in the
unrelated `exactly one of two concurrent approvals…` test (`expected [] to have a length of 1`, i.e.
*both* approvals threw). Today the fixed code always reaches `writeAuditLog`, so it is latent — but it
means any future change that short-circuits approval earlier will surface as a confusing failure in a
different test.

**Recommendation:** `writeAuditLogSpy.mockReset()` in `afterEach` (re-establishing pass-through), or
assert the queue was drained.

### R3 — two small residuals on the I1 fix (non-blocking, judgment notes)

1. The blocker query excludes `isLegacy: true` edits (`product-edits.ts:363`), but the subsequent
   `deleteMany({ where: { sourceProductPhotoId } })` does not — so an *open legacy* edit's slot row
   would be deleted without ever blocking. Backfilled legacy rows are very unlikely to carry photo
   slots, so this is a documentation/assertion gap rather than a live bug.
2. Approving edit B mutates edit A's rows, but the approval's audit diff records only
   `publishedPhotos`/`removedPhotos` for edit B — nothing records that historical edits were touched.
   Worth adding the affected edit ids to the diff so the moderation trail is self-explaining.

### E1 — full-suite failure is environmental, not a regression

`tests/integration/records-routes.test.ts > POST /v1/records` failed once in the full run with a
25.5s timeout; the file passes 12/12 in isolation on the same DB. Consistent with the known transient
capacity/Redis contention under concurrent agent load. Separately, the Phase 3
`product-media-coordinator` heartbeat flake I reported as N1 last round **now passes** — resolved by
task #17.

## Verdict

Phase 4 (`9e17ee8`) is **clean on its own merits** — every finding I raised is fixed at the right layer,
with tests that provably fail without the fix. It is **blocked from landing by the branch-state
CRITICAL above**, which belongs to `3e76b23`, not to this commit.

## Unresolved questions

1. ~~Who lands `pending-get.ts` + `adminProductEditDetailSchema`~~ — **resolved**, see addendum.
2. Should the vendored-dist guard become a real build-and-diff CI check (R1)?

---

# Addendum — tip `b7950d2` verified (pair with `9e17ee8`)

Same method: pinned worktree at `b7950d2` with `packages/shared` re-pointed and rebuilt from the pinned
source, throwaway DB `pantry_p4tip` (24 migrations), private Redis db 9 to remove shared-state noise,
control worktree at `9e17ee8`, pre-fix worktree at `03a4ea7`. All three worktrees removed, DB dropped,
Redis db flushed, scratch deleted.

`b7950d2` touches **no `api/src`** — only two test files, `packages/shared` schemas/tests, and the
vendored dist. So all service behaviour verified for `9e17ee8` carries over unchanged.

## I5 — tightened correctly, bypass NOT reopened

My concern on reading the summary was that moving I5 to the schema boundary might have replaced the
route's source-status check. It did not — both layers are present, and I proved it:

```
schema status=pending          -> success=false      (400 at the boundary)
schema status=draft            -> success=false
schema status=changes_required -> success=false
schema status=merged_into      -> success=false
pending->active:               409 conflict | Cannot set status directly from pending to active…
pending->merged_into:          400 validation_error
active <-> report_hidden:      200 / 200
```

`active` still passes the narrowed enum (it must, for the toggle), so the route's
`ALLOWED_DIRECT_STATUS_TRANSITIONS` source check at `patch.ts:40-49` is still what stops
`pending → active`. Defence in depth intact.

## C1 — both publish sites assert prefix + intent membership

Present and correct at both sites. One ordering nit, not a finding: the edit-site assertions were
appended to the **I4** test, after `expect(after.imageUrl).toBeTruthy()`. Running that test at
`03a4ea7` fails on the I4 assertion first, so the C1 assertions are never reached — they cannot
independently signal a C1 regression if I4 ever breaks. C1 on the edit path is still independently
covered by the edit-path I7 test (verified failing at `03a4ea7` last round), so coverage is adequate;
moving the two C1 lines above the `imageUrl` assertion would make it airtight.

## I3 — the composed construction satisfies my bar; I do not want the alternative

dev-1 offered to revisit. My judgment: **keep it as is.**

The guarded terminal `updateMany` is genuinely exercised — by the approve-vs-`request_changes` race on
a still-pending, non-stale edit, which I re-verified end to end (approval → `409 version_conflict`, edit
ends `changes_required` with notes intact). The supersede variant is proven unreachable by composition,
and that is a stronger property than "guarded", not a weaker one: M1 requires staleness for recovery,
and that same staleness makes `approveEdit` fail its `edit_base_stale` pre-check before any publish work
(I measured `reserveMediaCapacity` called **0** times).

A construction that forced the guard itself to adjudicate the supersede case would require reaching a
state the system cannot reach — it could only be built by weakening M1 or by writing the DB directly,
and it would then be testing fiction. The one real cost is coupling: the guard is the sole defence if
M1's staleness gate is ever relaxed. dev-1's in-test comment documents exactly that, which is the right
mitigation.

## Findings status at the tip

| | Status |
|---|---|
| NEW-CRITICAL (unbootable HEAD, `3e76b23`) | **RESOLVED** at HEAD `4b048b1` — `pending-get.ts` now tracked, `adminProductEditDetailSchema` now in committed shared source (2 occurrences). Re-swept `api/src`: zero tracked files import an untracked module. Still open *at* `b7950d2` itself. |
| R1 (vendored dist drift) | **Half-closed.** The lag direction is fixed — `schemas/admin/products.js` is now byte-identical to a fresh build of the committed source, so M6's `name`/`coverPhoto` are in. The lead direction (`product-edits.js` carrying `adminProductEditDetailSchema`) persists at `b7950d2`, and is the accepted dev-2 rider; it self-resolves at HEAD now that the source landed. Recommendation stands: make the guard a build-and-diff check. |
| R2 (unreset `writeAuditLogSpy`) | **Still open** — 0 occurrences of `mockReset`/`mockClear` in either test file at `b7950d2`. |
| R3 (I1 legacy-edit + audit-diff notes) | Still open, still non-blocking. |

## E2 — capacity-reservation flake: NOT a `b7950d2` regression

Worth recording because my first sample said otherwise. A single back-to-back A/B looked damning —
`9e17ee8` 47/47 pass, `b7950d2` failing with `Media capacity reservation expired before the operation
completed`. That was a false signal. Interleaved A/B/A/B, and then three rounds on a **private Redis db**
(removing the shared `allkeys-lru` instance entirely), show both commits flaking equally and
independently of the commit:

```
round1  b7950d2 -> 3 failed | 45 passed      9e17ee8 -> 2 failed | 45 passed
round2  b7950d2 -> 1 failed | 47 passed      9e17ee8 -> 47 passed
round3  b7950d2 -> 48 passed                 9e17ee8 -> 47 passed
```

So: load-sensitive, present at both commits, not caused by this change. It is however a **real** signal
for whoever owns R2's capacity gate (reviewer-p3 / dev-3, not me): the reservation TTL is 120s and no
test runs anywhere near that, yet `assertMediaCapacityReservationLive` finds the key gone. The reserve
Lua script only `SET … EX`/`SADD`s and never removes another live reservation, so the key is
disappearing via `releaseMediaCapacityReservation` (a `finally` on a shared id) rather than by expiry.
Production implication if that reading is right: a legitimate slow upload could get a spurious
`507 capacity_exceeded`. Handing off rather than diagnosing further — explicitly out of my scope.

## Addendum 2 — clean-checkout boot confirmed at `00b5abb`; CRITICAL and R1 both closed

Method note: I stopped using `git worktree` for this one. A concurrent agent's
`git worktree prune`/`remove` deleted `/tmp/p4final` **mid-run**, which produced four bogus
suite failures (`ENOENT: .env.test.example`, `tests/helpers/env.ts` gone). Re-ran with
`git archive <sha> | tar -x` into a plain directory instead — no worktree metadata for anyone
else to reap. Recommend that as the standard isolation method on this box.

**CRITICAL — CLOSED.** From a clean pinned export of `00b5abb` with **no source edits** (previous
rounds needed a one-line neutralisation just to collect):

```
TYPECHECK api    -> EXIT=0
TYPECHECK shared -> EXIT=0
5 suites (health, admin/products, moderation, merge, product-edits) -> 78/78 pass, 0 collection failures
BOOT OK — buildServer() + ready() succeeded
GET /health                                  -> 200 {"status":"ok"}
GET /v1/admin/products/pending/:id (no auth) -> 401   (registered + admin-gated)
control, unregistered path                   -> 404   (discriminates "registered" from "missing")
```

**R1 — CLOSED at HEAD, but it took three commits to converge.** At `00b5abb` the lag direction was
fixed (M6's `name`/`coverPhoto`/`adminProductEditCoverPhotoSchema` and `adminProductEditDetailSchema`
all present, every runtime file byte-identical to a fresh build) — *except* `schemas/product.js`, which
had picked up a **new** uncommitted rider: `platform: z.enum(['android','ios'])`, absent from
`packages/shared/src/schemas/product.ts` at that commit. `git log -S` shows it entered the vendored dist
in `00b5abb` and the source only in `7561dcf`. So the artifact led its own source by one commit again —
the third instance of this pattern (`adminProductEditDetailSchema`, then `platform`).

At current HEAD `125e3d9` a fresh build of the committed shared source is byte-identical to the vendored
dist across **every** runtime file (0 differing). R1 is genuinely closed.

The pattern is worth fixing structurally rather than by hand: each hand-resync captured whatever
uncommitted work happened to be in the tree, and it self-healed only because later commits caught up.
A build-and-diff CI check (`build shared from src; diff against vendored dist; fail on any delta`) makes
this class impossible; the current guard only asserts the merge schema rejects its legacy shape.

Cleanup: `pantry_p4fin` dropped, redis db 9 flushed, all `/tmp` exports removed, no worktrees of mine
remain, no source file modified by me.

### Correction — R2 and R3 are closed too (my sweeps predated `770567b`)

Every "still open" note above for R2/R3 is **stale**. Both were fixed in `770567b`
("close reviewer-p4 residuals R2 and R3"), which landed after the commits I had pinned. Verified at
HEAD rather than taken on trust:

- **R2 — closed.** `mockReset`/`mockClear`/`mockImplementation(original)` now appear 5× / 3× / 5× in
  `admin-product-moderation.test.ts`, `admin-product-merge.test.ts`, `product-edits.test.ts`
  respectively. The unconsumed-`mockImplementationOnce` leak can no longer cross a test boundary.
- **R3a — closed.** `product-edits.ts:479-483` now scopes the historical-row cleanup to
  `OR: [{ status: { in: ['approved','rejected'] } }, { isLegacy: true }]`, deliberately mirroring
  `assertNoOpenEditBlocksRemoval`'s predicate, so an open legacy edit's slot row can no longer be
  deleted without having been eligible to block. The in-code comment states the invariant rather than
  relying on call ordering — which is the right fix, not the minimum one.
- **R3b — closed.** `affectedOtherEditPhotoRows` (`:457`, `:488`) is collected during removal and
  emitted in the approval's audit diff (`:535`), so the moderation trail now names every other edit
  whose photo-slot rows were mutated as a side effect.

Net: of my findings, **nothing remains open**. Outstanding items belong to other owners — E2's
capacity-release diagnosis (dev-3) and the vendored-dist build-and-diff guard (Phase 8).

## Tip verdict

`b7950d2` tightens all three targets correctly and introduces no regression. Focused suites green on a
quiet run (`48/48` product-edits + moderation; merge `17/17`; shared unit `84/84`); `tsc --noEmit` clean
for both `api` and `packages/shared`. Combined with the `9e17ee8` pass above, **Phase 4 is clean.** The
branch-state CRITICAL that blocked it is resolved at HEAD `4b048b1`. Remaining: R2 (one line), R1's
build-and-diff guard, R3, and E2 handed to Phase 3/7's owner.
