---
phase: 4
title: "Moderation and active-product revisions"
status: pending
priority: P1
effort: L
dependencies: [1, 2, 3]
---

# Phase 4: Moderation and Active-Product Revisions

## Context Links

- [Plan overview](./plan.md)
- [Phase 1 revision model](./phase-01-contracts-and-data-model.md)
- [Phase 3 publication primitive](./phase-03-product-media-pipeline-and-vps-delivery.md)
- Existing routes: `api/src/routes/admin/products/`
- Existing merge: `api/src/services/admin/merge.ts`
- Existing audit: `api/src/services/audit/log.ts`, `api/src/plugins/audit.ts`

## Overview

Implement transactional moderation and versioned active-product revision workflows using the complete Phase 1 desired-photo model. Product state changes and mandatory audit rows commit atomically; public-file creation uses Phase 3 compensation and cleanup journaling.

## Requirements

- Product actions: `approve | request_changes`; ordinary revision actions: `approve | request_changes`. Resulting editable status is `changes_required`; moderation never writes `rejected`. Existing rejected edits remain historical/read-only, and explicit stale-revision `supersede` may write terminal `rejected` only with a machine-safe superseded reason plus atomic audit event.
- New product approval publishes every approved desired photo to fresh public UUID paths, then conditionally commits status/photo public keys/cover/audit.
- Revision approval validates `baseProductVersion`, applies metadata and complete retained/staged order atomically, and never mutates live product before approval.
- A stale open revision is recoverable only through explicit admin `rebase` or `supersede` action. Rebase rebuilds the desired set against the current product under locks after showing the diff; supersede preserves history/staged cleanup and releases the one-open-edit constraint so the creator can start again. No automatic approval/rebase occurs.
- Retained `ProductPhoto` references use restrictive deletion. Admin photo correction must first rebase or supersede every open edit referencing the photo in the same locked workflow.
- `AdminAuditLog` row is inserted in the same Prisma transaction as approve/request-change/correction/merge/rebase/supersede.
- Phase 3 commits a prepared `MediaOperationOutbox` intent before any final public copy. The moderation reference transaction atomically completes that intent and inserts follow-up cleanup work; expired-intent recovery covers process death before commit. BullMQ wake-up failure cannot lose work.
- Metadata-only revisions on legacy products with `imageUrl` but zero `ProductPhoto` rows preserve that compatibility URL. Only a relation-backed photo-set change recalculates `imageUrl`.
- Merge locks products in sorted ID order and explicitly handles every known relation and identifier transfer.

## Produced Interfaces

```ts
moderateProduct(actor, requestMeta, input): Promise<Product>;
createOrResumeProductEdit(actor, productId): Promise<ProductEdit>;
resolveProductEdit(actor, requestMeta, input): Promise<Product | ProductEdit>;
recoverProductEdit(actor, requestMeta, input: {
  editId: string;
  action: 'rebase' | 'supersede';
  editVersion: number;
  productVersion: number;
}): Promise<ProductEdit>;
mergeProducts(actor, requestMeta, sourceIds, targetId, version): Promise<Product>;
```

`requestMeta` contains request ID and safe audit context. Domain services receive a Prisma transaction client for audit insertion; they do not call the separate post-response audit plugin for mandatory product events.

## Related Code Files

- Create: `api/src/services/products/product-moderation.ts`
- Create: `api/src/services/products/product-edits.ts`
- Modify: `api/src/services/products/product-photos.ts`
- Modify: `api/src/services/audit/log.ts` to accept transaction client
- Modify: `api/src/routes/admin/products/pending.ts`
- Modify: `api/src/routes/admin/products/pending-resolve.ts`
- Modify: `api/src/routes/admin/products/get.ts`
- Modify: `api/src/routes/admin/products/patch.ts`
- Modify: `api/src/routes/admin/products/merge.ts`
- Modify: product-edit routes under `api/src/routes/products/`
- Create: `api/src/routes/admin/products/product-edit-recovery.ts`
- Modify: `api/src/services/admin/merge.ts`
- Test: `api/tests/integration/admin-product-moderation.test.ts`
- Test: `api/tests/integration/product-edits.test.ts`
- Test: `api/tests/integration/admin-product-merge.test.ts`

## Implementation Steps

### Task 1: Moderate new products with atomic audit

- [ ] Write tests for admin RBAC, queue pagination/eager photos, approve, request changes/reason, stale version, replay, invalid transitions, creator feedback, other-user invisibility, and audit insertion failure.
- [ ] Fault test: process death after each public copy but before DB/audit transaction leaves a recoverable prepared intent; DB/audit failure keeps the product pending with no referenced public URL; compensation or expired-intent recovery deletes every unreferenced public object after reference recheck.
- [ ] Run `pnpm --dir api test -- tests/integration/admin-product-moderation.test.ts`.
  Expected: FAIL.
- [ ] Implement queue projection with ordered private media and history in bounded queries.
- [ ] For approval: use Phase 3's production capacity service to atomically reserve worst-case bytes for the complete publication set; commit a prepared intent with every deterministic fresh public key; then hold/heartbeat the media lease, intent, and reservation while creating variants and committing references. Transactionally compare pending/version, set active, approve photos/store public keys, set cover `imageUrl`, increment version, insert `AdminAuditLog`, complete the prepared intent, and insert follow-up cleanup rows. On failure compensate under the same lease or let expired-intent recovery delete unreferenced keys; reconcile/release capacity on every path. After success reconcile to actual retained bytes and wake the worker.
- [ ] For request changes: transactionally set `changes_required`, reason/actor/time/version, and audit; retain private media.
- [ ] Run focused test.
  Expected: PASS.

### Task 2: Implement complete creator revision lifecycle

- [ ] Write tests for one open edit race, metadata patch, desired set containing retained live + staged photos, reorder/delete, submit/replay, request changes/resubmit, another user, edit-version conflict, and stale base product. Include a legacy active product with `imageUrl` and zero relation photos: a name-only revision must preserve `imageUrl`.
- [ ] Assert public product bytes/DTO stay unchanged while edit is draft/pending/changes-required.
- [ ] Run `pnpm --dir api test -- tests/integration/product-edits.test.ts`.
  Expected: FAIL.
- [ ] Implement create/resume using Phase 1 partial unique constraint; initialize desired entries from current live photos and `baseProductVersion`. Record whether the proposal actually changes relation-backed photos; absence of relation entries alone is not a request to erase a compatibility-only `imageUrl`.
- [ ] Reuse Phase 3 private processor for staged entries. Metadata/photo mutations conditionally increment edit version.
- [ ] Submit `draft|changes_required → pending`. Approval requires `product.version === baseProductVersion`; through Phase 3 it reserves the complete publication set and commits/heartbeats a prepared intent before publishing staged entries. One transaction applies metadata/full order/public keys/product version/edit approved/audit, completes the intent, and inserts cleanup work. Retained entries retain public immutable paths; metadata-only legacy revisions preserve compatibility `imageUrl`. Add revision-specific process-death recovery tests after each staged public copy but before this transaction.
- [ ] On stale base, return `version_conflict` and expose admin recovery: `rebase` locks product/edit/current photos, requires explicit reviewed mapping for removed/replaced retained photos, updates `baseProductVersion` and desired set, increments edit version, and returns it to `pending` for re-review; `supersede` closes the edit as historical `rejected` with a machine-safe superseded reason, inserts staged-media cleanup outbox rows, and permits a new edit. Both actions audit atomically.
- [ ] Add concurrent correction-versus-rebase, retained-photo deletion, supersede/recreate, and stale recovery-version tests. `onDelete: Restrict` must block raw deletion; the domain flow cannot commit correction until each referencing open edit is rebased or superseded.
- [ ] Run focused test.
  Expected: PASS.

### Task 3: Direct admin correction/photo management

- [ ] Add tests for field correction, order/remove, cover projection, version conflict, pending edit staleness, audit failure rollback, and publication compensation.
- [ ] Route through moderation/photo services with the same transaction/audit invariant. Incrementing product version intentionally makes pending edit base stale.
- [ ] Run `pnpm --dir api test -- tests/integration/admin-product-moderation.test.ts -t "correction|photo"`.
  Expected: PASS.

### Task 4: Define and implement exact merge policy

- [ ] Test relations and policy:
  - `Record`: repoint to target.
  - `Review`: when same user reviewed both, retain target review and delete/archive loser review per existing behavior; recalculate counts.
  - `Deal`/`Giveaway`: repoint and retain lifecycle/history.
  - `ProductEdit`: reject the merge while source or target has an open `draft|pending|changes_required` edit; approved and legacy rejected history stays linked to its original product.
  - `ProductPhoto`: source remains for history until cleanup; active target media is not implicitly replaced.
  - Merge chains: resolve target to canonical active; reject cycles/self-merge.
  - Identifiers: target acquires a missing identifier only; conflicting non-equal identifier requires explicit admin choice and no silent overwrite. Under sorted product locks, preserve source/target originals in audit, clear the transferred barcode/QR from the source, assign it to the target, and mark the source `merged_into` in the same transaction so global uniqueness is never violated.
- [ ] Add concurrent opposite-direction merge plus independent barcode/QR transfer tests covering rollback after source-clear, concurrent lookup under transaction isolation, and uniqueness preservation; acquire advisory/row locks in deterministic sorted product-ID order.
- [ ] Run `pnpm --dir api test -- tests/integration/admin-product-merge.test.ts`.
  Expected: FAIL against current records/reviews-only merge.
- [ ] Implement one transaction for locks, relation policies, source `merged_into`, target counts/version, cleanup records, and audit. Never delete source row or files synchronously.
- [ ] Run focused test.
  Expected: PASS.

### Task 5: Regression and commit boundary

- [ ] Run:

```bash
pnpm --dir api test -- tests/integration/admin-product-moderation.test.ts
pnpm --dir api test -- tests/integration/product-edits.test.ts
pnpm --dir api test -- tests/integration/admin-product-merge.test.ts
pnpm --dir api typecheck
```

- [ ] Commit after PASS:

```bash
git add api/src/services/products api/src/services/admin/merge.ts api/src/services/audit/log.ts api/src/routes/admin/products api/src/routes/products api/tests/integration
git commit -m "feat(products): add moderation and revisions"
```

## Success Criteria

- [ ] Product/revision state, mandatory audit, and durable media-outbox work commit or roll back together.
- [ ] Failed public publication/DB transition leaves no referenced or leaked public object, and whole-set capacity reservations survive concurrency.
- [ ] Revision desired order represents retained and staged photos; live product stays unchanged preapproval; compatibility-only `imageUrl` survives metadata-only edits.
- [ ] Stale edits have tested rebase/supersede recovery and cannot overwrite later admin correction or lose retained-photo integrity.
- [ ] Merge covers records, reviews, deals, giveaways, edit-history/open-edit guards, photos, chains, atomic identifier transfer, and opposite-direction races.
- [ ] Focused suites and API typecheck pass.

## Risk Assessment

| Risk | Likelihood | Impact | Rating | Mitigation / rollback trigger | Owner |
|---|---|---|---|---|---|
| Publish without audit/state | Low | Critical | Critical | same DB transaction + publication compensation; block release on fault test | API/Security |
| Revision overwrites correction | Medium | High | High | base product version and no auto-rebase | API/Admin |
| Merge corrupts dependencies | Medium | Critical | Critical | exact relation policy, deterministic locks, retain source row | API/DB |
| Cleanup deletes referenced bytes | Low | High | High | durable record + reference recheck post-commit | API/Ops |
