# Reviewer P4 — Phase 4 review (commit `03a4ea7` "feat(products): add moderation and revisions")

Branch `feature/mobile-scan-product-creation`. Scope: commit `03a4ea7` only (38 files, +3277/−113).
Working-tree changes in `apps/admin`, `infra`, `workers`, `api/src/routes/admin/products/pending-get.ts`,
`api/src/routes/admin/settings/product-creation.ts` etc. belong to dev-2/dev-3 and were excluded.

## Verification performed

- Isolated DB `pantry_p4rev` provisioned from all 24 `api/prisma/migrations/*` via `psql -f` in sort
  order (`pg_trgm` created), run with `TEST_DATABASE_URL`, dropped afterwards. `pantry`/`pantry_test`
  untouched; no `prisma migrate` invoked; `deferred-migrations/` untouched.
- `pnpm vitest run tests/integration/{admin-product-moderation,product-edits,admin-product-merge,audit-log}.test.ts`
  → **52 passed / 52**.
- `pnpm vitest run` (full api suite) → **783 passed, 1 failed / 784** (see N1 — pre-existing Phase 3
  test, not in this diff).
- `pnpm typecheck` → 1 error, in dev-2's untracked `api/src/routes/admin/products/pending-get.ts`
  (`adminProductEditDetailSchema` does not exist). Not attributable to `03a4ea7`; the commit's own
  `packages/shared` typechecks clean in a detached worktree at `03a4ea7`.
- Five throwaway integration tests written to prove C1/I1/I2/I3/I5, plus one to re-verify the task-#13
  resubmission guard. All scratch files deleted; `git status` clean of my changes.

---

## CRITICAL

### C1 — Staged revision photos are published under the **edit id**, not the product id, so the prepared intent and the compensation path both target keys that were never written

`api/src/services/products/product-photos.ts:441` (`publishProductEditPhoto`):

```ts
const publicPrefix = publicProductPhotoPrefix(photo.productEditId, publicationId);
```

The caller, `api/src/services/products/product-edits.ts:453`, computes an entirely different set:

```ts
const targetKeys = staged.map((p, i) => publicProductPhotoPrefix(product.id, publicationIds[i]!));
const intent = await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'publish_public', keys: targetKeys }));
```

`publicProductPhotoPrefix(a, b)` → `public/products/${a}/${b}` (`product-media-storage.ts:135`), so the
bytes land at `public/products/<editId>/<pubId>` while the durable intent records
`public/products/<productId>/<pubId>`.

Proved on the isolated DB (approve a revision with one staged photo):

```
PUBLIC KEY:  public/products/cb0d0d68-4ba6-4994-98e0-85a91df4bf29/395b1347-…   (= edit id)
productId:   6500bfe2-7d36-41ec-a423-a9cd32525ca8
INTENT KEYS: ["public/products/6500bfe2-7d36-41ec-a423-a9cd32525ca8/395b1347-…"]   (= product id)
```

Three consequences, all breaking the phase's own success criterion *"Failed public publication/DB
transition leaves no referenced or leaked public object"*:

1. **Compensation is a no-op.** `product-edits.ts:469`
   `await Promise.all(targetKeys.map((key) => removeKeyPrefix(root, key)…))` deletes the product-id
   path, which does not exist. Every failed revision approval (version conflict inside
   `applyReference`, FK error, crash) leaks the copied public bytes permanently — silently, because the
   `.catch(() => {})` swallows nothing here: the unlink simply succeeds against a missing path.
2. **Expired-intent recovery is a no-op** for the same reason — the "durable backstop" documented at
   `product-edits.ts:468` and required by plan constraint line 58 cannot find the real keys.
3. **The persisted `ProductPhoto.publicStorageKey` sits outside the product namespace.** Any
   product-scoped reference/sweeper logic (Phase 7) will classify a live, approved, publicly-served
   photo as orphaned; conversely the public CDN URL now embeds an internal `ProductEdit` id.

The existing test `product-edits.test.ts:206` ("approve applies … and publishes staged bytes") only
asserts a `publicStorageKey` exists and the file is present, never that the key is under the product,
matches the intent, or is removed on failure — which is why this passes CI.

**Cross-review note (severity disagreement).** reviewer-p3 independently flagged the same line during
their Phase 3 re-verification, scoped as a documented-namespace break that is *"harmless at runtime
today"* and pegged IMPORTANT because Phase 7's backup/ops tooling maps public keys back to products.
I found this independently before that datapoint arrived and I do not agree with the "harmless at
runtime" reading — the namespace break is the *least* of it. The keys written by `publishProductEditPhoto`
and the keys recorded/compensated by `approveEdit` are two different strings **on every single call**,
so the two durability mechanisms Phase 3 exists to provide are already dead on this path today, before
Phase 7 ships anything:

- `removeKeyPrefix(root, targetKeys[i])` at `product-edits.ts:469` cannot delete bytes that live under a
  different prefix. It does not throw — `removeKeyPrefix` on a missing path succeeds — so the failure is
  totally silent.
- The `prepared` intent row that outlives a process death carries keys that do not exist, so
  expired-intent recovery has nothing to find and the real bytes are never reclaimed.

That is unreferenced-public-byte leakage on every failed revision approval, which is the exact condition
the phase's own success criterion and its Critical-rated "Publish without audit/state" risk row are
written to exclude. Severity stays **CRITICAL**. The namespace/Phase-7 concern reviewer-p3 raised is real
and is fixed by the same one-line change, so this is a scoping disagreement, not a conflicting finding.

**Recommendation:** derive the public prefix from the edit's `productId`
(`publishProductEditPhoto` should take the target product id, or look it up via
`productEdit.productId`), and add an assertion in the approve test that
`publicStorageKey` ∈ the prepared intent's `keys` and starts with `public/products/${product.id}/`.
Add a real failure-injection test asserting zero files remain under the public root after a failed
`applyReference`. Existing rows created by this path (if any deployed) need a key rewrite + byte move.

---

## IMPORTANT

### I1 — Approving a revision that drops a live photo throws an unhandled `P2003` (HTTP 500) whenever any *historical* edit retained that photo

`api/src/services/products/product-edits.ts:410-411`:

```ts
for (const removed of removedLivePhotos) {
  await tx.productPhoto.delete({ where: { id: removed.id } });
```

`ProductEditPhoto.sourceProductPhoto` is `onDelete: Restrict` (`prisma/schema.prisma:483`). The guard
immediately above (`product-edits.ts:344-346`) only looks for **open** edits
(`status in [draft,pending,changes_required], isLegacy:false`). Rows belonging to already-`approved`
or `rejected` edits are never cleaned up and hold the FK forever.

Reproduced: creator A opens a metadata-only revision (seeded with the live photo as `retained`), admin
approves it; creator B then opens a revision that drops that photo and submits; admin approve →

```
F2 ERROR: P2003 PrismaClientKnownRequestError
Invalid `tx.productPhoto.delete()` invocation in .../product-edits.ts:411:31
```

Not an `AppError`, so it surfaces as a 500 with a Prisma stack, and the photo becomes permanently
undeletable through this path. `removeProductPhoto` (`product-photos.ts:279-288`) at least catches
P2003 — but reports it as *"retained by an in-progress edit"*, which is factually wrong for a
historical edit and equally permanent.

**Recommendation:** decide the retention policy for resolved edits' `ProductEditPhoto` rows —
either null out `sourceProductPhotoId` (or delete the rows) when an edit reaches a terminal state, or
snapshot the retained-photo identity into the edit row instead of an FK. Until then, at minimum catch
P2003 in `applyReference` and return a typed 409, and correct `removeProductPhoto`'s message.

### I2 — Multi-source merge throws an unhandled `P2002` (HTTP 500) when one user reviewed two source products

`api/src/services/admin/merge.ts:147-156`. Dedup only compares source reviews against the **target**'s
reviewers:

```ts
const targetUserIds = new Set((await tx.review.findMany({ where: { productId: resolvedTargetId }, … })).map(r => r.userId));
const toDelete = sourceReviews.filter((r) => targetUserIds.has(r.userId)).map((r) => r.id);
```

Two sources reviewed by the same user are both repointed and collide on
`Review @@unique([userId, productId])` (`prisma/schema.prisma:581`). Reproduced with
`mergeProducts(admin, {}, [s1.id, s2.id], target.id, v)`:

```
F3 ERROR: P2002
Invalid `tx.review.updateMany()` invocation in .../merge.ts:153:38
```

`adminProductMergeSchema` explicitly accepts `sourceIds: z.array(...).min(1)`, so this is a supported
request shape. The merge test file only ever merges a single source.

**Recommendation:** dedupe across the whole merge set, not just against the target — pick one
surviving review per `userId` (target's if present, else a deterministic source pick) and delete the
rest, then recalc tallies. Add a multi-source test with a shared reviewer.

### I3 — `approveEdit` never re-guards the `ProductEdit` row inside its transaction, so an in-flight approval silently overwrites a concurrent `supersede` / `request_changes` / creator resubmission

`api/src/services/products/product-edits.ts:423-426`:

```ts
await tx.productEdit.update({
  where: { id: edit.id },
  data: { status: 'approved', resolvedBy: actor.id, resolvedAt: new Date(), version: { increment: 1 } },
});
```

No `status`/`version` predicate — unlike `requestChangesOnEdit` (`:260-262`) and `submitProductEdit`
(`:238-241`), which both use a guarded `updateMany`. The edit's status/version are checked only in the
pre-transaction reads at `:320-323`. The *product* version guard at `:370` protects against two
concurrent approvals of the same product (that part of the double-approve claim holds), but supersede,
request_changes, resubmit and metadata patches all bump only the **edit** version, so none of them
fence an approval that already passed its pre-checks.

Reproduced deterministically by firing `recoverProductEdit(action:'supersede')` from inside the
`reserveMediaCapacity` call that `approveEdit` makes after its pre-checks:

```
F4 final edit status: approved   notes: superseded:stale_base_version
```

The edit is now simultaneously `approved` and carrying the machine-safe superseded reason, the admin's
supersede is lost, its staged-media cleanup rows were enqueued for bytes that were then published, and
the audit log contains both a `product_edit.supersede` and a `product_edit.resolve` for the same row.
The same window lets an approval apply a **stale** `edit.proposed` snapshot after the creator has
resubmitted newer content.

**Recommendation:** make the terminal write `updateMany({ where: { id, status: 'pending', version: edit.version }, … })`
and treat `count === 0` as `version_conflict`, mirroring `requestChangesOnEdit`. Add a test that
interleaves supersede with approve.

### I4 — New-product approval never sets the compatibility cover `imageUrl`

Phase 4 requirement line 28 and Task 1 both mandate *"set cover `imageUrl`"*; plan constraint line 54
keeps `imageUrl` as the temporary cover projection for clients that do not yet read `photos[]`.
`grep -n imageUrl api/src/services/products/**` at `03a4ea7` shows **no** write anywhere in the product
services — `approve()` (`product-moderation.ts:105-200`) only sets `status`/`moderationNotes`/
`moderatedBy`/`moderatedAt`/`version`, and `approveEdit` likewise never recalculates it on a
relation-backed photo-set change.

Reproduced:

```
F5 imageUrl: null   photo public key: public/products/3c213bcc-…/b25e3689-…
```

Every product approved through the new pipeline ships `imageUrl: null` to legacy clients despite
having published cover bytes.

**Recommendation:** set `imageUrl` to the position-0 photo's public display URL inside the approval
transaction, and recalculate it in `approveEdit` only when the relation-backed set actually changed
(the "metadata-only edit preserves legacy `imageUrl`" behaviour is already correct and tested at
`product-edits.test.ts:240`).

### I5 — `PATCH /v1/admin/products/:id` still accepts arbitrary `status`, letting an admin activate a `pending` product without publishing its photos

`api/src/routes/admin/products/patch.ts:33` passes `input.status` straight through, and
`adminProductStatusSchema = productStatusSchema` (`packages/shared/src/schemas/admin/products.ts:7`)
includes `active`, `merged_into`, `report_hidden`. Setting `pending → active` bypasses
`moderateProduct` entirely: no capacity reservation, no prepared intent, no public copy. The photos
stay `moderationStatus: 'pending'` with only `privateStorageKey`, so `toApiProduct` on a now-publicly
visible product emits authenticated `/v1/products/:id/photos/:pid/display` private-route URLs
(`serializer.ts:50-55`) and the moderation audit action recorded is `product.update`, not
`product.moderate`. `status: 'merged_into'` is similarly settable without `mergedIntoProductId`,
producing a row `resolveCanonicalProduct` can never resolve.

The phase brief for Task 3 says the correction path must "route through moderation/photo services with
the same transaction/audit invariant" — the version guard and in-tx audit were added, but the state
machine was not.

**Recommendation:** drop `status` from `adminProductPatchSchema`, or restrict it to catalog-moderation
transitions (`active ↔ report_hidden`) and force lifecycle transitions through
`moderateProduct`/`mergeProducts`.

### I6 — The merge contract rename shipped without updating its only existing consumer; `apps/admin` merge is now broken at runtime while CI stays green

`api/src/routes/admin/products/merge.ts` now requires `{ targetId, sourceIds, version }`.
`apps/admin/src/lib/admin-api.ts:78-82` still sends `{ winnerId, loserIds }` and no `version`:

```ts
merge: (winnerId: string, loserIds: string[]) =>
  apiServerFetch(`/v1/admin/products/${winnerId}/merge`, { method: 'POST', body: { winnerId, loserIds } })
```

with `apps/admin/src/lib/actions.ts:32` and
`apps/admin/src/app/(admin)/products/[id]/merge/merge-tool.tsx:24` on the same shape. The body is an
untyped `object` at the fetch boundary, so this typechecks and every admin merge attempt now 400s.

Phase 6 owns the admin console, but this commit removed a working `main` behaviour without a
compensating change or a note. Related: `apps/mobile/local-packages/@expyrico/shared/dist` still
carries the old `winnerId`/`loserIds` types and has zero `productEditRowSchema` — plan constraint
line 65 requires both vendored copies be refreshed with any shared contract change.

**Recommendation:** either update `apps/admin`'s merge client in a follow-up owned by dev-2 before
Phase 6 lands, or record the break explicitly in the Phase 6 task. Rebuild `packages/shared` and
refresh both vendored copies.

### I7 — The Task-1 fault test does not exercise the fault it is named for

`api/tests/integration/admin-product-moderation.test.ts:165` — *"leaves no orphaned public bytes and no
reference when the reference transaction fails"* — its own comment concedes it does not reproduce the
scenario, and it passes `version: 999`, which fails the guard at
`product-moderation.ts:222` (`if (product.version !== input.version) versionConflict`) **before** any
reservation, intent, or byte copy happens. It then asserts only that the photo row is unchanged. It
never inspects the public media root, never creates a prepared intent, and would still pass if the
entire compensation path were deleted.

Phase 4's risk table makes this an explicit release gate ("block release on fault test"), and Task 1
requires "process death after each public copy but before DB/audit transaction leaves a recoverable
prepared intent". Neither is covered — which is exactly why C1 (a wholesale mismatch between prepared
and written keys) went undetected.

**Recommendation:** inject the failure after `publishProductPhoto` returns (throw from a spied
`writeAuditLog`/`completeMediaOperation`), then assert (a) product/photo rows unchanged, (b) no file
remains under `public/`, (c) the prepared intent row is still `prepared` with the keys that were
actually written. Same shape for `approveEdit`.

---

## MODERATE

### M1 — `recoverProductEdit` does not require the edit to be stale, and `rebase` promotes a never-submitted `draft` straight to `pending`

`product-edits.ts:611-622` unconditionally writes `status: 'pending'`, `submittedAt: new Date()`, and
`:522` accepts `draft` as a recoverable state. An admin can therefore push a creator's private,
unsubmitted draft into the moderation queue — a submission the creator never made, bypassing
`submitProductEdit` and (once Phase 7 lands) the reCAPTCHA `submit_product` gate required by plan
constraint line 61. There is also no check that `product.version !== edit.baseProductVersion`, so
"recovery" applies to healthy edits too.

**Recommendation:** require staleness explicitly and restrict `rebase` to `pending` /
`changes_required`; `supersede` may legitimately apply to `draft`.

### M2 — `rebase` clears unread creator feedback

`product-edits.ts:616`: `moderationNotes: input.notes ?? null`. `notes` is optional on the rebase
branch, so a rebase with no notes nulls out a previous `request_changes` reason the creator may not
have read. `productEditRowSchema.moderationFeedback` is the only creator-visible channel for it.

### M3 — `supersede` reads the staged-photo set outside its transaction, so a concurrent upload leaks

`product-edits.ts:516` loads `edit.photos`, and `:539-541` enqueues cleanup from that snapshot inside
the transaction. Photo staging is permitted while the edit is `draft` (`checkEditPhotoMutablePolicy`,
`product-photos.ts:474-478`) and `supersede` accepts `draft` (`:522`), so an upload landing between the
read and the commit is never enqueued for cleanup — its private bytes are orphaned with no durable
record.

**Recommendation:** re-read the photo rows inside the transaction (the row is already lockable via the
`FOR UPDATE` helper used by `assertEditPhotoMutable`).

### M4 — `currentVersionOf` issues a query on the pooled client from inside an open transaction

`product-moderation.ts:52` uses `getPrisma()` and is called at `:82`, `:129`, `:160` — i.e. inside
`prisma.$transaction` callbacks. That takes a *second* pool connection while the first is held open;
under pool saturation the conflict path self-deadlocks rather than returning a 409. It also reads the
pre-commit value by design, which is fine, but should come from `tx`.

**Recommendation:** pass `tx` through (`tx.product.findUnique(...)`) — the transaction is aborting
anyway, so the read is consistent.

### M5 — Merge tests omit two scenarios Task 4 requires

Task 4 asks for "rollback after source-clear" and "concurrent lookup under transaction isolation"
tests. `admin-product-merge.test.ts` has neither; the identifier-transfer coverage stops at the happy
path, the conflict abort, and independent barcode/QR transfer. The sorted-lock ordering
(`merge.ts:121-126`) is correct and the opposite-direction race test at `:133` does exercise it, but
nothing asserts that a failure *after* `barcode: null` on the source restores it.

### M6 — `api/src/routes/admin/products/pending.ts` was left unmodified despite being listed under "Modify", and the queue exposes no media

The Phase 4 Related-Code-Files list and Task 1 ("queue projection with ordered private media and
history in bounded queries") both target `pending.ts`; it is untouched by this commit and still returns
`ProductEdit` rows with a raw `proposed` JSON blob and no `photos`. There is no single-edit GET either,
so an admin cannot see a revision's proposed media before deciding. dev-2 is currently adding
`pending-get.ts` untracked, which suggests the gap is known — it should be an explicit carried task
rather than an implicit Phase 6 fix.

### M7 — `resolveProductEdit` / `recoverProductEdit` take an `actor` with a role but never check it

`product-edits.ts:493-501` and `:514` accept `approve`/`request_changes`/`rebase`/`supersede` from any
actor; only route placement (`adminOnlyPlugin` at `routes/admin/index.ts:41`) enforces admin. The
creator-facing `edit-submit.ts` route hardcodes `action: 'submit'`, so no current path is exploitable
— but the services are exported and the role field is already present. A one-line
`if (actor.role !== 'admin') forbidden()` on the admin branches would make the invariant local rather
than positional.

### M8 — Merge repoints only four relations; nothing asserts the list is exhaustive

`merge.ts:145-159` handles `Record`, `Review`, `Deal`, `Giveaway`. `Report` (`schema.prisma:515`,
`productId` nullable, `onDelete: SetNull`) and `schema.prisma:738`'s nullable `productId` relation are
not repointed. Because source rows are never deleted this is not a data-integrity break, but reports
filed against a merged-away product stay attached to a `merged_into` row and drop out of catalog
moderation views. Worth a documented decision either way.

---

## Non-blocking notes

- **N1 — full-suite failure is pre-existing, not this commit.**
  `src/services/products/product-media-coordinator.test.ts:71` ("heartbeats the lease…") fails both in
  the full run and in isolation on a clean DB. The file is untouched by `03a4ea7` (last changed in
  `04ee395`, Phase 3). Cause is test isolation, not the lease: the test takes
  `listActiveMediaLeaseKeys()[0]` — a **global** Redis set shared across concurrently running agents —
  so `redis.expire(key, 1)` frequently targets another run's lease, which this run's heartbeat never
  renews. Should key off the lease token returned by `withMediaMutationLease` instead. Phase 3 owner.
- **N2 — typecheck.** The only `pnpm typecheck` error comes from dev-2's untracked
  `pending-get.ts`. `03a4ea7` itself is clean.
- **N3 — task #13 resubmission guard re-verified, not regressed.** Supersede an edit, then resubmit
  with the creator's stale version → `409 version_conflict`, edit stays `rejected`.
  `submitProductEdit`'s `status in [draft, changes_required]` + version predicate holds.
- **N4 — audit atomicity (check e) verified.** `writeAuditLog(data, tx)` is used in every Phase 4
  moderation/recovery/merge/correction path; `audit-log.test.ts:62/78` prove both directions
  (commit-together and roll-back-together) with a real forced rollback. `auditPlugin` remains
  opt-in (`plugins/audit.ts:15`), so no double-write.
- **N5 — merge lock ordering (check d) verified.** `[...new Set([resolvedTargetId, ...sourceIds])].sort()`
  + `SELECT … FOR UPDATE` per id (`merge.ts:121-126`) is a real row lock, not a Prisma-transaction-as-lock.
  Canonical-chain resolution is depth-bounded and a cycle terminates in a `merged_into` row that the
  `status !== 'active'` check then rejects (`merge.ts:108-113`).
- **N6 — edit-scoped authorization (check a) verified.** `/v1/product-edits/*` all resolve ownership via
  `loadOwnOpenEdit` / `checkEditPhotoMutablePolicy`, which `notFound()` (404, non-enumerating) on a
  foreign `editId` rather than 403. `assertEditPhotoMutable` uses a real `FOR UPDATE` row lock.
  `createOrResumeProductEdit` gates on `getVisibleProduct` + `status === 'active'`, so reviewer-p2's I4
  hole is not reopened. Note the documented policy (`product-edits.test.ts:140`) that *any*
  authenticated user may open a revision on any active product — same as the legacy PATCH route.
- **N7 — approved deviations (check g) confirmed present and documented.** Richer service return shapes;
  `pending-resolve.ts:23-34` supplying the edit version internally (its version-conflict path *is*
  reachable at service level via `requestChangesOnEdit`'s guarded `updateMany` — but see I3 for the
  approve branch, which is the deviation's blind spot); M4 photo-version deviation. Not re-flagged.
- **N8 — no implementer report exists** for Phase 4 in
  `plans/260724-1612-mobile-scan-product-creation/reports/`. Every other phase has one; claims in the
  task brief could only be checked against code and tests.

---

## Phase 4 success criteria

| Criterion | Verdict |
|---|---|
| Product/revision state, mandatory audit, and durable media-outbox work commit or roll back together | **Partial** — audit/state atomicity holds (N4); outbox intent keys are wrong for revisions (C1); edit row is unguarded (I3) |
| Failed publication/DB transition leaves no referenced or leaked public object | **Fail** — C1; and I7 means it was never actually tested |
| Revision desired order represents retained + staged; live product unchanged preapproval; compatibility `imageUrl` survives metadata-only edits | **Pass** (tested at `product-edits.test.ts:254`/`:240`) — but I4: `imageUrl` is never *set* in the first place |
| Stale edits have tested rebase/supersede recovery and cannot overwrite later admin correction or lose retained-photo integrity | **Partial** — recovery tested; I3 breaks the "cannot overwrite" guarantee; I1 breaks retained-photo deletion |
| Merge covers records, reviews, deals, giveaways, edit-history/open-edit guards, photos, chains, atomic identifier transfer, opposite-direction races | **Partial** — I2 (multi-source reviews), M5 (missing rollback/isolation tests), M8 (relation list) |
| Focused suites and API typecheck pass | **Pass** (52/52; typecheck clean for this commit — N2) |

## Counts

**1 CRITICAL, 7 IMPORTANT, 8 MODERATE**, 8 non-blocking notes.

## Unresolved questions

1. Are `ProductEditPhoto` rows on terminal (`approved`/`rejected`) edits meant to be retained forever?
   The `onDelete: Restrict` FK plus no cleanup makes live-photo deletion a one-shot operation (I1) —
   this needs a product decision, not just an error-handling patch.
2. Should `public/` keys for revision-published photos live under the product namespace (my assumption
   in C1) or is an edit-scoped namespace intended? If the latter, the intent/compensation call sites
   must change instead, and Phase 7's sweeper needs to know about both shapes.
3. Who owns the `apps/admin` merge-client fix (I6) — dev-2 under Phase 6, or a Phase 4 remediation task?
4. Is `Report` intentionally excluded from merge repointing (M8)?
