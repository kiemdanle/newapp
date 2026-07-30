## Executed Phase

- Phase: phase-04-moderation-and-active-product-revisions
- Plan: `plans/260724-1612-mobile-scan-product-creation/`
- Status: completed
- Commit: `03a4ea7` "feat(products): add moderation and revisions"
- This report is retroactive (N8 in reviewer-p4's review — never written at the
  time) and includes the task #18 remediation as a second section below.

## Files Created

- `api/src/services/products/product-moderation.ts` — new-product moderation
  (`moderateProduct`)
- `api/src/services/products/product-edits.ts` — full creator revision lifecycle
  (`createOrResumeProductEdit`, `patchProductEditMetadata`, `resolveProductEdit`,
  `recoverProductEdit`, `toProductEditRow`)
- `api/src/routes/admin/products/moderate.ts` — `POST /v1/admin/products/:id/moderate`
- `api/src/routes/admin/products/product-edit-recovery.ts` — `POST /v1/admin/products/edits/:editId/recover`
- `api/src/routes/products/edit-create.ts`, `edit-metadata.ts`, `edit-photo-upload.ts`,
  `edit-photo-delete.ts`, `edit-photo-order.ts`, `edit-submit.ts` — creator-facing
  edit-scoped routes (`/v1/products/:id/edit`, `/v1/product-edits/*`)
- `packages/shared/src/schemas/product-edits.ts` — creator-facing edit DTO/request schemas
- Tests: `api/tests/integration/admin-product-moderation.test.ts`,
  `product-edits.test.ts`, `admin-product-merge.test.ts`,
  `packages/shared/src/schemas/product-edits.test.ts`

## Files Modified

- `api/src/services/products/product-photos.ts` — edit-scoped photo staging
  functions (`addProductEditPhoto`/`removeProductEditPhoto`/
  `reorderProductEditPhotos`/`publishProductEditPhoto`), admin-only audit hook
- `api/src/services/admin/merge.ts` — full policy rewrite (was records/reviews-only)
- `api/src/services/audit/log.ts` — `writeAuditLog(input, tx?)` accepts a
  transaction client for atomic commit
- `api/src/routes/admin/products/{get,list,patch,pending-resolve,merge}.ts` —
  photos/moderation-history projection, version-guarded atomic correction,
  routed through `resolveProductEdit`, renamed merge contract
- `api/src/routes/products/{index,patch,photo-upload,photo-delete,photo-order}.ts` —
  registration, `requestMeta` threading for admin-audit
- `api/src/server.ts`, `api/src/routes/admin/index.ts`, `api/src/routes/products/index.ts` —
  route registration
- `api/src/errors.ts`, `packages/shared/src/schemas/{error,admin/products}.ts` —
  `identifierConflict`/moderate/recover/merge contract additions

## Tasks Completed (original implementation, all 5 per phase file)

1. Moderate new products with atomic audit — `moderateProduct`, capacity/outbox/lease
   publish flow, version-guarded transaction, `product.moderate` audit
2. Full creator revision lifecycle — create/resume seeding desired photo set from
   live photos, edit-scoped staging routes, submit, admin approve (metadata + photo
   order + publish) / request_changes, rebase/supersede recovery
3. Direct admin correction — version-guarded atomic `patch.ts`, admin-only audited
   photo add/remove/reorder
4. Merge policy rewrite — sorted locks, records/reviews-dedup/deals/giveaways,
   open-edit guard, atomic identifier transfer, merge-chain resolution
5. Regression + commit — 47 dedicated tests, full suite green, committed `03a4ea7`

## Tests Status (at commit `03a4ea7`)

- Dedicated suites: 47/47 (`admin-product-moderation` 17, `product-edits` 17,
  `admin-product-merge` 13)
- Full API suite: 780/780 in an isolated throwaway DB
- Typecheck: clean (api + shared)

## Issues / Deviations (documented at the time, per review-decision rules)

- `moderateProduct`/`resolveProductEdit`/`mergeProducts` return richer shapes than
  the phase file's simplified `Promise<Product>`/`Promise<Product|ProductEdit>`
  signatures (admin-projection rows / stats objects) — matches existing admin
  route conventions and the already-approved shared-schema shapes.
- Admin `pending-resolve.ts` reads the edit fresh and supplies its version
  internally rather than requiring a client-sent version field, to avoid breaking
  that endpoint's pre-existing request contract.

---

# Remediation — reviewer-p4 review (task #18, 260730)

Full review: `reports/reviewer-p4-260730-phase-04-review.md`. Fixed the CRITICAL, all
7 IMPORTANT, and all 8 MODERATE findings.

### C1 — Staged revision photos published under the edit id, not the product id (CLOSED)

`publishProductEditPhoto` now takes an explicit `productId` parameter and derives
the public prefix from it (`publicProductPhotoPrefix(productId, publicationId)`),
matching the prepared intent's keys and the compensation/recovery path exactly —
both of which were previously silent no-ops against a path that was never
written. New fault-injection test (see I7) asserts zero files remain under
`public/` and the recoverable prepared intent's keys start with
`public/products/<productId>/` after a forced post-publish failure.

### I1 — P2003 (HTTP 500) when approve drops a live photo retained by a *resolved* historical edit (CLOSED)

`ProductEditPhoto`'s representation check constraint is a strict XOR between
"retained" (source id set, every staged field null) and "staged" (source id
null, every staged field set) — nulling the FK alone to "detach" a historical
row (my first attempt) violates it. Fixed by deleting the resolved edit's
now-meaningless photo-slot row instead; the `ProductEdit` row itself (status,
`proposed` snapshot, audit trail) stays full history. The pre-existing open-edit
blocker is unchanged and now re-verified a second time under lock inside the
reference transaction (closes a TOCTOU window between the pre-check and commit).
Test: creator A's photo-retaining edit gets approved (resolved history), creator
B's edit then drops that same live photo and approves successfully; the
resolved row is gone, the `ProductEdit` row remains `approved`.

### I2 — P2002 (HTTP 500) merging two sources reviewed by the same user (CLOSED)

Review dedup now compares across the *whole* merge set (target + every source),
not just target-vs-source: the target's own review always wins if present,
otherwise the lowest-id source review survives (deterministic) and every other
same-user review is dropped before repointing. Test: two sources, one shared
reviewer, no target review — exactly one review survives on the target,
matching the deterministic tie-break.

### I3 — `approveEdit`'s terminal write was unguarded, letting it silently overwrite a concurrent supersede/request_changes/resubmit (CLOSED)

The terminal `productEdit.update` is now a guarded `updateMany({ where: { id,
status: 'pending', version: edit.version } })`, mirroring `requestChangesOnEdit`
and `submitProductEdit`; `count === 0` raises a typed `version_conflict`.
Test: `approve` and `request_changes` fired concurrently via `Promise.allSettled`
on the same pending edit — exactly one commits, the loser gets a typed 409,
never both applied.

### I4 — New-product/revision approval never set the compatibility cover `imageUrl` (CLOSED)

Both `moderateProduct`'s `approve()` and `product-edits.ts`'s `approveEdit()` now
set `imageUrl` to the position-0 photo's fresh public display URL. For revisions
this is conditional on the photo set actually changing (staged add, live
removal, or a retained entry's position moving) — a pure metadata-only edit
still leaves `imageUrl` untouched, preserving the already-tested legacy-preservation
behavior. Tests added for both the new-product and revision paths.

### I5 — Admin `PATCH` accepted arbitrary `status`, bypassing the moderation/merge pipelines (CLOSED)

Direct status transitions are now restricted to `active <-> report_hidden` (a
pure catalog-visibility toggle with no publication side effects); every other
transition (activating `pending`, clearing `merged_into`, touching
`draft`/`changes_required`) returns a typed 409 pointing at
`moderateProduct`/`mergeProducts`. Tests: activating a `pending` product directly
is rejected (photos stay unpublished); setting `merged_into` directly is
rejected; the legitimate `active <-> report_hidden` toggle still works.

### I6 — Merge contract rename shipped without updating its consumers (CLOSED)

Rebuilt `packages/shared` and resynced
`apps/mobile/local-packages/@expyrico/shared/dist` (mobile `shared-contract` test
green). Added a compile-time + runtime drift guard
(`AdminProductMerge`/`adminProductMergeSchema` tests) so a future silent field
rename fails loudly. `apps/admin/src/lib/admin-api.ts`/`actions.ts` — coordinated
directly with dev-2, who already owned and had updated the merge client to
`{targetId, sourceIds, version}` as part of their Phase 6 work; verified via
`pnpm typecheck` and a full `next build` in `apps/admin` (clean).

### I7 — Task 1's fault test never exercised the fault it was named for (CLOSED, both paths)

Rewrote using `vi.spyOn` on `writeAuditLog` (the last statement inside each
reference transaction) to inject a forced failure *after* capacity reservation,
intent preparation, and the real byte copy — for both `moderateProduct`'s
`approve()` and `product-edits.ts`'s `approveEdit()`. Each asserts: (a)
product/photo/edit rows unchanged, (b) zero files remain anywhere under the
public media root (recursive walk, not just a parent-directory check — an empty
directory left behind by `removeKeyPrefix` is not itself a leak), (c) the
prepared intent row is still `prepared` with keys matching what was actually
written under the product's own id. This is exactly the check that would have
caught C1 before it shipped.

### M1 — `recoverProductEdit` didn't require staleness; `rebase` could promote a never-submitted draft to pending (CLOSED)

Both actions now require `product.version !== edit.baseProductVersion` explicitly
(a 409 "not stale" otherwise) — recovery is not applicable to a healthy edit.
`rebase` is further restricted to `pending`/`changes_required` (never `draft`);
`supersede` may still legitimately apply to a stale `draft`. Tests for both
rejections plus the supersede-on-draft allowance.

### M2 — `rebase`/`supersede` cleared unread creator feedback when the admin didn't supply new notes (CLOSED)

Both actions now preserve the edit's existing `moderationNotes` when
`input.notes` is `undefined`, only overwriting it when the admin explicitly
supplies new text. Tests for both actions.

### M3 — `supersede` read staged photos outside its transaction (CLOSED)

Re-reads `ProductEditPhoto` rows inside the transaction after taking the same
`FOR UPDATE` lock on the edit row `assertEditPhotoMutable` uses, so a concurrent
upload landing in the window is either fully visible (and enqueued for cleanup)
or blocked until commit — never silently missed.

### M4 — `currentVersionOf` queried the pooled client from inside an open transaction (CLOSED)

Now takes the transaction client explicitly and reads through it — no second
pool connection held open alongside the aborting transaction.

### M5 — Merge tests were missing rollback-after-source-clear and concurrent-lookup-under-isolation coverage (CLOSED)

Added: a forced failure after the source's barcode was cleared (via the same
`writeAuditLog` spy technique) proves the whole transaction — including the
already-issued clear — rolls back together; and a delayed-audit-write test
proves a concurrent reader outside the transaction only ever observes the
fully-committed `merged_into` state, never a half-applied one (READ COMMITTED).

### M6 — `pending.ts`'s queue projection carried no photos, no parsed name (CLOSED)

Reuses `toProductEditRow` (same projection every other edit-facing route
derives from) to add `name` and an ordered `coverPhoto` to each list row —
`adminProductEditRowSchema` gained both fields (optional, non-breaking). Kept as
a genuinely bounded query (one `include` on the paginated list, not N+1).
`pending-get.ts` (single-edit detail) already existed from dev-2's concurrent
Phase 6 work — no collision, verified via rebuild.

### M7 — `resolveProductEdit`/`recoverProductEdit`'s admin branches had no service-level role check (CLOSED)

Added `assertAdmin(actor)` to `approveEdit`, `requestChangesOnEdit`, and
`recoverProductEdit` — defense in depth alongside route-level `adminOnlyPlugin`
gating. Test confirms a non-admin actor is rejected at the service layer.

### M8 — Merge repointed only 4 relations; `Report` was untouched (CLOSED)

`Report.targetId` is a polymorphic `(targetType, targetId)` pair with no real FK
to `Product` — now explicitly repointed
(`WHERE targetType='product' AND targetId IN sourceIds`) in the same
transaction. `Giveaway.productId` was already repointed in the original
implementation (the review's schema-line reference for this appears to predate
a schema shift); confirmed via `grep` that `Record`/`Review`/`Deal`/`Giveaway`
are the complete set of nullable `productId` columns in the schema.

## Coordination

- dev-3 (Phase 3/7): confirmed no overlap on the C1/I1 fixes; separately flagged
  a transient mid-edit breakage in `product-image-processor.ts` (their own
  uncommitted WIP) that briefly broke typecheck for unrelated files that import
  `processProductUpload` — resolved before the final gate below.
- dev-2 (Phase 6): confirmed they already owned and had updated
  `apps/admin/src/lib/admin-api.ts`'s merge client to the new contract; their
  `adminProductEditDetailSchema` addition to `packages/shared/src/schemas/product-edits.ts`
  came through the rebuild with no conflict.

## Tests Status (final, task #18 gate)

- Targeted suites: `admin-product-moderation.test.ts` 21/21, `product-edits.test.ts`
  26/26, `admin-product-merge.test.ts` 17/17
- Full API suite (isolated throwaway DB, `pantry_dev1_p4r`, dropped after): 107
  files / 855 tests. One transient failure (`admin photo add/remove...` → 507
  `capacity_exceeded`) under this machine's concurrent multi-agent Redis load;
  re-ran `admin-product-moderation.test.ts` alone immediately after → 21/21
  clean, confirming the shared-capacity-budget contention, not a regression
  (same class as reviewer-p4's own N1 note on `product-media-coordinator.test.ts`).
- Typecheck: api + shared clean
- `apps/admin`: typecheck clean, `next build` clean (after clearing a stale
  `.next` cache unrelated to this change)
- Mobile: `shared-contract.test.ts` green against the resynced vendored copy

## Next Steps

- None blocking. Awaiting reviewer-p4 re-verification.
