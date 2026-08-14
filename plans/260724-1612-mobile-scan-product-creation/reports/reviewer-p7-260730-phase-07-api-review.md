# Phase 7 API review — operations, abuse controls, cleanup

Reviewer: reviewer-p7 · Date: 2026-07-30 · Branch: `feature/mobile-scan-product-creation`

Scope: `3e76b23`, `2fde226`, `81a2250`, `7561dcf`. Excluded per assignment: `6883fb8` (reviewer-p3),
`00b5abb` rider fix (known incident), uncommitted `infra/**` + `api/src/server.ts` + `product-media-freeze.*`
(dev-3's in-flight Task 5–7 work).

Verification environment: throwaway DB (25 migrations replayed via `psql -f`, dropped after), private
`TEST_REDIS_URL=redis://localhost:6379/9`. `pnpm --dir api typecheck` clean. `pnpm --dir api lint` is
`echo skip`. All four Phase 7 suites plus `products-draft-lifecycle` PASS (90/90).

Phase 3 regression suites (`products-photo-routes`, `product-media-capacity`, `product-media-publication`,
`product-media-outbox`, `products-photos`): **57/57 PASS**. An earlier combined run of the same five files
showed three failures; those are *not* a regression and are *not* Redis/DB contention — that run already had
private DB and Redis indexes. The cause was CPU starvation on the shared box: the failing tests ran 43 s and
65 s against fixed budgets at 15-min load average 13.0, versus 4.5 s at load 2.4. Re-run twice more on fresh
isolated resources at low load, clean both times (3 samples total: fail / pass / pass). Load-sensitive fixed
timeouts in the media suites are a pre-existing test-budget weakness, unrelated to these commits.

Counts: **1 CRITICAL, 8 IMPORTANT, 13 MODERATE.**

---

## CRITICAL

**C1 — The stale-draft sweep deletes a product that left `draft` mid-sweep; a concurrent submit loses the
product and its photo bytes.**
Evidence: `api/src/services/products/product-media-cleanup.ts:50` reads `fresh` (status checked at :56), then
:70 opens the transaction, whose re-checks at :74-78 cover only `record.count` and `productEdit.count`. The
terminal write at :88 is `tx.product.delete({ where: { id: fresh.id } })` — **no status, no `createdAt`, no
version predicate**. Everything between the pre-check read and the delete is an unguarded window across
several round trips, and `submitDraft` (`product-drafts.ts:224-232`) needs only ownership + version to move
the row to `pending`.

Reproduced (scratch test, since deleted) by flipping the row to `pending` inside the sweep's own window:

```
REPRO A: sweep result = { scanned: 1, deleted: 1, skippedReferenced: 0 }  product after = DELETED
```

Impact: a user who submits a 30-day-old draft at the moment the minute-tick runs loses the product entirely.
Worse, :84 has already enqueued `delete_private` for its photo keys in the same transaction, so the bytes go
too, and a `Record` attached moments later is silently orphaned (`schema.prisma` Record→Product is
`onDelete: SetNull`). The file's own header comment ("Every deletion condition is re-checked immediately
before acting") is not true of the condition that matters most.

Fix: make the delete itself conditional and check the count —
`tx.product.deleteMany({ where: { id, status: 'draft', createdAt: { lt: cutoff } } })`, returning early when
`count === 0`, and take `SELECT … FOR UPDATE` on the product row before the record/edit counts so those
checks are not READ COMMITTED check-then-write either.

---

## IMPORTANT

**I1 — Daily byte quota is a non-atomic check-then-act whose counter is written only after the upload
finishes; concurrent uploads all pass.**
Evidence: `product-creation-quotas.ts:56-57` does `GET` → compare → return, and the matching `INCRBY` is at
:76, called from `photo-upload.ts:137` — i.e. after streaming, decoding, encoding and the reference
transaction, seconds later. Nothing reserves the estimate in between.

```
REPRO B: 8/8 concurrent quota checks passed with 100 bytes of headroom
REPRO B: final accepted total = 1700 against a 1000-byte cap
```

The plan lists quotas as protecting VPS capacity; a limit that 8 parallel requests can overshoot by 70% is
not a limit. Fix: mirror the Phase 3 reservation shape — atomically `INCRBY` the worst-case estimate at check
time (rejecting and compensating with `DECRBY` when over), then reconcile down to real bytes on success and
release fully on failure. A single Lua script gives check-and-reserve atomicity.

**I2 — Rejected/failed upload bytes are never metered, so the cheapest abuse vector is unbounded.**
Evidence: `product-creation-quotas.ts:71-78` and its doc comment ("never for a rejected/failed/abandoned
upload"), plus `photo-upload.ts:137` sitting on the success path only. Phase file Task 3 requires "daily
accepted/**failed** bytes"; the existing test at `product-creation-abuse.test.ts:109` locks in the opposite.
A client can post 10 MB SVG/corrupt/oversize payloads forever: each one is fully streamed, written to
quarantine and decode-attempted, and consumes exactly zero quota. Only the global Phase 3 reserve stands
between that and the disk, and it is released on every rejection. Fix: charge attempted bytes (or a failure
counter) to the same daily bucket, refunding the difference on success.

**I3 — The cleanup "one-overlap lock" is unfenced and unrenewed; a slow tick deletes its successor's lock.**
Evidence: `queues/jobs/product-media-cleanup.ts:62` acquires with a constant value `'1'` and a 55 s TTL, and
:84 releases with an unconditional `redis.del(LOCK_KEY)` in `finally`. There is no heartbeat, so any run
exceeding 55 s (25 outbox operations + 25 draft-delete transactions + an unbounded quarantine `readdir`+`stat`
walk is easily that) loses the lock, lets the next tick in, and then deletes *that* run's lock on exit —
admitting a third concurrent run.

```
REPRO E: after run-1 finished, lock holder = GONE (run-2 lock was stolen/deleted)
```

The suite's overlap test (`product-media-cleanup.test.ts:226-238`) only covers two instantaneous calls and
cannot see this. Fix: store a unique token, release via a compare-and-delete Lua script, and renew the TTL
periodically while the pass runs (or bound the pass well under the TTL and assert it).

**I4 — `.env.test.example` no longer parses, so a fresh checkout / CI cannot boot.**
Evidence: `config.ts:96-98` adds `RECAPTCHA_PROJECT_ID` / `RECAPTCHA_SITE_KEY_ANDROID` /
`RECAPTCHA_SITE_KEY_IOS` with **no default**; `3e76b23` updated the gitignored `api/.env.test` but neither
`api/.env.test.example` nor `api/.env.example`. `tests/helpers/env.ts:41` falls back to `.env.test.example`
when `.env.test` is absent — exactly the CI/new-clone case. Probe against the example file:

```
PROBE .env.test.example -> [ { "code": "invalid_type", "path": ["RECAPTCHA_PROJECT_ID"], "message": "Required" }, … ]
```

Fix: add the three keys (plus the optional `PRODUCT_CREATION_*` ones for discoverability) to both example
files.

**I5 — The mode gate and the quota run *after* the external provider lookup, so `off` does not stop the
expensive work.**
Evidence: `product-drafts.ts:83` performs the full `lookupProductV2` (both providers + backfill enqueue)
before `assertProductCreationEligible` at :95 and `assertWithinActiveDraftQuota` at :96. Probe with both
providers stubbed and mode `off`:

```
ORDER: mode=off POST /v1/products/drafts -> 403 feature_disabled
  outbound lookupOff calls = 1, lookupUpcitemdb calls = 1
```

`off` is the incident kill switch (plan risk row "Provider outage blocks submit → mode off if prolonged"),
but it still lets any authenticated caller drive unbounded third-party lookups, and a user already at the
draft cap can do the same indefinitely. Fix: evaluate eligibility (and the cheap quota count) before the
lookup; keep the post-lookup call only if the resumed-draft branch must stay reachable.

**I6 — Admin capability and admin enforcement disagree under `internal` mode.**
Evidence: `lookup-v2.ts:13` passes the real `req.user!.role`, so `isProductCreationEligible` returns `true`
for an admin (`product-creation-eligibility.ts:24-27`), and lookup-v2 reports `canCreate: true`. But
`product-drafts.ts:95`, `:149` and `:215` all hardcode `{ id: actorId, role: 'user' }`, so the same admin is
refused:

```
MATRIX internal/admin: isProductCreationEligible=true
  PATCH /drafts/:id   -> 403 {"code":"feature_disabled","title":"Editing this draft is not yet available"}
  POST  /submit       -> 403 {"code":"feature_disabled","title":"Product submission is not yet available"}
```

This contradicts plan.md ("`internal` means existing admin users plus an environment-managed user-ID
allowlist") and is internally inconsistent: the three photo routes exempt admins entirely
(`photo-upload.ts:43`, `photo-delete.ts:14`, `photo-order.ts:15`), so under `internal` an admin may add and
reorder photos on a draft they cannot create, patch or submit. The `product-creation-mode.test.ts` matrix
tests `isProductCreationEligible` directly and never through a mutation route, which is why it stays green.
Fix: thread the real actor role into `createOrResumeDraft` / `patchDraft` / `submitDraft` and pick one admin
policy across all six call sites.

**I7 — The durable outbox has no poller independent of BullMQ.**
Evidence: `grep` for `processMediaOutboxOnce` across `api/src` returns exactly one non-test caller —
`queues/jobs/product-media-cleanup.ts:68`. The phase file requires "Polling the durable outbox is
authoritative; BullMQ delivery only accelerates it", and `81a2250`'s message asserts "the durable outbox poll
and the DB re-checks … stay authoritative on their own, independent of the scheduler". They are not: if the
repeat key is lost (Redis flush/eviction — note the box logs `Eviction policy is allkeys-lru`), a failed
`scheduleProductMediaCleanup` (`runner.ts:31`, fire-and-forget with only an error log), or the queue is
paused, no prepared intent or pending cleanup is ever executed and orphan bytes accumulate silently. Fix: add
a scheduler-independent interval/timer poll in the worker process, or make the claim in the docs match
reality and add a startup assertion that the repeat job exists.

**I8 — Submission does not validate draft completeness; an empty-name draft reaches the moderation queue.**
Evidence: `submitDraft` (`product-drafts.ts:210-246`) checks ownership, state, eligibility and the assessment,
then transitions — nothing asserts the draft has a name or any photos. `createOrResumeDraft` deliberately
writes `name: ''` (`product-drafts.ts:104-106`). Probe under mode `all` with a valid stubbed assessment:

```
PROBE submit empty-name draft -> 200; db status=pending; body={… "name":"", …}
```

This violates the plan's global constraint "Name required: trimmed 1–200 characters" and pushes unreviewable
rows into Phase 6's queue. Fix: assert a non-empty trimmed name (and whatever minimum Phase 6 needs) before
the transition, returning `validation_error`.

---

## MODERATE

**M1 — Active-draft quota is count-then-create.** `product-creation-quotas.ts:27` counts, then
`product-drafts.ts:100` creates, with no transaction or lock. `REPRO C (at cap-1): 4/4 concurrent checks
passed — only 1 slot exists`. Bounded overshoot, but the same class as I1.

**M2 — The active-draft cap is bypassable by cycling.** Only `draft`/`changes_required` count
(`product-creation-quotas.ts:28-29`), so submitting 20 drafts frees all 20 slots, and deleting drafts frees
them immediately. There is no daily *creation* counter, so per-user row creation is unbounded in practice.

**M3 — `recordDailyBytesAccepted` is a post-commit side effect that can fail the request.**
`photo-upload.ts:137` is awaited after `addProductPhoto` has committed; a Redis blip turns a fully successful,
persisted upload into a 500 for the client (which will then retry and upload it again). Wrap in
`.catch(log)` — losing a quota increment is strictly better than a false failure.

**M4 — Quota key can leak forever.** `product-creation-quotas.ts:76-77` only sets the TTL when
`total === bytes`; a crash between `INCRBY` and `EXPIRE` leaves a permanent key. Call `EXPIRE` unconditionally
(it is a no-op cost) or use `SET … EX NX` + `INCRBY`.

**M5 — Nothing pins the outbound CreateAssessment request shape.** No test in
`product-creation-assessment.test.ts` inspects the request argument; the test named "rejects a token whose
site key does not match this app registration" (:100) merely stubs `tokenProperties.valid = false` and would
pass even if `siteKeyFor` returned the wrong key or `expectedAction` were misspelled. My probe confirms the
current shape is correct — `{"parent":"projects/expyrico-test","assessment":{"event":{"token":"tok",
"siteKey":"test-recaptcha-site-key-ios","expectedAction":"submit_product"}}}` — but there is no regression
guard for the two requirements the plan names explicitly (exact action, exact site key).

**M6 — Assessment outcome is never recorded.** The phase requires the server "records risk reasons/assessment
name safely". `assessProductCreationSubmission` returns `{ score, reasons, assessmentName }`, and
`product-drafts.ts:222` discards the whole result. `assessmentName` therefore has no consumer anywhere, and
there is no audit trail linking a `pending` product to the assessment that admitted it. Persist score/reasons/
name on the product or in the audit log.

**M7 — Submit response is not schema-pinned.** `submit.ts:15` does `reply.send(product)` while sibling routes
parse (`photo-delete.ts`, `photo-upload.ts`, `drafts.ts` list). Add `productSchema.parse(...)` for consistency
— and consider tightening `productSchema.name` (currently bare `z.string()`), which is why it would not have
caught I8 either.

**M8 — "No open edit" only counts `pending` edits.** `product-media-cleanup.ts:58,76` filter
`ProductEdit.status = 'pending'`, but the enum also has `draft` and `changes_required`
(`schema.prisma:93-101`). Currently unreachable for a `draft` product, but the condition should match the
spec wording ("no open edit") as defence in depth.

**M9 — Quarantine sweep is unbounded and not dry-run capable.** `sweepStaleQuarantine`
(`product-media-cleanup.ts:109`) does a full `readdir` + per-entry `stat` with no batch limit and no `dryRun`
parameter, against a phase requirement for "bounded dry-run-capable passes". Relatedly, the `dryRun` argument
on `sweepStaleProductDrafts` has no non-test caller and no operator entry point.

**M10 — Cleanup key selection mislabels and can drop keys.** `product-media-cleanup.ts:81-83` uses
`p.privateStorageKey ?? p.publicStorageKey` and enqueues everything as `operation: 'delete_private'`. If a
photo ever carries both, the public key is silently dropped; if it carries only a public key, it is deleted
under the wrong operation type. Select explicitly and enqueue each namespace with its own operation.

**M11 — Stale-draft eligibility keys on `createdAt`, not last activity.** `product-media-cleanup.ts:45,48`
uses `createdAt < now-30d`, so a draft created 31 days ago and actively edited yesterday is deleted. `updatedAt`
matches the intent of "abandoned draft" better; if `createdAt` is deliberate, say so in the doc comment.

**M12 — Every submit attempt bills a CreateAssessment before the version guard.** `product-drafts.ts:222`
runs the assessment, `:224` then applies the version predicate — so a client looping stale-version submits
generates one paid Google assessment per attempt, and there is no per-user rate limit on the submit route
beyond the global budget. Consider a dedicated per-user limit, or check version before assessing (accepting
that the version can still move afterwards).

**M13 — Retry contract for Phase 5 is undocumented.** The 503 path is genuinely safe (verified:
`plugins/idempotency.ts:229-233` deletes the reservation and never caches ≥500, and the transition at :224 is
version-guarded), but a reCAPTCHA Enterprise token is single-use: retrying with the *same* `abuseToken`
returns `valid: false` and surfaces as a non-retryable 403 `abuse_check_failed`. Phase 5 must mint a fresh
token per attempt; that needs to be stated in the contract handed to the mobile phase.

---

## Adversarial matrix — verified behaviour

Run against a live server on the isolated DB (mode `off`, non-admin owner of an existing draft):

| Operation | Result | Expected by plan | Verdict |
|---|---|---|---|
| `POST /drafts` (create) | 403 `feature_disabled` (after 2 provider calls — I5) | blocked | pass (ordering flaw) |
| `PATCH /drafts/:id` (metadata) | 403 `feature_disabled` | blocked | pass |
| `POST /drafts/:id/submit` | 403 `feature_disabled`, row stays `draft` | blocked | pass |
| `DELETE /:id/photos/:photoId` | 403 `feature_disabled` (gate precedes the 404) | blocked | pass |
| `GET /drafts`, `GET /products/:id` | 200 | readable | pass |
| `POST /v1/products` (legacy) | 410 `upgrade_required` | blocked every mode | pass |
| `POST /products/:id/edit` (revision) | 201 | open every mode | pass |
| `GET /admin/products/pending` | 200 | open every mode | pass |
| `internal` + admin actor | canCreate `true`, mutations 403 | eligible | **fail (I6)** |
| `internal` + allowlisted user | submit allowed (existing suite) | eligible | pass |
| `internal` + non-allowlisted | 403 before quotas | blocked | pass |

Assessment bypass paths: `Product.status = 'pending'` is written in exactly one place outside moderation —
`product-drafts.ts:230` — and every route reaching it passes through `assessProductCreationSubmission`. The
`ProductEdit` pending writes (`product-edits.ts:250`, `routes/products/patch.ts:76`) are the revision flow,
correctly ungated. No REST param, platform-mismatch, empty-token or absent-token path reaches `pending`
without a server assessment; empty tokens are rejected by `productDraftSubmitRequestSchema`
(`trim().min(1)`), a provider error is a 503 with nothing written, and `score ?? 0` fails closed when
`riskAnalysis` is absent. Token redaction verified (`product-creation-assessment.ts:82,95` log only
`invalidReason`/`score`/`reasons`).

---

## Acceptance criteria walk-through (phase-07)

| Criterion | Status |
|---|---|
| Server verifies token/action/key/score and fails conservatively | Met in behaviour; unpinned by tests (M5), outcome not recorded (M6) |
| Mode supports off/internal/all with direct API enforcement and known cohort | Partially met — admin cohort broken under `internal` (I6), gate ordered after the lookup (I5) |
| Phase 3 reservations remain the single implementation; quotas cannot expire them | Met — no reservation/lease logic re-implemented; quotas are additive and independent |
| Cleanup uses durable outbox + worker integration, preserves references across failure | **Not met** — C1 (unguarded delete), I3 (unfenced lock), I7 (no independent poll) |
| Dedicated CDN exposes only immutable public namespace | Not in scope (infra, in progress) |
| Backup freeze/manifest and staging restore drill | Not in scope (in progress) |
| Concrete health thresholds and alerts documented/tested | Not landed — `mediaCapacitySnapshot` has no non-test consumer; no protected health route yet |

---

## Recommended order

1. C1 — conditional delete + row lock in the stale-draft sweep (data loss).
2. I4 — example env files (blocks CI/fresh clones).
3. I3, I7 — fenced/renewed lock and a scheduler-independent outbox poll.
4. I1, I2 — atomic byte reservation and metering of failed bytes.
5. I5, I6 — gate ordering and one consistent admin policy across all six call sites.
6. I8 — completeness validation at submit.
7. MODERATEs, with M5/M6 worth doing alongside any assessment change.

---

## Unresolved questions

1. Is the admin exemption on the three photo routes intentional (admin correction is a moderation action), or
   should admins be subject to the same mode gate there as on create/patch/submit? Either answer is
   defensible; the current split is not.
2. Should abandoned-draft eligibility use `createdAt` (current) or `updatedAt`? The phase file says
   "draft >30 days" without saying 30 days since what.
3. Is per-user quota deliberately scoped to new-product drafts only, leaving `ProductEdit` staged-photo
   uploads governed solely by the global Phase 3 budget? That is consistent with "revisions unaffected" for
   the *mode gate*, but the capacity rationale for quotas would argue otherwise.
