## Addendum — reviewer-p3 remediation (task #15, 260730)

Full review: `reports/reviewer-p3-260730-phase-03-review.md`. Fixed all 2 CRITICAL, 4
IMPORTANT, and 8 of 9 MODERATE findings per team-lead's rulings; M4 (no
optimistic-version photo mutations) is a deliberate, team-lead-affirmed deviation —
documented below, not fixed.

### C1 — Deadline didn't stop libvips work (CLOSED)
Replaced the external `Promise.race`+`setTimeout` deadline with Sharp's own
`.timeout({seconds})` — libvips itself aborts in-flight work, including the
`.clone()`d encode pipelines the old `pipeline.destroy()` never reached. The
semaphore slot is now released only in a `finally` after the whole decode+encode
chain has genuinely settled (no more abandon-while-still-running). Also fixed the
`acquireDecodeSlot` permit-transfer bug (`activeDecodes` could drift above the
configured limit under interleaved queue wakeups) — a released permit now transfers
directly to the next waiter instead of decrementing-then-letting-the-waiter-increment.
New tests: a genuinely-slow (PNG, not JPEG — shrink-on-load defeats the point)
decode proves `sharp.counters().process === 0` shortly after the deadline fires, and
a concurrency-bound test proves peak in-flight libvips work never exceeds the
configured `MEDIA_SHARP_CONCURRENCY`. The two previous concurrency tests' vacuous
`elapsed >= 0` assertions (M2) are replaced by these.

### C2 — Private route served rejected/pending photo bytes to unrelated users (CLOSED, both layers)
Fixed at both the transport and projection layers, since redacting a URL from a
response never stops a caller who already knows/guesses the photo ID:
- `private-media.ts` now enforces `moderationStatus` itself: admin sees any
  pending/rejected photo; the product's own creator sees their own still-`pending`
  uploads; a `rejected` photo is served to no one but an admin, not even its own
  creator (team-lead's explicit ruling on the C2 unresolved question).
- `serializer.ts`'s `toApiProduct` gained an optional `viewer` parameter and now
  filters non-approved photos out of the response entirely unless the viewer is an
  admin or the product's own creator viewing their own pending upload. Threaded the
  viewer through every general-read call site that can reach a non-owner
  (`get.ts`, `routes/products/lookup.ts`, `routes/products/search.ts`,
  `services/products/lookup.ts`'s v2 classification) — these are Phase 1/2 files,
  touched narrowly (adding one parameter to an existing `toApiProduct` call, no
  other logic changed) since they're the actual vulnerable surface the reviewer
  proved against. Left the default (no viewer) as "show every photo" for call sites
  I didn't touch (`product-moderation.ts`, `product-photos.ts`'s own responses,
  `product-drafts.ts`) — all already privileged by construction (admin-only actions,
  or an owner/admin-gated photo-mutation response).
Tests: route-level regression reproducing the reviewer's exact proof (rejected
photo, unrelated user, active product → 404; same photo, admin → 200; same photo,
its own creator → 404 too), plus serializer-unit and `GET /v1/products/:id`
route-level tests proving the response body itself never enumerates the URL.

### I1 — `completeMediaOperation` was unfenced (CLOSED)
Now a conditional `updateMany({ status: 'prepared', leaseOwner })`; throws
`MediaOperationFencedError` (a distinct class, not a generic `Error`) when the
predicate matches zero rows, rolling back the whole reference transaction instead of
committing a reference to bytes a recovery sweep already deleted. `addProductPhoto`
translates that into a typed 409 for the caller. `renewMediaOperationLease` is now
wired into `addProductPhoto` (before its reference transaction) and
`publishProductPhoto`/`publishProductEditPhoto` (before each copy) — no longer dead
code (M1). `finalizeSuccess`/`finalizeFailure` in the outbox sweep are now also
lease-owner-guarded (M5) — a worker whose processing lease was reclaimed can no
longer clobber the reclaiming worker's outcome on its way out; no dedicated test for
this one (see Issues/Deviations below). New test reproduces the reviewer's exact
proof: an intent recovered by a sweep, then a stale producer's completion attempt
throws and rolls back — no dangling reference to deleted bytes.

### I2 — `publishProductPhoto` had zero capacity enforcement (CLOSED)
`capacityReservationId` is now a required part of `publishProductPhoto`'s (and
`publishProductEditPhoto`'s) intent context, asserted live via the new
`assertMediaCapacityReservationLive` (throws 507) immediately before the first byte
copy — "no final/public key is created without a live reservation" is enforced in
code, not just documented. Rewrote the capacity-enforcement test to actually call
`publishProductPhoto` (the reviewer's specific complaint: the old test exercised
`reserveMediaCapacity` three times and never called the function under test at all)
plus a dedicated test proving publication refuses to copy anything when the
reservation isn't live.

### I3 — Upload streamed to disk before any capacity reservation (CLOSED)
Moved `reserveMediaCapacity` in `photo-upload.ts` to before `writeQuarantineFile` —
worst-case bytes are now reserved before a single byte lands in `quarantine/`, not
after. New test: fills the configured budget first, then asserts the upload request
gets a 507 with zero quarantine residue (proving the reservation call happens before
any disk write, not just that the eventual response is correct).

### I4 — HEIC fixture invisible to compiled builds (CLOSED, plus the pre-existing build break)
`tsc` copies no non-`.ts` assets into `dist/`, so the file-path-relative HEIC fixture
silently vanished from every compiled build — the probe always reported HEIC
unsupported in production regardless of the host's real capability. Replaced the
sibling `.heic` file with a base64-embedded constant in a new
`__fixtures__/heic-probe-sample.ts` module — structurally impossible to lose in
compilation now, verified by actually running `probeMediaCapabilities()` against the
compiled `dist/services/products/product-image-processor.js` output (not just
typechecking it). An unreadable/corrupt fixture on a host whose static capability
flag says `true` is now a startup **error**, not a silently-swallowed warning (the
two states were previously indistinguishable). Deleted the old binary fixture +
NOTICE.md (provenance now lives in the new module's own header comment).

Separately fixed the **pre-existing** `pnpm --dir api build` breakage (`TS6059` via
`src/services/products/lookup.test.ts` importing `tests/helpers/factories.js`,
present since before this phase's original commit) in its own commit, per
team-lead's instruction — `tsconfig.build.json` now excludes `src/**/*.test.ts`
(same pattern dev-1 used for `packages/shared` in Phase 1). Verified `pnpm build`
now completes cleanly and the compiled `dist/` contains no test files.

### MODERATEs
- **M1** (dead heartbeat primitives) — closed as a side effect of I1/I2's fixes;
  both `renewMediaOperationLease` and `heartbeatMediaCapacityReservation` (via
  `assertMediaCapacityReservationLive`) now have real production callers.
- **M2** (vacuous concurrency test assertions) — closed, folded into C1's fix above.
- **M3** (capacity never accounts for cumulative on-disk bytes) — resolved by
  **softening the documented scope** rather than building a persisted-usage
  counter: the reviewer's own recommendation offered this as one of two valid
  resolutions ("soften the criterion or add a persisted usage counter... Phase 7
  sweeper could reconcile it"). `product-media-capacity.ts`'s header comment now
  states precisely what's bounded (concurrent in-flight work) and what isn't
  (cumulative durable disk usage), and flags a persisted counter as Phase 7's
  operational-sweeper territory. A full disk-usage-accounting subsystem felt
  disproportionate to add unreviewed inside an already-large remediation; happy to
  revisit if the team wants it pulled forward.
- **M4** (no optimistic-version precondition on photo mutations) — **NOT fixed,
  deliberately.** This was litigated at the original Phase 3 plan-approval gate:
  Phase 5's independent per-photo retry design assumes no client-supplied version
  precondition on individual photo add/remove/reorder calls, and the
  per-product `FOR UPDATE` row lock + transactional `product.version` bump already
  achieves plan.md:57's actual intent (no lost updates under concurrency;
  cross-client/cross-device change detection via the existing `version_conflict`
  path on the next *metadata* mutation). Team-lead's ruling on this remediation
  round: the decision stands as written; my job here is to document it as a
  deliberate, reasoned deviation from plan.md's literal wording rather than treat
  it as an outstanding defect. Flagging again for whoever next touches plan.md so
  the written constraint matches the shipped contract.
- **M5** (finalizeSuccess/finalizeFailure not lease-guarded) — closed, see I1 above.
  No dedicated test: the fix is a `leaseOwner`-in-the-`where`-clause guard, the
  identical shape to `completeMediaOperation`'s fix (which *is* tested end-to-end);
  constructing an equivalent black-box proof would require exporting otherwise
  -private claim/finalize internals purely for test access, which felt like the
  wrong trade-off for a MODERATE finding with an obviously-correct, pattern-matched
  fix. Flagging the gap rather than silently skipping it.
- **M6** (`SET CONSTRAINTS ALL DEFERRED` broader than intended) — closed for my two
  occurrences (`removeProductPhoto`/`reorderProductPhotos`), now naming
  `"product_photos_product_id_position_key"` explicitly.
- **M7** (private photo bytes fully buffered per request) — closed;
  `private-media.ts` now streams via `createReadStream` after a cheap `stat()`
  existence check (so a missing file still 404s cleanly instead of a stream error
  after headers may already be committed).
- **M8** (5-photo cap only enforced post-decode) — closed; `assertPhotoMutablePreCheck`
  now includes a non-authoritative `_count` check before the multipart body is
  even read, so the common abuse case (hammering an already-full product) doesn't
  pay for a full stream+decode+encode+temp-write+rename before rejection. The
  locked, transactional count inside `addProductPhoto` remains the actual
  enforcement point.
- **M9** (several contract nits) — all closed: `enqueueMediaCleanup` returns
  `{id}|null` instead of an `{id:''}` sentinel; `removeProductPhoto`'s P2003→409
  retained-photo branch now has a dedicated test; `photo-upload/-delete/-order`
  responses now go through `productSchema.parse()` like the rest of the codebase;
  `MediaPathError` now extends `AppError` (typed 400) instead of a bare `Error`
  that would degrade to a signal-free 500 if it ever reached the error handler.

### Coordination note (concurrent Phase 4 work in the same files)
dev-1's Phase 4 work landed substantial new code directly in several files this
remediation also needed to touch — most significantly `product-photos.ts`
(`addProductEditPhoto`/`removeProductEditPhoto`/`reorderProductEditPhotos`/
`publishProductEditPhoto`/audit-log `requestMeta` plumbing), `product-media-storage.ts`
(`privateProductEditPhotoDir`/`privateProductEditPhotoPrefix`), and
`photo-upload.ts`/`photo-delete.ts`/`photo-order.ts` (`requestMeta` plumbing).
Coordinated the two breaking-signature changes (`completeMediaOperation`,
`publishProductPhoto`) with dev-1 directly before landing them — they
independently mirrored the same capacity-fencing fix into their own
`publishProductEditPhoto` and updated their call sites within the same session.

Per team-lead's commit-sequencing protocol, I committed first: for the 5 files
where our changes were genuinely interleaved, I reconstructed a "mine-only"
version from the `HEAD`-at-branch-start baseline plus my own known edits, verified
each reconstruction was a clean subset of the combined working tree (diffed
against the full combined content — confirmed the only remaining delta in every
case was dev-1's additions, nothing of mine missing or duplicated), then staged
and committed only those hunks. dev-1's uncommitted work was preserved throughout
(backed up before the file-level overwrite, restored immediately after my commit)
and re-verified clean against the new `HEAD` before handing back. Both typecheck
and the full suite (my 148 phase-3 tests + dev-1's in-flight Phase 4 tests) stayed
green throughout.

### Tests status (final)
- Phase 3 + remediation suite: 148/148 pass (run twice), including 5 new
  reviewer-p3-labeled regression tests reproducing the exact proofs from the review.
- Full API suite (mine + dev-1's concurrent in-flight Phase 4 work): 780/780 pass.
- Typecheck: clean. `pnpm build`: clean (previously broken — see I4).
- Isolated DB: own throwaway `pantry_test_dev3`, recreated fresh for this
  remediation round, dropped at the end. Never touched shared `pantry`/`pantry_test`.
- One transient flake investigated and confirmed environmental, not a regression:
  `product-media-coordinator.test.ts`'s heartbeat test failed twice while another
  agent's concurrent vitest process was actively running against the same shared
  Redis (their per-test `flushdb()` wiping my test's key mid-wait) — passed cleanly
  every time once their process finished. Matches the team's documented shared
  -Redis-contention hazard; not a code defect.

### Commits
- `d600282` — build-fix only (`tsconfig.build.json` excludes `src/**/*.test.ts`).
- `99da862` — main remediation (25 files: all C1/C2/I1-I4 + 8/9 MODERATE fixes,
  new/updated tests). Both on `feature/mobile-scan-product-creation`.

Status: DONE
Summary: All reviewer-p3 CRITICAL/IMPORTANT findings closed, 8/9 MODERATE closed
(M4 deliberately not fixed per team-lead's standing ruling, documented above); the
pre-existing `pnpm build` breakage is also fixed. 148 phase + 780 full-suite tests
green (re-verified against the isolated `99da862` commit alone: 108 targeted tests
pass, typecheck clean save for dev-1's own in-flight uncommitted files), build clean.
Concerns/Blockers: none technical. Awaiting reviewer-p3 re-verification and dev-1's
Phase 4 commit on top of `99da862`.
