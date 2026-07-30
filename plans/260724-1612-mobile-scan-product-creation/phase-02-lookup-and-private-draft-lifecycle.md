---
phase: 2
title: "Lookup and private draft lifecycle"
status: pending
priority: P1
effort: L
dependencies: [1]
---

# Phase 2: Lookup and Private Draft Lifecycle

## Context Links

- [Plan overview](./plan.md)
- [Phase 1 contracts](./phase-01-contracts-and-data-model.md)
- Existing lookup: `api/src/services/products/lookup.ts`, `api/src/routes/products/lookup.ts`
- Existing bypasses: `api/src/routes/products/create.ts`, `api/src/services/records/sync.ts`
- Existing idempotency: `api/src/plugins/idempotency.ts`

## Overview

Add a versioned lookup contract that separates conclusive miss, creator resume, another user's private reservation, and upstream failure without breaking installed clients. Implement private drafts and central product-use authorization, harden idempotency before caching private responses, and close every known product foreign-key writer.

## Requirements

- New endpoint `POST /v1/products/lookup-v2`; keep the legacy endpoint's response/status envelope unchanged until minimum-client retirement, but make its local visibility active-only. An exact `draft|pending|changes_required|report_hidden|merged_into` row short-circuits to the existing legacy 404 envelope without external lookup, backfill, or product serialization, so installed clients never receive an unknown/private status.
- Exact non-active local match short-circuits external lookup:
  - creator + `draft|changes_required` → `editable_private` with authorized product;
  - creator + creator-submission `pending` → `creator_pending` with their authorized product for read-only awaiting-review/personal-pantry continuation;
  - `report_hidden` → strict `{ outcome:'under_review' }` for ordinary users, never `creator_pending`, even when a legacy row has a creator;
  - admin → an authorized private/report-hidden result appropriate to moderation tooling, never a mobile edit entitlement;
  - other user → strict `{ outcome:'under_review' }` only.
- Active visible match → `found`; all applicable sources miss → `{ outcome:'not_found', canCreate }`; any required source failure → `temporarily_unavailable`. `canCreate` is the actor-specific Phase 7 capability and is false until that contract is available.
- `POST /v1/products/drafts` repeats the conclusive lookup server-side before create; no client-signed miss proof is introduced. A reservation created between scan and create yields `editable_private`, `creator_pending`, `under_review`, or visible canonical conflict according to caller and status.
- Conclusive misses never enqueue background backfill. Unavailable retries never issue creation eligibility.
- One creator draft per identifier, immutable identifier, optimistic version, idempotent submit.
- Existing path-only idempotency plugin is hardened before draft/private use.
- Private product is usable only by its creator in a personal pantry record after the abuse-verified submission boundary: creator-owned `pending` is attachable; an existing creator-owned reference remains usable while `changes_required`; `draft` is never attachable. Household, deal, giveaway, and review use require active product.
- Legacy `POST /v1/products` is blocked with typed `upgrade_required` in every creation mode after deployment; only the legacy lookup contract remains compatible. This prevents direct or installed clients from publishing active products outside conclusive lookup and moderation. Reject client `imageUrl` in all new draft contracts.

## Produced Interfaces

```ts
lookupProductV2(input, actor): Promise<ProductLookupV2Response>;
createOrResumeDraft(actorId, input): Promise<{ product: Product; resumed: boolean }>;
getVisibleProduct(actor, productId): Promise<Product | null>;
assertProductUse(actorId, productId, context: {
  purpose: 'personal_record' | 'household_record' | 'review' | 'deal' | 'giveaway';
  existingRecordReference?: boolean; // only preserves own changes_required personal references
}): Promise<void>;
```

Idempotency key becomes `actorId + method + canonical route + client key`; Redis value stores a canonical request hash and state `in_flight|complete`. An atomic Lua transaction/reservation prevents concurrent duplicate execution; body mismatch returns `idempotency_key_reused` 409; stale reservations expire.

## Related Code Files

- Modify: `api/src/plugins/idempotency.ts`
- Test: `api/tests/integration/idempotency.test.ts`
- Modify: `api/src/services/products/off-client.ts`
- Modify: `api/src/services/products/upcitemdb-client.ts`
- Modify: `api/src/services/products/lookup.ts`
- Create: `api/src/services/products/product-visibility.ts`
- Create: `api/src/services/products/product-drafts.ts`
- Modify: `api/src/services/products/search.ts`
- Modify: `api/src/services/reports/repository.ts`
- Modify: `api/src/routes/admin/reports/resolve.ts`
- Modify: `api/src/routes/products/lookup.ts` (legacy envelope preserved; active-only local visibility)
- Create: `api/src/routes/products/lookup-v2.ts`
- Modify: `api/src/routes/products/create.ts`
- Create: `api/src/routes/products/drafts.ts` (`POST` create/resume and authenticated cursor-paginated `GET` creator-private list)
- Create: `api/src/routes/products/draft-update.ts`
- Create: `api/src/routes/products/submit.ts`
- Modify: `api/src/routes/products/get.ts`
- Modify: `api/src/routes/products/index.ts`
- Modify: `api/src/routes/records/create.ts`
- Modify: `api/src/routes/records/patch.ts`
- Modify: `api/src/routes/records/duplicate.ts`
- Modify: `api/src/services/records/sync.ts`
- Modify: `api/src/routes/reviews/create.ts`
- Modify: `api/src/routes/deals/create.ts`
- Modify: `api/src/routes/giveaways/create.ts`
- Test: `api/src/services/products/lookup.test.ts`
- Test: `api/tests/integration/products-lookup.test.ts`
- Test: `api/tests/integration/products-draft-lifecycle.test.ts`
- Test: `api/tests/integration/products-visibility.test.ts`
- Test: `api/tests/integration/product-use-authorization.test.ts`

## Implementation Steps

### Task 1: Harden actor-bound idempotency

- [ ] Write integration tests for same actor/same body replay, same actor/different body conflict, cross-user same key isolation, simultaneous requests executing once, 5xx not cached, and abandoned in-flight expiry.
- [ ] Run `pnpm --dir api test -- tests/integration/idempotency.test.ts`.
  Expected: FAIL against path-only GET/SET behavior.
- [ ] Canonicalize method/route/body, hash the request, and atomically reserve via Redis script/transaction. Auth must run before idempotency so actor ID exists. Wait/replay boundedly for identical in-flight requests; never replay another actor's payload.
- [ ] Run the focused test.
  Expected: PASS.

### Task 2: Add explicit source and local-visibility outcomes

- [ ] Write client/unit matrices: provider 404/no product → `not_found`; 429/timeout/5xx/invalid payload → `unavailable`; valid → `found`.
- [ ] Add v2 orchestration cases for active local, report-hidden local → metadata-free `under_review`, creator draft/changes-required → `editable_private`, creator pending → `creator_pending`, another user's private row, admin private/report-hidden, merged canonical, OFF hit, UPC hit, full miss, and every unavailable combination.
- [ ] Add an independent installed-client legacy matrix: active visible local returns the unchanged product envelope; exact `draft|pending|changes_required|report_hidden|merged_into` returns the existing legacy 404 status/body, never calls external providers/backfill, and never serializes product metadata or a new status. Confirm the same behavior during Phase 1's compatibility window where old report-hidden `pending` and new `report_hidden` rows coexist.
- [ ] Assert private exact matches do not call external providers or backfill; `creator_pending` is caller-owned and read-only; `under_review` contains no private fields.
- [ ] Run `pnpm --dir api test -- src/services/products/lookup.test.ts tests/integration/products-lookup.test.ts`.
  Expected: FAIL because `safe()` collapses errors and no v2 route exists.
- [ ] Implement explicit source adapters and visibility-first local lookup. Remove conclusive-miss backfill. External persistence must re-read conflicts and never update `source='user'` or private rows.
- [ ] Switch report auto-hide/resolution writers from compatibility-era `pending` to `report_hidden`, with focused tests proving they never create creator `pending`. Phase 1 compatibility readers are already fully deployed, so this writer change is safe during the Phase 2 rollout.
- [ ] Add `POST /v1/products/lookup-v2`. Route legacy lookup through a dedicated active-only projection/local check: exact non-active reservations produce the existing legacy 404 envelope and stop lookup; do not pass a non-active `Product` to the legacy serializer. Preserve all legacy response/status shapes for active hits, external hits, misses, and errors.
- [ ] Run focused tests.
  Expected: PASS.

### Task 3: Centralize read and use authorization

- [ ] Write role/state matrix tests for detail/search/lookup plus every product writer named above.
- [ ] Include direct record create, record PATCH scope transitions, record duplication, offline sync batch create/update attempts, and household records. Expected policy: `draft` is rejected everywhere; own creator-submitted `pending` is allowed only for a new personal record; an existing own personal reference may remain while `changes_required` but cannot be newly attached or moved to household; duplicating an eligible creator-owned personal record preserves personal scope; household/review/deal/giveaway require active; another user receives non-enumerating rejection.
- [ ] Add REST and sync regression cases proving a direct caller cannot create a record for a `draft`, and personal→household or household→household PATCH cannot move a private-product reference merely because the caller belongs to the target household.
- [ ] Run `pnpm --dir api test -- tests/integration/products-visibility.test.ts tests/integration/product-use-authorization.test.ts`.
  Expected: FAIL because detail and writers use direct existence/Prisma checks.
- [ ] Implement `getVisibleProduct` and `assertProductUse`; call them from record create, record PATCH against the resulting scope before mutation, record duplicate before copying a product reference, each sync upsert before DB mutation, review, deal, giveaway, detail, search, and media consumers. Scope-transition authorization and record update must share a transaction/lock so the product state/reference cannot change between the check and update.
- [ ] Return 404/non-enumerating error when caller must not learn existence. Do not echo private product metadata through record sync conflict responses.
- [ ] Run focused tests.
  Expected: PASS.

### Task 4: Implement create/resume/update/submit lifecycle

- [ ] Write tests for server-rechecked miss, source unavailable on create, creator resume, same-creator create race that has already reached pending → `creator_pending`, another-user under-review race, active canonical race, concurrent create, immutable identifier, validation/control characters, stale version, valid submit/replay, changes-required resubmit, and cursor-paginated creator-private listing that excludes every other user's rows.
- [ ] Run `pnpm --dir api test -- tests/integration/products-draft-lifecycle.test.ts`.
  Expected: FAIL before services/routes.
- [ ] `createOrResumeDraft` first checks exact local state; if no row, performs conclusive lookup; only `not_found` proceeds to transactional `status='draft'` insert. PostgreSQL uniqueness decides races; translate by re-reading through visibility-safe outcome logic.
- [ ] Add authenticated `GET /v1/products/drafts?cursor=&limit=&status=` consuming Phase 1 `productDraftsQuerySchema` and returning `productDraftsPageSchema`. Include only the caller's `draft|pending|changes_required` products, ordered by `updatedAt DESC,id DESC`; encode both ordering fields in the opaque cursor. Cover uses the caller-authorized private thumbnail route and never a storage key. Admin/global queues remain separate.
- [ ] Patch metadata with conditional owner/state/version update and increment. Normalize description through Phase 1 shared function.
- [ ] Submit conditionally transitions `draft|changes_required → pending`, records submission timestamp, clears current feedback, increments version, and consumes Phase 7 abuse-verification interface. Until Phase 7 is complete, the route remains feature-mode disabled; do not use an acceptance stub.
- [ ] For legacy create, add a direct-call regression test proving every mode returns typed `upgrade_required` and no active product is inserted. Legacy lookup keeps its response/status envelope while applying active-only local visibility; legacy create compatibility is intentionally ended to close the moderation bypass.
- [ ] Run focused tests.
  Expected: PASS for lifecycle under a test verifier adapter and all mode branches.

### Task 5: Regression and commit boundary

- [ ] Run:

```bash
pnpm --dir api test -- tests/integration/idempotency.test.ts
pnpm --dir api test -- tests/integration/products-lookup.test.ts
pnpm --dir api test -- tests/integration/products-draft-lifecycle.test.ts
pnpm --dir api test -- tests/integration/products-visibility.test.ts
pnpm --dir api test -- tests/integration/product-use-authorization.test.ts
pnpm --dir api typecheck
```

- [ ] Commit after PASS:

```bash
git add api/src/plugins/idempotency.ts api/src/services/products api/src/services/reports/repository.ts api/src/routes/admin/reports/resolve.ts api/src/routes/products api/src/routes/records/create.ts api/src/routes/records/patch.ts api/src/routes/records/duplicate.ts api/src/services/records/sync.ts api/src/routes/reviews/create.ts api/src/routes/deals/create.ts api/src/routes/giveaways/create.ts api/tests
git commit -m "feat(products): add private draft lifecycle"
```

## Success Criteria

- [ ] Installed clients retain legacy lookup semantics until intentionally retired.
- [ ] V2 distinguishes visible, creator-private, metadata-free under-review, full miss, and unavailable.
- [ ] Full miss never queues backfill; draft create independently reconfirms eligibility.
- [ ] Idempotency cannot replay private responses across actors/bodies or double-execute concurrently.
- [ ] Every known product FK writer enforces active/submitted-creator-personal policy, including record PATCH and offline sync; drafts cannot bypass abuse verification.
- [ ] Legacy create cannot bypass moderation once v2 rollout begins.
- [ ] Draft mutation/submission enforce ownership, state, version, and idempotency.

## Risk Assessment

| Risk | Likelihood | Impact | Rating | Mitigation / rollback trigger | Owner |
|---|---|---|---|---|---|
| Old client misinterprets v2 | Low | High | High | separate endpoint; legacy contract tests; roll back client flag | API/Mobile |
| Private response replay | Medium | Critical | Critical | actor/body-bound atomic idempotency; block deployment on failure | Security/API |
| Offline sync bypass | Medium | High | High | exact writer matrix and batch tests | API |
| Create/external race | Medium | Medium | Medium | server recheck + DB uniqueness + safe conflict translation | API/DB |
| Legacy endpoint bypass | Medium | High | High | mode-aware server rejection; direct API regression | API |
