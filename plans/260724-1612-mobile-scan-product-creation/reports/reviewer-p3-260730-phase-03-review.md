# Phase 3 review — product media pipeline and private VPS delivery

Commit under review: `04ee395` "feat(products): add secure photo pipeline" (branch `feature/mobile-scan-product-creation`).
Reviewed the **commit**, not the working tree (dev-1's Phase 4 changes in `packages/shared/src/schemas/admin/products.ts` etc. were ignored).

**Verdict: 2 CRITICAL, 4 IMPORTANT, 9 MODERATE.** Not landable as-is.

---

## Verification harness

| Item | What I did | Result |
|---|---|---|
| Isolated DB | `CREATE DATABASE pantry_rev_p3`, `CREATE EXTENSION pg_trgm`, `psql -f` over all 23 `api/prisma/migrations/*/migration.sql` in sort order, ran everything through `TEST_DATABASE_URL` | applied clean, 31 tables. **Dropped after.** No `prisma migrate deploy/dev/reset` anywhere; shared `pantry` only read (to obtain a DB login, never written); `pantry_test` never touched; `api/prisma/deferred-migrations/` untouched. Known older-table replay drift (task #14) not re-flagged. |
| Phase 3 focused suites | all 7 files named in the phase + `products-photo-routes.test.ts` + `tests/unit/config.test.ts` | **63 + 58 pass** |
| Full regression | `npx vitest run` | **100 files / 711 tests pass** |
| Typecheck | `npx tsc --noEmit` | **clean** |
| Scratch proofs | 4 throwaway test files (deleted; `git status` clean afterwards) | see evidence below |

---

## CRITICAL

### C1 — The processing deadline releases the concurrency slot but does not stop the work, so `MEDIA_SHARP_CONCURRENCY` does not bound decode at all

`api/src/services/products/product-image-processor.ts:243-264`

`Promise.race([run, deadline])` rejects on the deadline and the `finally` immediately calls `release()`, but `run` keeps executing. `pipeline?.destroy()` only destroys the *base* Sharp stream; the two `encodeVariant` calls run on `pipeline.clone()` pipelines that are never destroyed, and libvips work already dispatched to the threadpool is not cancellable. Net effect: every timed-out decode hands its semaphore slot to the next caller **while still consuming a libvips thread and its decoded-image memory**.

Proved empirically (scratch test, `MEDIA_SHARP_CONCURRENCY=1`, `MEDIA_PROCESSING_DEADLINE_MS=60`, four 6000×6000 PNGs):

```
SCRATCH_C timed-out decodes = 4 of 4
SCRATCH_C sharp.counters() right after all callers returned = {"queue":0,"process":4}
SCRATCH_C ms of libvips work still running AFTER the deadline fired = 1200
```

Four concurrent libvips decodes with a configured limit of one, all callers already returned. At the production ceiling (40 MP × 4 channels ≈ 160 MB resident per decode) an authenticated user who owns one draft can hold N slow uploads open and drive concurrent decodes without bound — exactly the phase's own `Decode resource exhaustion / Likelihood Medium / Impact Critical` risk, whose stated mitigation is "all numeric bounds + semaphore/deadline". Success criterion "Processing concurrency and deadline bound CPU/memory pressure" is **not met**.

Secondary defect in the same primitive: `acquireDecodeSlot` (`:104-117`) increments `activeDecodes` *after* awaiting the wait-queue, while `release()` decrements *before* waking a waiter. A caller whose `acquireDecodeSlot` runs as an already-queued microtask between those two points takes the slot too, and the woken waiter then increments on top of it — the counter can drift above `limit` under load. Counting callers rather than outstanding work is the root cause of both.

**Recommendation:** hold the slot until `run` actually settles (`await run.catch(() => {})` before releasing, or release in a `run.finally()`), and make the deadline abort real work — destroy the clone pipelines too, or move decode into a `worker_threads` pool that can be terminated. Rewrite `acquireDecodeSlot` to transfer the permit on release (do not re-increment in the waiter). Add a test that asserts `sharp.counters().process <= cfg.sharpConcurrency` — see M2 for why the existing concurrency tests could not catch this.

### C2 — The private-media route serves moderator-**rejected**/unapproved photo bytes of an active product to any authenticated user, and `GET /v1/products/:id` hands out the URL

`api/src/routes/products/private-media.ts:35-43`, `api/src/services/products/serializer.ts:14-33`

The route binds `photoId` to `productId` (good) and then gates on `getVisibleProduct`, which returns **any `active` product to every authenticated caller** (`api/src/services/products/product-visibility.ts:60`). `ProductPhoto.moderationStatus` is never consulted. `PRODUCT_INCLUDE` also has no moderation filter, so `toApiProduct` emits a private delivery URL for every photo row regardless of moderation state.

Proved with a scratch integration test (active product, photo `moderationStatus: 'rejected'`, requested by an unrelated ordinary user):

```
SCRATCH_A status = 200 body = REJECTED-ABUSIVE-CONTENT
SCRATCH_A product read = 200 [{"id":"1035252b-…","position":0,
  "thumbnailUrl":"/v1/products/5e1d5243-…/photos/1035252b-…/thumb",
  "displayUrl":"/v1/products/5e1d5243-…/photos/1035252b-…/display"}]
```

No ID guessing is needed — the product read enumerates the rejected photo for the attacker. This contradicts plan.md:22 ("without exposing unapproved catalog data to other users") and plan.md:121 ("only approved public media"). The route's own docstring ("Never serves an already-approved (public) photo's bytes") is also only true if a later phase nulls `privateStorageKey` on approval; the code asserts nothing about that.

Note this is *not* fixed by dev-1's serializer redaction landing in Phase 4: the byte route must enforce the rule itself. Redaction in the projection layer while the transport layer stays open is a trust-boundary defect.

**Recommendation:** in `private-media.ts`, require `photo.moderationStatus === 'pending' | 'approved'` **and** creator-or-admin when the product is `active` (an active product's *approved* photos should be served from the public CDN URL, not here). Filter non-approved photos out of `PRODUCT_INCLUDE`/`toApiProduct` for non-owner/non-admin readers. Add tests for `rejected` + unrelated-user and `rejected` + owner.

---

## IMPORTANT

### I1 — `completeMediaOperation` is unfenced: a reference transaction can "complete" an intent whose bytes recovery already deleted

`api/src/services/products/product-media-outbox.ts:74-79`, consumed at `api/src/services/products/product-photos.ts:173`

`completeMediaOperation` is a bare `update({ where: { id } })` — no `status`/`leaseOwner` predicate and no row-count assertion. If the producer's prepared lease expires while its reference transaction is still running, `processMediaOutboxOnce` claims the row, finds the key unreferenced (the reference has not committed yet), deletes the bytes and marks the row `completed`; the producer's transaction then commits a `ProductPhoto.privateStorageKey` pointing at deleted files and "completes" the already-completed intent without error.

Proved:

```
SCRATCH_B sweep = {"claimed":1,"completed":1,"failed":0}
SCRATCH_B bytes deleted by recovery = true
SCRATCH_B completeMediaOperation succeeded silently = true
```

The window is real because **`renewMediaOperationLease` has zero production callers** (`grep`: only `tests/integration/product-media-outbox.test.ts`). `addProductPhoto` prepares the intent with the default 60 s TTL and then enters a transaction that waits on `SELECT … FOR UPDATE` against the product row with no `lock_timeout`/`statement_timeout` — an unbounded wait under contention.

**Recommendation:** make completion a fencing operation — `updateMany({ where: { id, status: 'prepared', leaseOwner } })` and throw when `count === 0` so the reference transaction rolls back instead of committing a dangling reference. Thread `intent.leaseOwner` through to the caller and heartbeat it (`renewMediaOperationLease`) around the promote + reference transaction.

### I2 — `publishProductPhoto` writes final public bytes with no capacity reservation, and the test that claims otherwise never calls it

`api/src/services/products/product-photos.ts:322-344` (`copyKeyPrefix` with no `reserveMediaCapacity`), test `api/tests/integration/product-media-publication.test.ts:179-195`

Success criterion: "no final/public key is created without a live reservation". `publishProductPhoto` takes `(photoId, publicationId, intentId)` — there is no reservation parameter and no reservation call — so a publication set can copy an unbounded number of display+thumb pairs into `public/` with the budget completely bypassed. The test named `publishProductPhoto — capacity near the reserve` exercises only `reserveMediaCapacity` three times; `publishProductPhoto` does not appear in its body. The criterion is asserted about a different function than the one that writes bytes.

**Recommendation:** either accept a `capacityReservationId` in `publishProductPhoto` and assert it is live before the first `copyKeyPrefix`, or reserve `display+thumb` bytes internally and reconcile/release on every terminal path. Retitle/rewrite the test so it actually publishes.

### I3 — Up to 10 MiB per concurrent request is streamed to disk *before* any capacity reservation

`api/src/routes/products/photo-upload.ts:59` (`writeQuarantineFile`) vs `:77` (`reserveMediaCapacity`)

The phase requires reserving "worst-case source/generated bytes for upload" before writing, and the reservation comment claims it is "the gate, not an after-the-fact accounting entry". In fact the full source body lands in `quarantine/` first; the reservation only gates the *decode*. N concurrent uploaders can put N × `MEDIA_MAX_UPLOAD_BYTES` on the volume with the budget reading zero, which is precisely the disk-exhaustion mode the reserve headroom exists to prevent.

**Recommendation:** reserve `maxUploadBytes + maxDisplayBytes + maxThumbnailBytes` immediately after the authorization pre-check and before `writeQuarantineFile`; reconcile down to the real source size once the stream ends.

### I4 — The HEIC capability fixture is not emitted by the build, so HEIC is permanently disabled in any compiled deployment

`api/src/services/products/product-image-processor.ts:58-61`, `api/tsconfig.build.json`, `api/package.json` (`"build": "tsc -p tsconfig.build.json"`, `"start": "node dist/server.js"`)

`readHeicFixture()` resolves `./__fixtures__/heic-probe-sample.heic` relative to `import.meta.url`. `tsc` copies no non-`.ts` assets:

```
$ npx tsc -p tsconfig.build.json --outDir /tmp/p3build && find /tmp/p3build -name '*.heic' | wc -l
0
```

At runtime the probe throws ENOENT, is swallowed at `:73-76`, and logs "HEIC capability probe fixture unreadable; treating HEIC as unsupported". So on a host whose libvips *can* decode HEIC, HEIC uploads are still rejected — the requirement "HEIC only when startup decode capability passes" degrades to "HEIC never", silently, and only in production. Tests pass because vitest runs from `src/`.

(Separately: `pnpm --dir api build` currently fails outright with `TS6059` because `src/services/products/lookup.test.ts` imports `tests/helpers/factories.js`. **Pre-existing** — present at `HEAD~1` — so not a Phase 3 finding, but it means nobody has run the production build recently and this defect would surface the moment the build is fixed.)

**Recommendation:** copy the fixture in the build step (or move it under a runtime-resolved `assets/` path with an explicit copy), and make an unreadable fixture on a host with static HEIF input support a startup **error**, not a silent warning — otherwise the failure is indistinguishable from a genuinely HEIC-incapable host.

---

## MODERATE

### M1 — Capacity/intent heartbeats are implemented but never used in production
`heartbeatMediaCapacityReservation` and `renewMediaOperationLease` have no non-test caller. The phase explicitly requires heartbeating "the intent, lease, and whole-set reservation through all copies plus the caller's reference transaction". As shipped, both are dead code that makes the mechanism *look* complete. (Root cause shared with I1.)

### M2 — The two decode-concurrency tests assert nothing about concurrency
`api/src/services/products/product-image-processor.test.ts:270` — `expect(elapsed).toBeGreaterThanOrEqual(0)` is vacuous; `:273-281` only asserts `results).toHaveLength(10)`. Neither observes `activeDecodes` or `sharp.counters()`, which is why C1 shipped green. Replace with an assertion on peak in-flight work.

### M3 — Capacity budget never accounts for bytes already on disk
`product-media-capacity.ts:105-113` + `product-photos.ts:186`: the reservation is released on the *success* path too, and nothing persists actual usage. The budget therefore bounds only concurrent in-flight work, never cumulative disk. The trade-off is documented at `product-media-capacity.ts:16-22`, but success criterion "uploads and complete publication sets cannot exhaust reserved disk" reads stronger than what is implemented. Either soften the criterion or add a persisted usage counter (Phase 7 sweeper could reconcile it).

### M4 — No optimistic-concurrency precondition on any photo mutation
plan.md:57 requires "optimistic `version`" for photo mutations and the phase's Task 3 test list names a "stale version" case. `productDraftReorderRequestSchema` (`packages/shared/src/schemas/product.ts:277-285`) carries no `version`, and none of `photo-upload.ts` / `photo-delete.ts` / `photo-order.ts` accept or check one — they only *increment* `product.version`. Two clients editing the same draft silently last-write-wins the order. Possibly a Phase 1 contract gap rather than a Phase 3 coding error, but it needs an owner before Phase 5 builds the editor on it.

### M5 — Outbox `finalizeSuccess`/`finalizeFailure` are not lease-guarded
`product-media-outbox.ts:158-181`: both are bare `update({ where: { id } })`. A worker whose 60 s processing lease expired mid-run (and whose row was reclaimed by a second worker) will still overwrite `status`/`attempts`/`availableAt`, clobbering the live worker's state. Add `leaseOwner: workerId` to the predicate, same fix shape as I1.

### M6 — `SET CONSTRAINTS ALL DEFERRED` is broader than intended
`product-photos.ts:217, 288`. Today only the two position unique constraints are deferrable (verified against the scratch DB via `pg_constraint`), so behaviour is correct — but any future deferrable FK would be silently deferred inside these transactions. Name the two constraints explicitly.

### M7 — Private variants are fully buffered into memory per request
`private-media.ts:43` / `edit-private-media.ts:44` use `readFile` then `reply.send(buffer)`. At the 8 MiB display ceiling, concurrent admin/mobile fetches multiply directly into heap. Stream with `createReadStream` (still no-store, still `image/webp`).

### M8 — The five-photo cap is enforced only inside the reference transaction
`product-photos.ts:147-154`. Verified behaviour is correct and residue-free (`sixth-photo = 409 photo_limit_reached`, `quarantine residue = []`), but a capped product still pays a full stream + decode + WebP encode + temp write + rename on every rejected attempt. `assertPhotoMutablePreCheck` (`:91-98`) already does an unlocked read; add a non-authoritative count there so the common abuse case is cheap.

### M9 — Untested branches and minor contract nits
- `removeProductPhoto`'s P2003 → 409 "retained by an in-progress edit" branch has **no test**. I verified it works (`SCRATCH_E … status=409 code=conflict`), but Phase 4 will depend on it.
- `enqueueMediaCleanup` returns `{ id: '' }` for an empty key list (`product-media-outbox.ts:90`) — a sentinel no caller distinguishes from a real ID.
- `photo-upload/-delete/-order` `reply.send(product)` without a response-schema `.parse()`, unlike `drafts.ts:23` (`productDraftsPageSchema.parse(page)`). A misclassified photo/product shape would ship silently.
- `MediaPathError` is not an `AppError` and carries no `statusCode`, so anything that reaches `toProblem` via that class becomes a generic 500. Currently unreachable (busboy truncates before the byte counter fires) but fragile.

---

## Verified clean (explicitly checked, no finding)

- **Path containment.** Every path is built from fixed literals plus `assertUuidSegment`-validated, server-generated UUIDs; `resolveMediaPath` charset-validates each segment *and* re-asserts the resolved prefix (`product-media-storage.ts:36-65`). No client string reaches `join`/`resolve`. Traversal, separator, empty-segment and post-split escape cases are all covered by tests.
- **Hostile multipart.** Field-before-file, second file part, field-only, non-multipart, and >`parts` overflow all produce typed 4xx, never a raw plugin error (`parts-overflow = 400 validation_error`). Zero-byte file → 415. GIF and MP4 renamed `.jpg` with `Content-Type: image/jpeg` → 415, rejected by libvips content sniffing, never by extension. Quarantine root was empty after every rejection.
- **Decompression bombs.** Pixel/dimension/channel limits are enforced with `limitInputPixels`/`limitInputChannels` at the libvips decode boundary *plus* explicit post-metadata checks; the CRC-patched IHDR fixture proves a header-claimed 2000×2000 bomb is rejected without materialising pixels. Output-byte ceilings on the generated WebP are enforced and tested.
- **Metadata stripping / colour / orientation.** `rotate()` + `toColourspace('srgb')`, no `withMetadata()`; test asserts `metadata.exif === undefined` and `space === 'srgb'`, and `withoutEnlargement` is asserted.
- **Per-product serialization is real, not comment-only.** `assertPhotoMutable` issues an actual `SELECT … FOR UPDATE` via `$queryRaw` with correct `AS "camelCase"` aliases (`product-photos.ts:72-77`); the concurrent-quota-race test holds at exactly 5 photos.
- **Deferrable-constraint hazard respected.** No `upsert`/`ON CONFLICT` against `(product_id, position)` / `(product_edit_id, position)` anywhere; reorder and delete-reindex both use `SET CONSTRAINTS … DEFERRED` + per-row `update`. `product.version` is incremented inside the same transaction on add, remove and reorder.
- **Parent-binding and non-enumeration.** Both delivery routes bind child→parent in the query before any authorization; cross-product, cross-edit and cross-kind substitution all 404. Edit route is creator-or-admin only. Retained (`sourceProductPhotoId`) entries 404. Headers are `image/webp` + `nosniff` + `private, no-store`. Bearer tokens never appear in a URL.
- **Crash test is genuine.** `product-media-outbox-crash.test.ts` really `spawn`s a Node child, waits for a `READY` sentinel emitted after the intent commit + real `rename`, `SIGKILL`s it, and asserts the outbox sweep (not the dead process) removes the bytes. Child is reaped; no stray processes left.
- **Outbox claim safety.** `FOR UPDATE SKIP LOCKED` in a short claim transaction; the "two concurrent callers, one row" test genuinely proves single delivery. Backoff/attempt/terminal-`failed` transitions tested.
- **`copyKeyPrefix` never overwrites** (`errorOnExist` + pre-check), public prefixes always carry a fresh publication UUID, and `publishProductPhoto` copies rather than moves.
- **Cross-ownership touches.** `serializer.ts` public-vs-private branch is correct (`public/` prefix stripped exactly once, trailing-slash normalised) and `toApiProductPhoto`'s new `productId` parameter has no un-updated caller. `product-drafts.ts` cover URL correctly uses the parent-bound private route unconditionally. Position sort preserved. No regression in the 100-file suite.

---

## Acceptance criteria walk-through

| Criterion | Status |
|---|---|
| Every hostile input/resource limit has a typed failure and zero residue | **Met** |
| Processing concurrency and deadline bound CPU/memory pressure | **NOT met** — C1 |
| Private/public trees physically separate; public bytes use fresh immutable UUID paths | Met |
| Ordered photo quota/version invariants survive concurrency | Met |
| Private product and staged-edit byte fetches require parent-bound caller authorization and are no-store | **Partially** — parent-bound and no-store yes, but authorization ignores moderation state on active products (C2) |
| Prepared-intent/outbox tests prove recovery across crash gaps | **Partially** — recovery works, but completion is unfenced and the lease is never renewed (I1) |
| Atomic capacity tests prove uploads and complete publication sets cannot exhaust reserved disk | **NOT met** — I2, I3, M3 |
| Publication fault tests prove compensation/recovery | Met for the paths that exist; publication capacity is untested against the real function (I2) |

---

## Unresolved questions

1. **C2 ownership** — should an active product's *approved* photos still be readable via the private route at all (dual-serving during the post-approval cleanup window), or should the route hard-reject once `publicStorageKey` is set? That determines whether the fix is "add a moderation predicate" or "add a moderation predicate + require creator/admin for every non-public read". Needs a product call before Phase 4 wires moderation.
2. **M4 ownership** — is the missing `version` on photo mutations a deliberate Phase 1 contract decision or an omission? If deliberate, plan.md:57 should be amended so Phase 5 does not assume optimistic concurrency exists.
3. **I4** — is the compiled `dist/` path actually the deployment target? `pnpm --dir api build` is broken today (pre-existing `TS6059`), so this may be latent rather than live; confirming the deploy method changes whether I4 is "already broken in prod" or "will break the first time the build is fixed".

---

# Re-verification (task #15 remediation) — 260730

Re-reviewed `d600282` + `99da862` (dev-3 remediation) and, for the four items whose files
were interleaved with Phase 4, the final committed state at `03a4ea7`. Addendum cross-checked:
`reports/260730-0755-phase-03-remediation-addendum.md`.

**Verdict: all 2 CRITICAL and 4 IMPORTANT closed. 8/9 MODERATE closed; M4 confirmed as a
documented, approved deviation (not re-flagged). 3 new MODERATE residuals + 1 out-of-scope
observation for the Phase 4 review.**

## Harness

Reviewed in a detached `git worktree` so dev-1's then-uncommitted Phase 4 work could not
contaminate the result. Fresh throwaway DBs `pantry_rev_p3b` (at `99da862`) and
`pantry_rev_p3c` (at `03a4ea7`), 24 migrations replayed via `psql -f`, `TEST_DATABASE_URL`,
both `DROP`ped; shared `pantry` read-only, `pantry_test` untouched, no `migrate
deploy/dev/reset`, `deferred-migrations/` untouched. Worktree removed, all scratch tests
deleted, `git status` clean for `api/`.

> Note for the record: an initial typecheck/build inside the worktree reported four
> `TS2339` errors in `admin/products/merge.ts` (`winnerId`/`loserIds`). That was
> **contamination**, not a defect — the symlinked `@expyrico/shared` resolved to
> `/opt/newapp/packages/shared`, which dev-1 had already renamed to `targetId`/`sourceIds`
> in an uncommitted change. After pinning `packages/shared` to the same commit, typecheck
> and build are clean.

## Per-finding verdicts

| # | Verdict | Independent evidence |
|---|---|---|
| **C1** | **CLOSED** | Re-ran my original repro shape (4 × 6500² noisy PNG, `MEDIA_SHARP_CONCURRENCY=1`). Before: `{queue:0, process:4}` with 1200 ms of work continuing after all callers returned. Now: `peak in-flight libvips tasks = 1`, `counters immediately after all callers returned = {"queue":0,"process":0}`, `ms of libvips work still running = 0`, all 4 rejected `processing_timeout`. Sharp's own `.timeout()` genuinely aborts the `.clone()`d encode pipelines. The `acquireDecodeSlot` permit-transfer rewrite is correct (decrement only when there is no waiter). M2's vacuous assertions are replaced by real `sharp.counters()` peak sampling. |
| **C2** | **CLOSED, both layers** | Active product + unrelated authenticated user: serializer returns `photos = []` for both `rejected` and `pending`; the forged byte URL (attacker "already knows" the photo ID) returns **404** in both cases. Policy matrix confirmed: `rejected→creator = 404`, `rejected→admin = 200`, `pending→creator = 200` with `image/webp` + `private, no-store`. Verified the route's structural claim against the schema: `product_photos_storage_and_moderation_check` really does force `approved ⇒ private_storage_key IS NULL`, so the `!privateStorageKey → 404` guard cannot be reached by an approved row. |
| **I1** | **CLOSED** | My original SCRATCH_B now inverts: sweep reclaims and deletes the bytes, and the producer's reference transaction throws `MediaOperationFencedError` and rolls back instead of committing a dangling `privateStorageKey`. Happy path unaffected (`status = completed`, `leaseOwner = null`). `renewMediaOperationLease` now has real callers in `addProductPhoto` and both publish functions (M1). `finalizeSuccess`/`finalizeFailure` are `leaseOwner`-guarded (M5). |
| **I2** | **CLOSED** | `publishProductPhoto` now takes a `PublishIntentContext` and calls `assertMediaCapacityReservationLive` before the first `copyKeyPrefix`. Proved: dead reservation → `status=507 code=capacity_exceeded` with **no public key created**; live reservation → key created. The old test that never called the function under test has been rewritten. |
| **I3** | **CLOSED** | `reserveMediaCapacity` moved ahead of `writeQuarantineFile`. Proved with an exhausted budget: request returns 507 and the media root contains **no `quarantine` directory at all** — the mkdir inside `writeQuarantineFile` never ran, so not one byte reached disk. |
| **I4** | **CLOSED** (and `d600282` verified) | With `packages/shared` pinned to the same commit, `npx tsc --noEmit` → exit 0 and `tsc -p tsconfig.build.json` → **exit 0** (previously TS6059), emitting **0** `*.test.js` files. `dist/services/products/__fixtures__/heic-probe-sample.js` is present; executing it from the compiled output returns the real 718 114-byte fixture with a valid `ftyp` box, and the probe reaches a genuine decode verdict (this host: HEVC decode fails → HEIC correctly disabled — a real answer now, not an ENOENT artifact). Unreadable fixture + `true` static flag is now a startup error, not a swallowed warning. |
| **M1, M2, M5, M6, M7, M8, M9** | **CLOSED** | M6: both call sites now name `"product_photos_product_id_position_key"` (and Phase 4's edit equivalents follow the same pattern). M7: `createReadStream` after a cheap `stat()`. M8: `assertPhotoMutablePreCheck` now selects `_count.photos` and rejects a full product before the body is read. M9: `enqueueMediaCleanup` returns `{id}|null`; `MediaPathError extends AppError`; routes `productSchema.parse(...)`; the P2003 retained-photo branch has a dedicated test at `products-photos.test.ts:172`. M5 has no dedicated test — disclosed in the addendum, accepted (identical guard shape to the tested `completeMediaOperation` fix). |
| **M3** | **CLOSED as documented** | `product-media-capacity.ts` header now states precisely what is and is not bounded and assigns the persisted counter to Phase 7. This is the resolution my own recommendation offered. |
| **M4** | **Not re-flagged** | Deliberate, team-lead-affirmed deviation; documented in the addendum with rationale (Phase 5 per-photo retry design + `FOR UPDATE` + transactional version bump). Documentation requirement satisfied. Only open item is amending plan.md:57 so the written constraint matches the shipped contract. |

Regression: full suite at `03a4ea7` — **103 files / 780 tests pass**; typecheck clean; production build clean.

## New residuals (all MODERATE, none blocking)

### R1 — The processing deadline now restarts per libvips operation, so it no longer bounds a whole request
`product-image-processor.ts` — `.timeout({ seconds })` is set on the pipeline, and sharp's
clock starts when libvips opens an input for processing. `metadata()`, the display encode and
the thumb encode are three separate runs, each getting a fresh clock. Proved: a request whose
uncapped wall time was **1498 ms** completed successfully in **1397 ms** under a configured
deadline of **1000 ms**. So `MEDIA_PROCESSING_DEADLINE_MS=30000` admits roughly 2–3× that per
request. This is a far better trade than the old (uncancellable) deadline and I would not
revert it — but the phase's "processing deadline 30 seconds" is now approximate.
**Recommendation:** either divide the configured budget across the stages, or wrap the whole
call in a wall-clock guard that only *reports* (the real cancellation now comes from sharp),
or amend the documented bound.

### R2 — Nothing heartbeats the capacity reservation across the upload, and `reconcile` can resurrect a dead one
`photo-upload.ts` now holds the reservation from before the stream through decode to the DB
write, but never calls `heartbeatMediaCapacityReservation` in between; the TTL is 120 s and a
slow mobile upload plus a 30 s decode can exceed it. Two consequences, both proved:
`currentReservedMediaBytes()` drops to 0 once the TTL lapses (budget silently over-commits
while the upload continues), and `reconcileMediaCapacityReservation` then issues
`SET … KEEPTTL` against a **missing** key, which creates it with `TTL = -1` (never expires)
and outside the index set — invisible to the budget, and a permanent Redis leak if the process
dies before the `finally`. Note `addProductPhoto` has no `assertMediaCapacityReservationLive`
gate, so unlike publication the private-promotion path can write final bytes with a dead
reservation. **Recommendation:** heartbeat during the stream/decode; add
`assertMediaCapacityReservationLive` before `promoteKeyPrefix`; make reconcile use
`SET … XX KEEPTTL` so it can never resurrect a dead reservation.

### R3 — `toApiProduct`'s `viewer` parameter is optional and fails open
`serializer.ts` — `isPhotoVisibleTo` returns `true` for every photo when `viewer` is
`undefined`. All four current viewer-less call sites are genuinely privileged (I checked each:
`product-drafts.ts` ×2 owner-scoped, `product-moderation.ts` ×3 admin actions,
`product-edits.ts:442` admin edit-resolve), so there is no live leak. But the safety of C2's
projection layer now rests on a doc comment ("every reader-facing route MUST pass one") rather
than the type system, and the failure mode of forgetting it is silent un-redaction.
**Recommendation:** make the parameter required and use an explicit
`{ kind: 'privileged' } | SerializerViewer` union so omission is a compile error.

## Out of scope — flagged for the Phase 4 review (#16)

`product-photos.ts:441` — `publishProductEditPhoto` builds its public key with
`publicProductPhotoPrefix(photo.productEditId, publicationId)`, i.e. the **edit** ID where the
helper's contract and the phase spec's key layout (`public/products/<product-id>/<publication-uuid>`)
both expect the product ID. Functionally harmless today (both are UUIDs and the path is only
ever read back from the stored key), but it breaks the documented namespace and any Phase 7
ops/backup tooling that maps `public/products/<id>/` back to a product. Belongs to `03a4ea7`,
not to this remediation.

## Unresolved questions (updated)

1. Original Q1 (C2 ownership) — **answered** by the team-lead ruling now implemented and tested:
   rejected is admin-only, pending is creator-or-admin.
2. Original Q2 (M4) — **answered**: deliberate deviation. Remaining action is amending plan.md:57.
3. Original Q3 (I4 deploy target) — still open in the sense that nobody has confirmed `dist/` is
   what production runs; the defect is fixed either way.

---

## Attribution follow-up — everything re-proved against `99da862` in isolation

The team-lead's original attribution note (dev-3's changes to 5 interleaved files would ship
inside dev-1's Phase 4 commit) was later corrected: `99da862` contains **all** of dev-3's
remediation. My first re-verification pass had proved C1/I1/I4 at `99da862` but ran the
C2/I2/I3 proofs at `03a4ea7` (HEAD). Closed that gap by re-running every proof against a
fresh detached worktree at `99da862` with `packages/shared` pinned and rebuilt at the same
commit, on a throwaway `pantry_rev_iso` (24 migrations replayed, dropped after).

Results are identical to HEAD — no finding depended on anything in dev-1's commit:

```
ISO_C1 timedOut = 4 | peak in-flight (limit 1) = 1 | counters after all returned = {"queue":0,"process":0}
ISO_C2[rejected] serializer photos = [] | forged byte URL = 404
ISO_C2[pending]  serializer photos = [] | forged byte URL = 404
ISO_C2 rejected→creator = 404 | rejected→admin = 200 | pending→creator = 200 private, no-store image/webp
ISO_I1 sweep = {"claimed":1,...} | bytes deleted = true | stale complete => threw MediaOperationFencedError | happy path = completed
ISO_I3 status = 507 | media root entries = [] (no "quarantine" => write never happened)
ISO_I2 dead reservation => rejected status=507 code=capacity_exceeded | public key created = false || live reservation => created = true
```

Also at `99da862` in isolation: `npx tsc --noEmit` exit 0, full suite **100 files / 730 tests
pass**, `tsc -p tsconfig.build.json` exit 0 emitting **0** test files with the HEIC fixture
module present. This independently confirms dev-3's claim that the commit stands alone, and
retro-confirms that the four `merge.ts` `TS2339` errors from my first pass were purely
dev-1's uncommitted `packages/shared` rename leaking through the symlinked module — with
shared pinned to the same commit they do not occur.

Verdict unchanged: all CRITICAL and IMPORTANT closed, 8/9 MODERATE closed, M4 an approved
documented deviation, residuals R1–R3 outstanding (tracked as task #17).

---

# Residual verification (task #17) — `6883fb8` (+ R2 rider in `9e17ee8`)

**Verdict: CLEAN. R1, R2, R3 all closed; plan.md:57 amendment accurate.** No new findings in
scope. Two infra observations below, both already fixed by others while I was verifying.

Verified in a detached worktree at `6883fb8` with `packages/shared` pinned and rebuilt there;
throwaway `pantry_rev_r` (24 migrations, dropped); `pantry` read-only. Confirmed `api/src` and
`packages/shared/src` are byte-identical between `6883fb8` and the then-tip `b7950d2` for every
R1–R3 surface, so the result holds at the tip.

### R1 — whole-request deadline restored, without reintroducing abandon-without-cancel

The fix races `run` against an outer deadline but attaches cleanup/`release()` to
`run.finally()` rather than to the race, so the semaphore is still gated on real work settling.
Both halves proved:

Pinned the deadline at **1000 ms** — sharp's per-operation minimum — against an image whose
three libvips ops each finish well under 1 s, so a per-operation timeout structurally *cannot*
fire. Three consecutive runs at varying box load:

```
R1 uncapped total = 2734ms | deadline = 1000ms -> rejected 408/processing_timeout after 1016ms
R1 uncapped total = 5101ms | deadline = 1000ms -> rejected 408/processing_timeout after 1002ms
R1 uncapped total = 5471ms | deadline = 1000ms -> rejected 408/processing_timeout after 1001ms
```

Rejection lands *exactly* at the configured deadline — the signature of the outer bound. The
identical probe at `99da862` **resolved** (1498 ms of work under a 1000 ms deadline), so this is
the same probe with the opposite outcome.

Cancellation not regressed — 4 heavy decodes at `MEDIA_SHARP_CONCURRENCY=1`:

```
R1 timedOut = 4 | peak in-flight (limit 1) = 1 | counters immediately after all callers returned = {"queue":0,"process":1} | ms still running after = 150-350
```

The single residual `process:1` is the *last* caller's own work being reaped by sharp's
per-operation cancellation while its slot is still held (release is in `run.finally`). At most
one straggler, always cancelled, and peak never exceeded the configured limit — this is the
correct trade, not a leak.

### R2 — reservation lifetime

```
R2 reconcile(expired) returned = false | key value = null | TTL = -2 (key absent)
R2 reconcile(live)    returned = true  | reserved now = 400 | TTL preserved = 60
R2 addProductPhoto(dead reservation) => rejected 507/capacity_exceeded | photo rows = 0 | stray private dir = false
R2 upload, reservation deleted mid-flight (deterministically, by polling until the route created it)
   => 507 "Media capacity reservation expired before the operation completed" | photo rows = 0
```

`SET … KEEPTTL XX` no longer resurrects a TTL-less unindexed key (was `TTL = -1`, value `400`);
the live path and its TTL are unaffected. The private-promotion gate in `addProductPhoto`
(landed in `9e17ee8`, test in `6883fb8`) refuses to promote final bytes under a dead
reservation and leaves nothing behind. In the mid-flight case the pre-decode
`assertMediaCapacityReservationLive` heartbeat fires even before the reconcile guard — belt and
braces, both present.

### R3 — viewer required

A viewer-less call is now a compile error:

```
src/zz-viewer-probe.ts(5,20): error TS2554: Expected 2 arguments, but got 1.
```

Removing just that line typechecks clean, so both `{ kind: 'privileged' }` and an actor viewer
compile. All 6 privileged call sites are explicit (`product-moderation.ts` ×3,
`product-edits.ts` ×1, `product-drafts.ts` ×2); every reader-facing site passes an actor.
Behaviour holds: privileged = 1 photo, plain viewer = 0, admin = 1 for a `rejected` photo.

### plan.md:57

Amendment is accurate against the shipped contract — re-checked that
`productDraftReorderRequestSchema` carries no `version`, the three photo routes accept none,
`assertPhotoMutable` really does `SELECT … FOR UPDATE`, and `product.version` is bumped inside
the same transaction. Wording now matches the code.

### Regression

Full suite at `6883fb8`: **106 files, 842 tests, 840 pass, 2 fail — both proven load flakes,
not regressions** (see below). Typecheck clean once the unrelated dangling admin import is
accounted for.

### Infra observations (not dev-3's, both since fixed by others)

1. **Branch did not typecheck or build from a clean checkout.** `3e76b23` committed
   `import { adminProductsPendingGetRoute } from './products/pending-get.js'` into
   `api/src/routes/admin/index.ts` while `pending-get.ts` stayed untracked (and itself needed an
   uncommitted `adminProductEditDetailSchema` export). Every commit `3e76b23..b7950d2` was
   affected. Tracked as task #20 and now fixed — `pending-get.ts` is committed at
   `03a3680`.
2. **Two of the tests added for C1/R1 have fixed timeouts but CPU-proportional runtimes.**
   `product-image-processor.test.ts`'s concurrency-bound test (15 s budget) and outer-deadline
   test (20 s) time out on a loaded box. Proved it is budget, not behaviour: at load ~12 the
   concurrency test *times out* at 15 s but **passes in 26.8 s** when I raised only the budget —
   the assertion itself (`peak ≤ MEDIA_SHARP_CONCURRENCY`) holds. Worth shrinking the fixtures
   or raising those two budgets, otherwise they will flake in CI.
3. Separately, four media tests failed on shared Redis db 15 and **all four passed on an
   isolated db** — R2's new capacity-liveness gates make these newly sensitive to a foreign
   `flushdb()`. Task #22 / commit `03a3680` (`TEST_REDIS_URL` per-run isolation) is exactly the
   right fix.

Nothing outstanding from my review of this phase.
