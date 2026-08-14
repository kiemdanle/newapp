# Phase 2 Review — Lookup and Private Draft Lifecycle (commit `4e29c39`)

Reviewer: reviewer-p2. Branch `feature/mobile-scan-product-creation`. Review-only; **no source files modified** (two throwaway scratch test files were created to produce the evidence below and deleted immediately after the runs; `git status` verified clean afterwards).

Concurrent work excluded from attribution: dev-1 landed `ced0e72` ("close creator dead-end and remaining phase-1 findings") during this review. All findings below were read against `4e29c39` and re-confirmed against `ced0e72` where the file overlaps (`routes/products/patch.ts`).

## Verification actually run (not taken from the report)

| Check | Command / method | Result |
|---|---|---|
| Isolated DB provisioning | `psql -c 'CREATE DATABASE pantry_p2rev_…'` + `CREATE EXTENSION pg_trgm` + `psql -f` over all 23 `api/prisma/migrations/*/migration.sql` in sort order; `TEST_DATABASE_URL` override | applied clean; `product_edits.is_legacy` default = `false` (dev-1's new migration present). **No `prisma migrate deploy/dev/reset` run anywhere; shared `pantry` never connected to; `pantry_test` never written; scratch DB `DROP`ped** |
| Deferred migration stayed out of state | `ls api/prisma/deferred-migrations/` | only `20260730040000_classify_report_hidden_products`, never applied |
| Full API suite, isolated DB | `npx vitest run` | **88 files, 561/561 pass** (105s), single run, zero failures. dev-2's "558/558" claim confirmed (561 now = + dev-1's 3 new patch tests) |
| Phase-2 focused suites, isolated DB | 7 files named in the phase file | 114/117 pass; the 3 failures are all in `products-draft-lifecycle.test.ts` and are the **known pre-existing env-load ordering quirk** (`expected 401 to be 201/503`, task #11) reproduced only because a `vi.doMock` file ran first; they pass in the full-suite run. Not a Phase-2 defect |
| Cross-actor idempotency isolation | `idempotency.test.ts` 11/11 | real: key is `idem:{actorId}:{method}:{path}:{clientKey}`, Lua reserve-or-read is atomic |
| Submit truly hard-disabled | `git grep "status: 'pending'" -- api/src` at `4e29c39` | **no code path writes `products.status='pending'`**. Only `reports/repository.ts` (→`report_hidden`) and `admin/merge.ts` (→`merged_into`) write product status. Confirmed clean |
| Legacy create retired | `products-create.test.ts` (5 cases incl. all 3 modes + admin) | 410 `upgrade_required`, zero inserts. Confirmed |
| Legacy compatibility-reader gap (inherited Phase 1 MODERATE) | `products-lookup.test.ts:86` (5-status matrix) + `lookup.test.ts:46` + `products-visibility.test.ts` | **CLOSED with real tests**: `draft|pending|changes_required|report_hidden|merged_into` all give the legacy 404 envelope with no external call and no serialization; `GET /:id` and search are gated |
| Secrets/paths in the diff | `git show 4e29c39 \| grep -E "PRIVATE KEY\|password=\|/home/"` | no hits; `api/.env.test` not in the commit |
| Empirical defect reproduction | 2 scratch test files, isolated DB (deleted) | 6 findings reproduced; raw output quoted inline below |

---

## CRITICAL

**[CRITICAL] Switching report auto-hide to `report_hidden` while `assertProductUse` rejects `report_hidden` freezes — and silently discards edits to — every existing pantry record that references the product. Any 4 unprivileged users can trigger it.** — `api/src/services/reports/repository.ts:58` now writes `report_hidden` on an *active* catalog product once it has more than `AUTO_HIDE_REPORT_THRESHOLD = 3` non-dismissed reports (`repository.ts:11,44`); `api/src/services/products/product-visibility.ts:99-100` then falls through every branch and calls `notFound()` for `report_hidden` **regardless of `existingRecordReference`**; and that gate is now invoked on *every* record write, unconditionally, whenever the record has a `productId` — `routes/records/patch.ts:77-84` (inside the new transaction, on every PATCH, even one that only sets `status: 'consumed'`), `routes/records/duplicate.ts:34-39`, and `services/records/sync.ts:150-157`. Before this commit auto-hide wrote `pending` and no record writer checked product state, so there was no interaction; both halves are new in `4e29c39`, so this is a **new regression on core pantry flows**, not an inherited one.

Reproduced on my isolated DB (active product → `report_hidden` → user's own pre-existing record):

```
RECORD PATCH AFTER AUTOHIDE   = 404 {"title":"Product not found","status":404,"code":"not_found"}   (record NOT updated)
DUPLICATE AFTER AUTOHIDE      = 404
SYNC AFTER AUTOHIDE           = 200, quantity=1 (client sent 9), notes=null (client sent 'edited offline')
```

Impact, in order of severity: (1) **silent data loss** — the offline batch returns `200` and drops the item (`sync.ts:196-198` swallows any 403/404 `AppError`), so the user's offline edits are discarded with no conflict, no error, and no client-visible signal, on every retry, forever; (2) the user cannot mark the item consumed, change quantity/expiry, or duplicate it through REST either; (3) the error is `404 Product not found` on a *record* endpoint, which is actively misleading for support. The trigger requires no privilege: four ordinary accounts reporting one popular catalog product hides it, and every user who has that product in their pantry is affected. Nothing in the phase file asks for existing references to be revoked — the policy it specifies is about *attaching* and about `changes_required` ("an existing own personal reference may remain"); `report_hidden`-on-an-already-attached-record is simply unhandled, and no test covers it (`product-use-authorization.test.ts:109` only covers a *new* attachment).

**Recommendation:** treat a preserved reference as always permitted for catalog-moderation states. In `assertProductUse`, before the creator check, add: if `context.existingRecordReference === true` and the purpose is not a new community use (`review|deal|giveaway`), allow `report_hidden` (and decide `merged_into` deliberately — see IMPORTANT-3). Equivalently, skip the gate entirely in `records/patch.ts` when the patch does not change scope or product reference. Add tests for: PATCH/duplicate/sync of an existing record after the product is auto-hidden, and PATCH of an existing record whose product is `merged_into`. Also reconsider the silent-drop in `sync.ts`: a dropped upsert that the client believes it synced should surface through the existing `recordSyncConflictSchema` channel (`packages/shared/src/schemas/record.ts:85-88`) rather than vanishing.

---

## IMPORTANT

**[IMPORTANT] Under an external-hit race, both lookups hand another user's private draft to the caller — v2 as `outcome:'found'` with full metadata, legacy as a serialized product (defeating the active-only guarantee).** — `services/products/lookup.ts:146-150` and `:155-159` do `const product = await persistExternal(...); return { outcome: 'found', product: toApiProduct(product) }`, and `persistExternal:44` deliberately **returns the existing row unmodified** when `existing.source === 'user' || existing.status !== 'active'` (`lookup.ts:45`), while the P2002 recovery path at `:70-74` likewise returns whatever raced row it finds. Neither caller re-checks `status` afterwards. The race window is not a few microseconds: it spans the entire OFF and UPC HTTP round trip (1500 ms / 2000 ms timeouts) between `findLocalExact` and `persistExternal`. The same defect breaks the legacy contract: `lookupProduct:99-105` returns that row with `privateReservation: false`, so `routes/products/lookup.ts` serializes a `draft` row into the legacy envelope — the exact thing Task 2 forbids. The existing unit test at `lookup.test.ts:223` asserts `persistExternal` *returns* the draft (`expect(result.status).toBe('draft')`) but nothing asserts what the caller does with it.

Reproduced deterministically (draft created by another user during the mocked provider call):

```
V2 RACE OUTCOME = {"outcome":"found","product":{"id":"de7be48d…","barcode":"7770000000001",
  "name":"Secret Homemade Sauce","description":"private draft description",…,"status":"draft",…}}
LEGACY RACE     = status=draft  name='Another Private Draft'  privateReservation=false
```

Realistic trigger: OFF is crowd-sourced, so a product that missed when user A created a private draft can be present when user B scans minutes later — B's request then finds no local row (A's draft is created in the window) and gets a `found` carrying A's draft name/description/photo IDs. **Recommendation:** make `persistExternal` return a discriminated result (`{kind:'persisted', product} | {kind:'conflict', product}`) or have both callers re-classify: `if (product.status !== 'active') return classifyLocal(product, actor)` in v2 and `return { product: null, privateReservation: true }` in legacy. Add the race test in the caller, not only in `persistExternal`. Defense in depth: tighten `productLookupV2FoundOutcomeSchema` so `product.status` must be `active` (see MODERATE-7) — the route's `.parse()` would then have caught this.

**[IMPORTANT] `merged_into` is classified as `under_review`, so a merged barcode becomes a permanent dead end for every user — no canonical resolution anywhere, and the phase's "merged canonical" case is neither implemented nor tested.** — `lookup.ts:138-139` falls through to `{ outcome: 'under_review' }` for `merged_into`, and `product-visibility.ts:99-100` / `:34` reject it in both `assertProductUse` and `getVisibleProduct`. `services/admin/merge.ts:66` sets the loser to `merged_into` while keeping its barcode and populates `mergedIntoProductId`, which nothing reads (`git grep mergedIntoProductId -- api/src` → schema/serializer only). Reproduced:

```
MERGED OUTCOME = {"outcome":"under_review"}   (lookupOff never called)
```

So after an admin merge, scanning the loser's barcode yields `under_review` in v2 (mobile: "under review", no creation, no product) and a plain 404 in legacy — previously it returned the loser row. `POST /v1/products/drafts` also 409s "under review" (`product-drafts.ts:52-57`), so the user can neither find the product nor create one: the identifier is unusable forever. Phase file Task 2 lists "merged canonical" as a required v2 orchestration case (line 102) and Requirement line 34 expects "visible canonical conflict"; the phase file's own success criteria are therefore not met, and there is **no `merged_into` case in `lookup.test.ts` or `products-lookup.test.ts` for v2 at all** (only in the legacy 404 matrix). **Recommendation:** in `classifyLocal`, when `status === 'merged_into' && mergedIntoProductId`, load the canonical row and return `found` with it if active (else `under_review`); mirror it in `assertProductUse`/`getVisibleProduct` (either follow the pointer or keep rejecting, but decide and test it). Add the v2 merged-canonical case both places.

**[IMPORTANT] `PATCH /v1/products/:id` is an unguarded product FK writer: any authenticated user can open a `ProductEdit` against another user's `draft`/`pending`/`report_hidden` product.** — `routes/products/patch.ts:23-30` (unchanged by this commit, and still unchanged in dev-1's `ced0e72`) does a bare `prisma.product.findUnique({ where: { id } })` with no ownership and no status check, then creates a `ProductEdit` row. `ProductEdit.productId` is a product foreign key, and the phase Overview's mandate is "close **every** known product foreign-key writer" (phase file line 22) with success criterion "Every known product FK writer enforces active/submitted-creator-personal policy" — this is the one remaining unclosed writer, and it sits directly beside `getProductRoute`, which *was* converted to `getVisibleProduct`. Reproduced:

```
PATCH PRODUCT ON FOREIGN DRAFT = 202 {"editId":"836d800d…","status":"pending","productId":"4ea46b3d…"}
```

Two consequences: (a) it is an existence/`404`-vs-`202` oracle for any product ID including private drafts, inconsistent with the non-enumerating `GET /v1/products/:id` on the same resource; (b) the edit lands in the admin queue (`routes/admin/products/pending.ts:11`) and Phase 4's approval path applies `edit.proposed` straight onto the product (`pending-resolve.ts:19`), so an unrelated user's proposed name/imageUrl can be written into someone's private draft. **Recommendation:** call `getVisibleProduct` first and 404 when null, then require `product.status === 'active'` (creator revisions are for active products per the plan constraint) — or explicitly restrict to `createdByUserId === actor.id || actor.role === 'admin'`. Add a matrix test for foreign draft / own draft / report_hidden / merged_into.

**[IMPORTANT] Draft PATCH has no optimistic-version guard — concurrent edits silently lose data, and the phase's mandated conditional owner/state/version update is a read-then-write instead.** — `services/products/product-drafts.ts:120-145`: `patchDraft` reads the row, asserts state, then issues `prisma.product.update({ where: { id: productId }, data: { …, version: { increment: 1 } } })`. The `where` clause carries neither `createdByUserId`, nor a status filter, nor an expected `version`, and the read and the write are not in one transaction. The contract cannot express it either: `productDraftPatchRequestSchema` (`packages/shared/src/schemas/product.ts:251-259`) has **no `version` field**, unlike `productDraftSubmitRequestSchema:274` which does. Phase Task 4 requires "Patch metadata with conditional owner/state/version update and increment" and lists a "stale version" test; plan Global Constraint line 57 requires optimistic `version` on product mutations. Neither exists — `products-draft-lifecycle.test.ts` has no stale-version case. Reproduced:

```
CONCURRENT DRAFT PATCH = 200 200   final name = 'Writer A'   version = 3
```

Both writers get `200`, one edit is silently lost, and `version` becomes a counter rather than a conflict token — which also means the mobile draft editor (Phase 5) has no conflict signal to build on and Phase 3's photo routes will inherit the same non-conditional pattern. **Recommendation:** add `version: z.number().int().min(1)` to `productDraftPatchRequestSchema` (Phase 1 contract, needs the shared rebuild + both vendored mobile copies), and make the write a single `updateMany({ where: { id, createdByUserId: actorId, status: { in: ['draft','changes_required'] }, version: input.version }, data: … })`, returning `409 version_conflict` with `currentVersion` (`ERROR_CODES.VERSION_CONFLICT` and `problemSchema.currentVersion` already exist from Phase 1) when `count === 0`. Tests: stale version → 409, concurrent patch → exactly one 200 + one 409.

---

## MODERATE

**[MODERATE] Draft creation is not gated by the `product_creation` rollout mode, so the server-enforced rollout constraint is unenforced in Phase 2.** — plan Global Constraint line 62 requires the mode to gate "private new-product draft metadata/photo/submit mutations", not just `not_found.canCreate`. `product-drafts.ts:75` goes straight from a `not_found` outcome to `prisma.product.create`, and `routes/products/drafts.ts:10-18` has no gate; `canCreate:false` (`lookup.ts:167`) is advisory only, and any authenticated client can call `POST /v1/products/drafts` directly and create unlimited `draft` rows on unique barcodes with no per-user quota. Consequences are bounded today (submit is hard-disabled, so nothing reaches `pending` and rollout step 2's "do not create creator `pending` rows" holds), but this is unbounded unauthenticated-cost row growth on a live endpoint. **Recommendation:** ship the endpoint behind a temporary unconditional `feature_disabled` (as `submitDraft` does) or a minimal `product_creation.mode` read now, and record in Phase 7's file that `assertProductCreationEligible` must land in `createOrResumeDraft` and `patchDraft` before mobile consumes them.

**[MODERATE] The "check and write share a transaction/lock" claim is not a lock — no row is locked and the isolation level is READ COMMITTED.** — `routes/records/patch.ts:70-75` comments "so the product's state/reference can't change between them", and `services/records/sync.ts:149-157` does the same, but `assertProductUse` reads with a plain `findUnique` (`product-visibility.ts:81`) with no `FOR UPDATE` and no `isolationLevel: 'Serializable'`. A Prisma interactive transaction gives write atomicity, not mutual exclusion, so a concurrent product-status commit between the read and the record write is still possible. Phase Task 3 asks for "a transaction/lock so the product state/reference cannot change between the check and update" — currently only half of that. Practical exploitability is low (product states advance `draft → pending → active`, so the reachable races are not attacker-favourable), which is why this is MODERATE and not higher, but the code comment overstates what was achieved and the same pattern will be copied into Phase 3/4. The identical gap exists in `persistExternal` (`lookup.ts:41-53`): the guarded `findUnique` and the `update({ where: { id } })` are not atomic, so an external refresh can still overwrite `name/brand/category/imageUrl` on a row that concurrently became `report_hidden` or `source:'user'`. **Recommendation:** either use `SELECT … FOR UPDATE` on the product row (raw, as `lockHouseholdRow` already does in `sync.ts`) or make the guards conditional writes (`updateMany` with the status/source in the `where`), and soften the comments to what the code guarantees.

**[MODERATE] Five new error codes bypass the shared `ERROR_CODES` registry.** — `upgrade_required` (`routes/products/create.ts:15`), `feature_disabled` (`product-drafts.ts:167`), `temporarily_unavailable` (`product-drafts.ts:48`), `idempotency_key_reused` and `idempotency_in_progress` (`plugins/idempotency.ts:120,214`) are bare string literals; `ERROR_CODES` (`packages/shared/src/schemas/error.ts:89-95`) gained six product codes in Phase 1 but none of these, and `AppError.code` is typed `ErrorCode | string` (`api/src/errors.ts:5`), so a typo compiles and ships. The plan/phase call these "typed" codes (plan line 62, phase line 39) and Phase 5/6 clients must match on them. **Recommendation:** add all five to `ERROR_CODES` in the same shared change as the `version` field above, and reference the constants.

**[MODERATE] Hostile `cursor` on `GET /v1/products/drafts` produces a 500 instead of a validation error.** — `productDraftsQuerySchema` validates only that `cursor` is a non-empty string (`packages/shared/src/schemas/product.ts:207`); `decodeCursor` (`packages/shared/src/schemas/admin/common.ts:26-34`) catches base64/JSON errors but returns unvalidated contents — `new Date('not-a-date')` (Invalid Date) and a non-UUID `i` flow straight into the Prisma `where` at `product-drafts.ts:191-196`. Reproduced on three payloads:

```
{"t":"not-a-date","i":"not-a-uuid"}            => 500 {"code":"internal_error"}
{"t":"2026-01-01T…","i":{"$ne":null}}          => 500 {"code":"internal_error"}
{"t":null,"i":null}                            => 500 {"code":"internal_error"}
```

No stack or Prisma text leaks (the error handler sanitizes correctly — good), but any authenticated client can generate unlimited 500s and `api_errors` rows from a query parameter, which is exactly the class of alert noise that hides real incidents. **Recommendation:** validate inside `decodeCursor` (return `null` unless `t` parses to a valid date and `i` matches a UUID) or `z.string().uuid()` / `z.coerce.date()` the decoded parts in `listDrafts` and answer `400 validation_error`. Add hostile-cursor cases; the admin routes that already use this helper get the fix for free.

**[MODERATE] Idempotency reservations can be double-executed and the key is the raw URL, not the canonical route.** — `plugins/idempotency.ts:22-25`: `IN_FLIGHT_TTL_SECONDS = 30` with no heartbeat, while the replay wait bound is `WAIT_TIMEOUT_MS = 2_000`. A handler that takes longer than 30 s lets the reservation lapse; a retry then sees `vacated`, re-reserves (`:196-201`) and runs concurrently with the still-live original — the one thing the design set out to prevent. Second, the key uses `req.url.split('?')[0]` (`:167`) rather than `req.routeOptions.url`, so the "canonical route" in the phase's Produced Interfaces is really the raw request path, and the request hash covers only `req.body` (`:57-59`) — the query string is in neither. Nothing today has a >30 s handler or an idempotent route with meaningful query parameters, so this is a latent MODERATE. **Recommendation:** refresh the reservation TTL from the `onSend` path or extend `IN_FLIGHT_TTL_SECONDS` beyond the server's request timeout; use `req.routeOptions.url` plus the params, and fold the query string into the hash.

**[MODERATE] `found`/`editable_private`/`creator_pending` response schemas do not constrain `product.status`, so the route parse cannot catch a misclassification.** — `packages/shared/src/schemas/product.ts:161-175` embed the full `productSchema`, whose `status` is the whole enum. `routes/products/lookup-v2.ts:14` does `productLookupV2ResponseSchema.parse(response)` — a genuine defence-in-depth step that would have blocked IMPORTANT-2 had the outcome shapes pinned `status`. **Recommendation:** `productSchema.extend({ status: z.literal('active') })` for `found`, and the private states for `editable_private`/`creator_pending`. Cheap, and it converts a leak into a 500.

**[MODERATE] `sync.ts` swallows any 403/404 `AppError` raised anywhere inside the per-item transaction, not a specific authorization signal.** — `services/records/sync.ts:12-14`: `isProductUseRejection` matches on `err.status === 403 || err.status === 404` alone. Today the only `AppError` source inside those blocks is `assertProductUse`, so behaviour is correct; but any future 404/403 added inside that transaction (a household lookup, a Phase 3 media check) will be silently converted into "drop this item", which is the highest-cost failure mode in this file (see CRITICAL-1). **Recommendation:** throw a dedicated `ProductUseRejection` subclass (or tag `AppError` with a `productUseRejection` flag) from `assertProductUse` and match on that.

**[MODERATE] `POST /v1/reports` remains a product-existence oracle for private drafts.** — `routes/reports/create.ts:10` does `product.findUnique(...) !== null` with no status/visibility filter. Reproduced: reporting another user's `draft` returns `201`, an unknown UUID returns `404 report_target_not_found`. The route predates this commit, but private products did not exist before it, so this is the one remaining product surface where a stranger can confirm a non-active row exists (UUID guessing makes it low-yield, and `admin/reports/list.ts` exposure is admin-only). It also lets a stranger file reports against a private draft that no auto-hide path acts on. **Recommendation:** route the existence check through `getVisibleProduct` so private rows answer `report_target_not_found`.

**[MODERATE] Minor classification/serialization edges.** — (a) `classifyLocal:127-131` gives admins `creator_pending` for `merged_into` and `report_hidden` alike, so admin tooling cannot distinguish moderation states from the outcome alone (phase line 31 asks for a result "appropriate to moderation tooling"). (b) `classifyLocal` and `patchDraft` call `toApiProduct` on a `findUnique` result with no `photos` include, so `editable_private`/`creator_pending`/draft-PATCH responses always report `photos: []` even once Phase 3 creates rows — the draft editor will see an empty gallery after a resume. Worth including `photos` now, or recording it as a Phase 3 entry task. (c) `productLookupRequestSchema` is not `.strict()`, so unknown keys are silently accepted on both lookup routes.

---

## Acceptance-criteria walk-through (phase file "Success Criteria")

| Criterion | Verdict |
|---|---|
| Installed clients retain legacy lookup semantics | **Met for active/miss/error**, with two exceptions: a raced external hit can still serialize a private row (IMPORTANT-2), and `merged_into` barcodes changed from "returns the merged row" to 404 (IMPORTANT-3, arguably intended by "active-only" but not decided or tested as a canonical case) |
| V2 distinguishes visible / creator-private / metadata-free under-review / miss / unavailable | **Met.** `under_review` is `.strict()` and empty; ordinary-user, creator, and admin branches are all tested at unit and integration level; the OFF/UPC `found`-always-wins fall-through the lead imposed is implemented (`lookup.ts:141-165`) and tested (`lookup.test.ts:173,181`) |
| Full miss never queues backfill; draft create reconfirms eligibility | **Met.** `routes/products/lookup.ts:24` skips backfill on a private short-circuit and v2 has no backfill path at all; `createOrResumeDraft:71` re-runs `lookupProductV2` server-side, and the unavailable case is proven to create nothing |
| Idempotency cannot replay across actors/bodies or double-execute | **Substantially met** (actor-bound key, atomic Lua reserve, hash mismatch → 409, 5xx released, 11 passing tests) with the TTL/canonical-route caveats in MODERATE-6 |
| Every known product FK writer enforces policy, incl. PATCH and sync | **Not met.** `PATCH /v1/products/:id` → `ProductEdit` is unguarded (IMPORTANT-4); and the policy that *is* enforced over-rejects preserved references (CRITICAL-1) |
| Legacy create cannot bypass moderation | **Met.** 410 `upgrade_required` in all three modes, admins included, zero inserts — re-run by me |
| Draft mutation/submission enforce ownership, state, version, idempotency | **Partially met.** Ownership/state/idempotency yes; **version is not enforced at all** and is absent from the contract (IMPORTANT-5). Submit is genuinely hard-disabled — verified no code path writes `products.status='pending'` |

## Security boundary verdict

- **Non-enumeration:** `under_review` is metadata-free and identical for report-hidden and another user's reservation; `getVisibleProduct`/`assertProductUse` return 404 (not 403) to non-creators; drafts list is `createdByUserId`-scoped; search is `status='active'`. **Clean except** the raced `found` leak (IMPORTANT-2), the `PATCH /:id` oracle (IMPORTANT-4) and the reports oracle (MODERATE-9). No timing side channel found: private short-circuits skip the external call, which makes them *faster*, not slower, and a fast path is indistinguishable from a local active hit.
- **Attach-authorization matrix vs the plan constraint:** `draft` never attachable (403 to creator, 404 to others) ✓; own `pending` → new personal record only ✓; own `changes_required` → existing personal reference only, and correctly rejected for personal→household, household→household, and new attachment, while household→personal is allowed ✓; household/review/deal/giveaway require active ✓; non-creator on any non-active row → 404 ✓. The matrix is right for *new* attachments and wrong only for preserved references to catalog-moderation states (CRITICAL-1).
- **Idempotency cross-actor replay:** impossible — actor ID is in the Redis key and there is a passing test.
- **`canonicalProduct` in problems:** only attached on `found`/`creator_pending` outcomes the caller was already authorized for (`product-drafts.ts:35-49`), and the `under_review` conflict carries none — verified in `products-draft-lifecycle.test.ts:135`.
- **No secrets, dotenv, media, or absolute paths in the commit.**

## Pre-existing, out-of-diff, but escalating

**[CRITICAL — not introduced by this commit] The tracked `api/.env.test` points `DATABASE_URL` at the shared `pantry` database, and `tests/helpers/setup.ts` truncates 30 tables before every test.** The committed value is `…@localhost:5432/pantry?schema=public` (only a local, unstaged edit repoints it to `pantry_test`; dev-2's report notes the same and correctly declined to commit it). A clean checkout running `pnpm --dir api test` therefore wipes the live `pantry` database. The file also commits a real DB password, against plan Global Constraint line 66 ("No `.env`, credentials … enter git/logs"). Both reviewers and both implementers have now worked around this by hand. **Recommendation (owner: whoever owns test infra, before any further phase):** commit the `pantry_test` repoint, move the credential out of the tracked file (`.env.test.example` + untracked `.env.test`), and make `setup.ts` refuse to run against a database whose name is not suffixed `_test`.

## Recommended actions, in order

1. Fix CRITICAL-1 (preserved references survive `report_hidden`; stop silently dropping sync items) — live user-facing data loss, reachable by unprivileged users, ships with this commit.
2. Fix IMPORTANT-2 (re-classify `persistExternal` results in both callers) and pin `status` in the outcome schemas.
3. Decide and implement `merged_into` canonical resolution (IMPORTANT-3).
4. Gate `PATCH /v1/products/:id` through `getVisibleProduct` + active-only (IMPORTANT-4).
5. Add `version` to the draft patch contract and make the write conditional (IMPORTANT-5) — do it with the same shared-package rebuild as the `ERROR_CODES` additions, before Phase 3 copies the non-conditional pattern into photo routes.
6. MODERATEs 1–9 as a follow-up batch; 1 (rollout gate) and 4 (cursor 500) are the two worth doing before Phase 5/7 consume these endpoints.
7. Escalate the `.env.test` landmine to whoever owns test infra.

## Unresolved questions

1. Should a `report_hidden` product's existing pantry references remain fully editable (my recommendation), become read-only-but-syncable, or be deliberately frozen? This is a product decision that changes the fix in CRITICAL-1; the plan does not address already-attached references.
2. Should `merged_into` resolve to the canonical winner on lookup (restoring scannability) or stay non-disclosing? Requirement line 34 says "visible canonical conflict", which reads like resolve — confirm before Phase 4 builds merge tooling on top.
3. Does `PATCH /v1/products/:id` belong to Phase 2 (it is a product FK writer the Overview claims to close) or to Phase 4 (which owns active-product revisions)? It is a live endpoint with no visibility gate either way.

---

# Re-verification — commits `41ee56c` + `e9f9814`

Re-reviewed against the **commits** (branch tip `04ee395`; dev-3's Phase 3 and the in-flight Phase 4 work in the working tree are excluded from attribution). Review-only; two scratch test files were created to produce the evidence below and deleted afterwards (`git status` on `api/`/`packages/`/`apps/` verified clean of my changes).

## How the signal was obtained

Own throwaway database (`CREATE DATABASE pantry_p2rev2_…`, `CREATE EXTENSION pg_trgm`, `psql -f` over all 23 `api/prisma/migrations/*/migration.sql` in sort order, `TEST_DATABASE_URL` override, `DROP DATABASE` after). No `prisma migrate deploy/dev/reset` anywhere; `pantry`/`pantry_test` never written; `api/prisma/deferred-migrations/` confirmed still holding only the unapplied migration B.

| Check | Result |
|---|---|
| Full API suite, isolated DB (`--exclude '**/zz-scratch-*'` to skip another reviewer's in-flight files) | **100 files, 711/711 pass** (127 s), single run, zero failures |
| Phase-2 focused suites (8 files incl. `products-patch`) | **158/158 pass** |
| My own re-verification scratch (22 cases across all 5 findings + MODERATE spot-checks) | 22/22, raw output quoted below |

## Finding-by-finding

**[CRITICAL] report_hidden froze existing pantry records / sync silently discarded edits — CLOSED.** `product-visibility.ts:143-147` now returns early for `report_hidden` when `existingRecordReference === true` and the purpose is `personal_record|household_record`, and `sync.ts` pushes `{ clientId, reason: 'product_unavailable' }` onto `conflicts` instead of swallowing. Verified end-to-end through HTTP on an auto-hidden product:

```
PATCH personal after autohide  = 200   record.status = consumed
PATCH household after autohide = 200
duplicate after autohide       = 201
sync existing-ref after autohide = 200  notes = 'edited offline'  conflicts = []   ← edit APPLIED, no data loss
sync NEW report_hidden attachment  conflicts = [{clientId, reason:"product_unavailable"}]   ← surfaced, not silent
review on report_hidden        = 404   ← community use still blocked
```

The "retry must not lose data" requirement is met the strong way: the existing-reference edit is *applied*, so there is no retry loop at all. `existingRecordReference` cannot be forged — it is server-derived at every call site (`duplicate.ts` reads `findFirst({ id, userId })`, so only own records; `sync.ts:75` skips rows whose `userId` differs before computing it; `records/patch.ts` derives it from the scope transition). The class-based `ProductUseRejectionError` match also closes MODERATE-7 properly: an unrelated 404 raised inside that transaction can no longer be mistaken for a product-use drop.

**[IMPORTANT] Private-draft leak under the external-hit race — CLOSED.** `lookup.ts` routes every `persistExternal` result back through `classifyLocal` (v2) and `legacyResultFor` (legacy) instead of assuming "just persisted ⇒ public"; `persistExternal` additionally takes `SELECT … FOR UPDATE` on the barcode row before its guarded read, so the guard and the refresh are now genuinely atomic. dev-2's two new unit tests reproduce my exact scenario (the mocked OFF client inserts the racing draft mid-call) and assert `under_review` / `product: null, privateReservation: true`; both pass in my isolated run. The defense-in-depth ask landed too: `productLookupV2ResponseSchema` pins `status` per outcome (`found`→`active`, `editable_private`→`draft|changes_required`, `creator_pending`→`draft|pending|changes_required|report_hidden`), so a future service-level regression 500s at the schema boundary instead of shipping private metadata.

**[IMPORTANT] `merged_into` dead end — CLOSED, and the cycle/depth-cap behaviour is sound.** `resolveCanonicalProduct` (`product-visibility.ts:30-40`) is an iterative loop (not recursion) capped at `MAX_MERGE_DEPTH = 5`, wired into `classifyLocal`, `legacyResultFor`, `getVisibleProduct`, `assertProductUse`, and `patch.ts`. dev-2's self-reported infinite-recursion bug is genuinely fixed: `classifyLocal` terminates on `canonical.status === 'merged_into'` (the helper's actual give-up postcondition) rather than on ID identity, so a cycle resolving to a *different* still-merged row cannot ping-pong. Verified over real HTTP:

```
5-hop chain  GET /v1/products/:id = 200, resolved to chain-5 (canonical)
6-hop chain  GET = 404 in 17 ms                       ← cap exceeded → non-disclosing, no hang, no 500
cycle A→B→A: lookup-v2 = 200 {"outcome":"under_review"} | legacy = 404 | GET = 404
             | PATCH /v1/products/:id = 404 | POST /v1/records = 404 | total 78 ms
```

Every consumer of a cyclical chain terminates fast and answers non-disclosingly, admins included. The cap is documented and 5 hops is far beyond any realistic merge chain.

**[IMPORTANT] `PATCH /v1/products/:id` unguarded FK writer — CLOSED.** The route now goes through `getVisibleProduct` and requires `status === 'active'`. Verified across the full foreign-status matrix, including that **no `ProductEdit` row is created** in any rejection case:

```
PATCH foreign draft / pending / changes_required / report_hidden = 404, edits = 0   (all four)
```

The latent-bug fix (edits keyed to the resolved product id) did **not** change legacy behaviour for plain active products — verified explicitly rather than assumed:

```
PATCH active  = 202  productId echo = 628c47e6…  edit.productId = 628c47e6…  (== the route param)
              isLegacy = false  status = pending
PATCH merged  = 202  edit.productId = 560fd7a3… == canonical.id   (correctly re-keyed)
```

For a non-merged product `product.id === id`, so the echo, the FK, and the one-open-edit constraint key are all unchanged; dev-1's task-#13 resubmission logic (`updateMany` guard, `baseProductVersion = product.version`) is preserved on top.

**[IMPORTANT] Draft PATCH version guard — CLOSED end-to-end.** `version` is now required in `productDraftPatchRequestSchema` (shared, rebuilt and resynced to the mobile vendored copy), and `patchDraft` writes via `updateMany({ where: { id, createdByUserId, status: {in:[…]}, version } })` with a `count === 0` branch that re-runs the ownership/state checks before reporting a version conflict, so the error message matches the real cause:

```
stale version   = 409 {"code":"version_conflict","currentVersion":2}   final name = 'First' (first write kept)
missing version = 400
two concurrent patches at the same version = [200, 409]   version incremented exactly once (1 → 2)
```

## MODERATE spot-checks

| Item | Result |
|---|---|
| `FOR UPDATE` row lock | Present in `assertProductUse` and `persistExternal`. Parameterized (`${productId}::uuid`), and every caller's `productId` is `z.string().uuid()`-validated upstream, so the cast cannot 500. No lock-ordering cycle exists (sync's household path takes household→product; nothing takes product→household) |
| 5 error codes promoted | `grep` finds **zero** remaining bare literals in `api/src`; `ERROR_CODES` lines 96-100 carry all five. Observed on the wire: `410 upgrade_required`, `403 feature_disabled` |
| Hostile drafts cursor | 3 of 4 payloads → `400 validation_error` (was 500). The 4th (`not-even-json`, undecodable) is silently treated as "no cursor" → `200` first page. Not a defect (no 500, no leak, no wrong page), just an inconsistency worth one line if anyone touches `decodeCursor` again |
| Idempotency canonical route + query in hash | Verified behaviourally: same key + same body but `?x=1` → `409 idempotency_key_reused` instead of replaying the first response |
| v2 status pinning | Present per outcome (see IMPORTANT-2) |
| sync class-based rejection match | Present, and the conflict surfaces (see CRITICAL) |
| reports existence oracle | **Closed**: private draft and unknown UUID now return the *same* status and code — `404 report_target_not_found` for both |
| merged/admin conflation + `photos: []` | `PRODUCT_INCLUDE` (ordered by position) is applied at every product fetch feeding a lookup/draft response; merged rows resolve before classification, which moots the admin conflation |
| `product_creation` mode gating | **Approved deferral to Phase 7** — documented in dev-2's addendum lines 120-129 with the phase-file ownership citation. Confirmed documented; not re-flagged |

## `e9f9814` — tracked `.env.test`

- `DATABASE_URL` is now `postgresql://pantry:pantry@localhost:5432/pantry_test`, with a comment stating the placeholder must be overridden via `TEST_DATABASE_URL` and never pointed at a shared/live database.
- The live credential is gone. Confirmed the placeholder cannot reach anything real: role `pantry` **does not exist** on this box (`pg_roles` → `postgres`, `expyrico`, `pantry_app` only), and a direct `psql -U pantry` attempt fails `password authentication failed`.
- Fresh-checkout behaviour verified by actually running a test file with `TEST_DATABASE_URL` and `DATABASE_URL` unset: it **fails safely** with `PrismaClientInitializationError: Authentication failed … credentials for 'pantry' are not valid` — no silent fallback, no connection, nothing truncated.

## Re-verification verdict

**CLEAN.** All 1 CRITICAL + 4 IMPORTANT findings are closed with tests I re-ran myself, 8 of 9 MODERATEs are closed and the 9th is an approved, documented deferral to Phase 7. The remediation fixed causes rather than symptoms (a shared `resolveCanonicalProduct` helper, an error *class* instead of status-code sniffing, a contract-level `version` field, schema-level status pinning as a backstop), and dev-2's self-reported infinite-recursion bug was real, correctly diagnosed, and correctly fixed. **No new findings.** One cosmetic note only: an undecodable drafts cursor is silently ignored (200) while malformed-but-decodable ones are 400.
