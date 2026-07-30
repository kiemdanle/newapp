# Phase 1 Implementation Report — Contracts and Data Model

## Executed Phase
- Phase: phase-01-contracts-and-data-model
- Plan: plans/260724-1612-mobile-scan-product-creation
- Status: completed
- Commit: `1a42b0c feat(products): add draft and photo contracts`

## Critical Finding: Adopted Pre-Existing DB Schema

Before writing code, discovered the local dev/test Postgres db ("pantry", shared by
`.env` and `.env.test`) already had Phase 1's full schema applied via two migrations
(`20260726160000_expand_product_lifecycle_enums`,
`20260726160100_expand_product_drafts_photos_and_moderation`, both recorded in
`_prisma_migrations`, finished 2026-07-29) with **no corresponding git history** —
not even a dangling commit (`git fsck --unreachable` found nothing from this
timeframe). `api/prisma/schema.prisma` in git was still pre-Phase-1. Most likely a
prior session ran `prisma migrate dev` (mutates the DB directly) and its source
changes were lost to one of several `reset: moving to origin/main` reflog events on
this branch; DB state isn't touched by git resets, so only the DB survived.

Introspected it fully (pg_dump + pg_catalog) and found it well-built, matching/
exceeding the phase spec (`is_legacy` flag exempting historical `product_edits` rows
from the new one-open-edit constraint, `moderated_at`/`moderated_by_user_id` on
products, immutability triggers on `product_id` FKs, a combined check tying photo
`moderation_status` to which storage key is set, an `is_valid_media_operation_payload`
SQL function, etc.). Got explicit team-lead approval to adopt it rather than drop and
redesign fresh (see message thread) with 4 conditions, all satisfied:

1. **Checksum reconciliation**: reverse-engineered `schema.prisma` + both
   `migration.sql` files to match the live DB exactly. Verified via
   `prisma migrate diff --from-url pantry --to-schema-datamodel schema.prisma` = empty
   migration, then `DELETE FROM _prisma_migrations WHERE migration_name IN (...)` +
   `prisma migrate resolve --applied <name>` for each (no SQL re-executed against
   `pantry`). End state verified: `prisma migrate deploy` → "No pending migrations to
   apply", `prisma validate` → passes, diff → empty.
2. **Test DB isolation**: created a fresh `pantry_test` database, ran
   `prisma migrate deploy` against it from scratch (all 21 migrations, including my
   two reconstructed ones) — proved migration A replays cleanly, not just diffs clean.
   Confirmed byte-identical structure to `pantry` for every Phase-1-touched object via
   `pg_dump --schema-only` diff (found and fixed one representational drift: two
   unique constraints I'd written as plain `CREATE UNIQUE INDEX` were actually
   `ADD CONSTRAINT ... UNIQUE` on live `pantry`; fixed and re-verified zero diff).
   Pointed local `api/.env.test` at `pantry_test` — **not committed**, per explicit
   instruction; this is a local-only change every future session must also make
   before running API integration tests (`DATABASE_URL` in the tracked `.env.test`
   still points at `pantry` as of this commit).
3. **Verification coverage**: see checklist below; DB-exceeds-spec extras documented
   inline above rather than trimmed.
4. **Migration B**: created as a new, unapplied file
   (`20260730040000_classify_report_hidden_products`) with a `DO $$...RAISE
   EXCEPTION` preflight guarding the one DB-checkable precondition (no `pending` row
   may carry a `submitted_at`). Tested only inside rolled-back Prisma transactions
   against `pantry_test`, never committed anywhere, never deployed. Phase 8 owns
   execution. **Operational hazard for future phases**: this file now sits in
   `api/prisma/migrations/`; any future `prisma migrate deploy`/`dev` against a DB
   that has migration A applied will also apply migration B (Prisma has no "defer N
   phases" concept — the gate is purely procedural/preflight, not tooling-enforced).
   Phase 2/3/4 devs should not blindly run migrate against shared "pantry"-like
   environments without checking pending migrations first.

## Files Modified/Created
- `packages/shared/package.json`, `tsconfig.build.json` (new) — real vitest gate,
  `build` now excludes `*.test.ts` from `dist` (was leaking compiled tests into the
  published/vendored package before I caught and fixed it).
- `packages/shared/src/schemas/{product,error}.ts`, `admin/{products,settings}.ts` +
  4 new colocated `*.test.ts` (51 tests).
- `api/prisma/schema.prisma` — reconstructed to match adopted DB.
- `api/prisma/migrations/20260726160000_.../migration.sql`,
  `20260726160100_.../migration.sql`, `20260730040000_.../migration.sql` (new).
- `api/src/errors.ts` — structured `currentVersion`/`canonicalProduct` on `AppError`.
- `api/src/services/products/serializer.ts` — description/version/moderationFeedback/
  photos (public-safe projection only).
- `api/tests/unit/errors.test.ts`, `products-serializer.test.ts` (new).
- `api/tests/integration/products-schema.test.ts` (new, 22 tests).
- `apps/mobile/local-packages/@expyrico/shared/dist/**` — resynced from clean build.
- `apps/mobile/src/tests/shared-contract.test.ts` (new).
- `pnpm-lock.yaml`.

### Necessary out-of-scope fixes (regressions my contract change caused)
- `api/tests/helpers/setup.ts` — truncate list was missing the 3 new tables (would
  have broken test isolation for every future phase's tests); re-seed for
  `product_creation` setting (truncated every test, only system user was re-seeded).
- `api/src/services/products/search.ts` — raw `$queryRaw` had an explicit column list
  predating `description`/`version`/`moderationNotes`; broke response validation.
- `api/src/routes/admin/products/pending.ts` — hand-built item shape predating the
  same 4 new `adminProductEditRowSchema` fields; broke response validation.

Both `search.ts` (Phase 2-owned) and `pending.ts` (Phase 4-owned) got the minimal
mechanical fix only (add the missing fields) — no feature work, so their owning
phases' larger rewrites aren't preempted.

## Tasks Completed
- [x] Task 1: real shared-schema test gate (vitest, 51 tests, RED→GREEN).
- [x] Task 2: structured `version_conflict`/media error codes end to end, redaction
      proven via `JSON.stringify` on `toProblem()` output.
- [x] Task 3: expand/classify DB model — adopted, reconciled, verified (22 tests
      incl. concurrent-insert race, upgrade fixture via scratch-DB pre-A→post-A
      replay, migration B tested in rolled-back transactions).
- [x] Task 4: serializer redaction (6 tests) + fixed 2 broken response-validation
      regressions.
- [x] Task 5: shared build → mobile vendor sync → `pnpm install` → import assertion.
      **Discovered**: `pnpm install`/`--force` does NOT refresh a `file:` dependency's
      `node_modules` copy when only its content changes (no version bump) — had to
      manually delete `apps/mobile/node_modules/@expyrico/shared` before reinstalling.
      Future phases refreshing the vendored copy need to do the same.
- [x] Task 6: commit boundary — `.env.test` explicitly excluded from staging per
      team-lead instruction; pre-existing dirty root files untouched.

## Tests Status
- Shared: `pnpm --dir packages/shared test` → 51/51 pass. Typecheck clean.
- API: `pnpm --dir api test` (full suite) → 431/431 pass. Typecheck clean.
- Mobile: `pnpm --dir apps/mobile test -- shared-contract` → 5/5 pass.
- `git diff --check` clean; migration/test files scanned for secrets/abs-paths, none
  found.

## Success Criteria (from phase file)
- [x] Shared tests real, not `echo skip`.
- [x] All outcome/error/status names representable and consistent.
- [x] DB enforces position/XOR/retained-photo/outbox/one-open-edit invariants
      (proven with direct constraint-violation tests, not just schema reading).
- [x] Legacy report-hidden products classified separately from creator submissions
      (migration B gated, untested-by-deploy, preflight-guarded).
- [x] Photo/revision models cover every approved field + retained/staged order.
- [x] Public DTOs never expose storage keys/uploader/moderation internals (serializer
      test asserts on serialized JSON).
- [x] Existing rows survive migration (upgrade-fixture scratch-DB replay); shared/API/
      mobile contract gates pass.

## Issues / Deviations
- DB/git drift required team-lead approval before proceeding (documented above).
- `productPhotoSchema`/`productDraftRowSchema.cover` fields use `.string().min(1)`
  route paths, not `.url()` — Phase 1 has no base-URL config (Phase 3/7 own that);
  "authorized route" language in the spec matches a relative-path design better than
  a fabricated absolute URL. Flagging in case Phase 3 expects absolute URLs instead.
- `adminProductEditResolveSchema.decision` renamed `reject`→`request_changes` per
  phase-01's explicit requirement; `rebase`/`supersede` intentionally left to Phase 4
  (`recoverProductEdit`), not added here.
- Did not touch `adminProductRowSchema`'s other fields, admin photo DTOs, or any
  Phase 2–8 route/service files beyond the two minimal regression fixes above.

## Next Steps
- Phase 2 depends on this; its owner should read the DB/git-drift note above before
  running any `prisma migrate` command, and must remember `.env.test`'s `DATABASE_URL`
  is not committed — set it locally to `pantry_test` (or their own isolated DB) before
  running API integration tests.
- Phase 3+ should confirm whether `thumbnailUrl`/`displayUrl` should be absolute URLs
  (would need new API base-URL config) or the relative-route design used here.

Status: DONE
Summary: Phase 1 complete — adopted and reconciled a pre-existing but git-orphaned DB schema (team-lead approved), implemented shared contracts, serializer, and migration/schema tests; 431 api + 51 shared + 5 mobile tests green, typecheck clean, committed.
Concerns/Blockers: Migration B sits in the migrations folder unapplied — any future `prisma migrate deploy/dev` against a migration-A-applied DB will also apply it; Phase 2-8 devs must check pending migrations first. `.env.test`'s committed DATABASE_URL still points at shared "pantry", not pantry_test — each dev must repoint their own local copy.

---

## Remediation — reviewer-p1 findings (task #9, 260730)

Full review: `reports/reviewer-p1-260730-phase-01-review.md`. Fixed all items team-lead
assigned (1 CRITICAL, 5 IMPORTANT, item 6 of the MODERATE list); item 7 (compatibility
reader) explicitly deferred to Phase 2 per team-lead.

### 1+2. Admin reject broken (CRITICAL) + wrong-state write (IMPORTANT)
- `api/src/routes/admin/products/pending-resolve.ts`: `request_changes` now writes
  `changes_required` (never `rejected`) and persists to the new `moderationNotes`
  column instead of the legacy `notes` column.
- `packages/shared/src/schemas/admin/products.ts`: exported
  `AdminProductEditResolveInput`/`AdminProductEditResolveDecision`, inferred from the
  schema, so admin call sites can't silently drift from a future rename again.
- `apps/admin/src/lib/admin-api.ts`, `apps/admin/src/lib/actions.ts`: typed against
  the inferred decision instead of a hand-written `'approve' | 'reject'` literal union.
- `apps/admin/src/app/(admin)/products/pending/pending-actions.tsx`: "Reject" button
  replaced with a "Request Changes" flow requiring a non-empty reason (inline input,
  not a full moderation UI — Phase 6 owns that). Admin app typecheck clean.
- New API tests: `request_changes` writes `changes_required` + persists notes without
  applying the proposal; `request_changes` without notes -> 400; legacy `reject` -> 400.

### 3. `moderationFeedback` public DTO leak (IMPORTANT)
- Removed `moderationFeedback` from the public `productSchema` entirely (was leaking
  through `get`/`lookup`/`search`/`create` and `problemSchema.canonicalProduct`).
  `productDraftRowSchema` (creator-only) is unaffected. Any further single-product
  creator-scoped surface is Phase 4's to add explicitly, not inherited implicitly.
- `serializer.ts` no longer maps `moderationNotes` into the response at all.
- New tests proving the field is absent even when the DB value is populated, on both
  the shared-schema side (stray-key stripping) and the serializer side (`toApiProduct`
  + `JSON.stringify` never contains the internal note text).

### 4. Patch-schema description nulling (IMPORTANT)
- Split `productDescriptionSchema` into `productDescriptionValueSchema` (required
  value: `string | null`, no `.optional()` baked in) and compose
  `.optional()` at the call site (`productDraftPatchRequestSchema.description`).
  `ZodOptional` short-circuits on `undefined` without invoking the inner transform, so
  an omitted key now stays omitted; explicit `null` still clears; `{}` is a true no-op.
- Tests: omitted key, explicit null, empty payload, plus the value-schema no longer
  silently accepting `undefined` on its own.
- Landed before dev-2's in-flight Phase 2 draft-patch handler needed it, per team-lead.

### 5. `is_legacy` fail-open (IMPORTANT)
- Per team-lead: kept the DB default `true` (exists for historical-row exemption; a
  later Phase-4 migration can flip it once every writer is confirmed explicit).
- Fixed the one live writer, `api/src/routes/products/patch.ts`, to set
  `isLegacy: false` explicitly and translate the resulting P2002 into a typed 409.
- New tests: the created edit is `isLegacy: false`; two concurrent PATCH requests from
  the same caller against the same product resolve to exactly one 202 + one 409 via
  the real HTTP route (not a raw-Prisma fixture with `isLegacy` pre-set).

### 6. Migration B preflight gaps (IMPORTANT)
- Extended the `DO` block in `20260730040000_classify_report_hidden_products` to abort
  on: `product_creation.mode != 'off'`, any candidate row with a moderation marker
  (`moderated_at`/`moderated_by_user_id`), `version > 1`, any `product_photos` row, or
  any non-legacy `product_edits` row — every precondition from phase-01 line 166 that
  is actually DB-checkable. Deployed-writer state and rollout-mode *history* remain
  operator responsibilities (documented in the file's header comment).
- 6 new abort-case tests + 1 case proving a *legacy* `product_edits` row does not
  trip the new check. All still exercised only inside rolled-back transactions.

### 7. Photo reorder constraint (MODERATE, decided now)
- New migration `20260730044500_make_photo_position_deferrable`: both
  `UNIQUE(product_id, position)` (product_photos) and
  `UNIQUE(product_edit_id, position)` (product_edit_photos) are now
  `DEFERRABLE INITIALLY IMMEDIATE`. Postgres only supports `ALTER TABLE ... ALTER
  CONSTRAINT` for foreign keys, so this drops and re-adds each constraint (no FK
  references either one, so nothing else is affected).
- `serializer.ts`: `toApiProduct` now sorts `photos` by `position` before mapping —
  Prisma's `include` has no default order, and position 0 = cover is contractual.
- Applied to `pantry` and `pantry_test` manually via psql + `prisma migrate resolve
  --applied` (never `migrate deploy`), matching the original reconciliation pattern.
  Verified `migrate deploy` reports nothing pending (except migration B), `validate`
  passes, `migrate diff` against `schema.prisma` is empty on both.
- New tests: a two-statement swap fails immediately without deferral, succeeds once
  `SET CONSTRAINTS ... DEFERRED`; serializer sort test with photos loaded out of order.
- Upgrade-fixture scratch-DB replay updated to apply this migration after A1+A2 too.

### Incident during verification (self-reported, zero data impact)
While sanity-checking pending-migration state for item 7, I ran `prisma migrate
deploy` against `pantry` instead of `migrate status` — it silently applied migration B
for real (violating "migration B must stay unapplied"). Verified impact immediately:
`pantry` had exactly 3 products, all `active`, `updated_at` timestamps days old — the
classify `UPDATE` matched zero rows. `pantry_test` was untouched (never ran `deploy`
there). Remediation: deleted migration B's `_prisma_migrations` row on `pantry`,
restoring "unapplied" bookkeeping (safe since the UPDATE was a genuine no-op — nothing
to functionally revert). Verified via `prisma migrate status`: migration B shows "not
yet been applied" again. Reported to team-lead immediately with full details.

### Coordination note
Phase 2 (dev-2) landed `routes/products/{drafts,draft-update,submit,lookup-v2}.ts`,
`services/products/{product-drafts,product-visibility}.ts`, and touched
`services/products/lookup.ts` concurrently in the same tree. Verified
`api/prisma/schema.prisma` had zero overlapping edits before staging (diff showed only
my two DEFERRABLE doc-comments). Did not stage or touch any file from dev-2's list.
Full-suite `pnpm --dir api test` runs showed different, non-reproducing failures each
run (households, admin/users, product-use-authorization) — confirmed via isolated
per-file runs that every file *I* touched passes cleanly on its own; the flakiness is
cross-process interference from both of us running full suites against the same
shared `pantry_test` Postgres instance concurrently, not a regression in this fix.

### Tests status (final)
- Shared: 57/57 pass, typecheck clean.
- API (my touched files, isolated + combined): 58/58 pass
  (`errors.test.ts`, `products-serializer.test.ts`, `products-schema.test.ts` [29],
  `admin/products.test.ts` [10], `products-patch.test.ts` [5]). Full-suite run has
  unrelated cross-process flakiness noted above.
- Admin app: typecheck clean.
- Mobile: `shared-contract` 5/5 pass after vendored-copy resync.

Status: DONE
Summary: All CRITICAL/IMPORTANT findings fixed plus the decided reorder-constraint MODERATE item; self-reported and remediated one migrate-deploy incident with verified zero data impact; all touched-file tests green, typecheck clean across shared/api/admin/mobile.
Concerns/Blockers: none outstanding for this task. Compatibility-reader gap (item 7 of reviewer's IMPORTANT/MODERATE split) remains Phase 2's to close per team-lead. `is_legacy` DB default stays `true` by team-lead decision — Phase 4 should revisit once every writer is confirmed explicit.

---

## Addendum — structural fix for the migrate-deploy incident (260730, same task)

The procedural-comment-only gate around migration B was proven insufficient by the
incident above: it got applied by accident within minutes of the warning being
written, during an unrelated pending-state check. Team-lead directed closing the hole
structurally rather than relying on operator discipline alone.

- Moved the migration from `api/prisma/migrations/20260730040000_.../` to
  `api/prisma/deferred-migrations/20260730040000_.../` via `git mv`. Prisma only scans
  `api/prisma/migrations/` for `migrate deploy`/`migrate dev`, so it is now physically
  unable to apply this file early — confirmed empirically: `prisma migrate status`
  against both `pantry` and `pantry_test` now reports "22 migrations found" / "Database
  schema is up to date!" (previously listed migration B as pending, and it's how the
  incident happened in the first place).
- Added `README.md` alongside the migration: full precondition list, why the file
  lives outside the auto-apply path, and Phase 8's exact execution procedure (move
  back into `migrations/`, review, apply via manual `psql` + `prisma migrate resolve
  --applied` — explicitly not `migrate deploy`, since that would also apply whatever
  else has landed in `migrations/` by then in an unreviewed order).
- Trimmed the migration's own header comment to point at the README instead of
  duplicating the procedure in two places.
- `api/tests/integration/products-schema.test.ts`: added `DEFERRED_MIGRATIONS_DIR` +
  `readDeferredMigrationSql`, repointed all 8 migration-B test call sites at it. Still
  exercised only inside rolled-back transactions — nothing about test behavior changed,
  only where the SQL is read from.
- Re-verified: 29/29 `products-schema.test.ts` tests still pass; `prisma migrate
  status` on both DBs confirms migration B is invisible to Prisma tooling; `prisma
  validate` still passes; api typecheck clean.

New evidence (the incident itself) justified this deviation from the original plan
(which only specified "new unapplied file" without specifying *where*); documenting
per team-lead's instruction.

---

## Remediation round 2 (task #10) — reviewer-p1 re-verification findings

reviewer-p1 confirmed all 7 round-1 items CLOSED, but found 2 new IMPORTANT + 2
MODERATE issues introduced by the remediation itself. Fixed all 5 per team-lead's
decisions:

### 1. Creator dead-end after request_changes (IMPORTANT — new)
Round 1's `isLegacy: false` fix meant the partial unique index now genuinely blocked
a second open edit — including the creator's own resubmission after an admin
requested changes, since `changes_required` counts as "open". `patch.ts` only ever
created new rows, so after one `request_changes`, the creator's next `PATCH` 409'd
forever with no route to recover (admin couldn't re-resolve it either — `pending.ts`
only lists `status: 'pending'`).

Fixed: `patch.ts` now looks for an existing open edit (`draft|changes_required`) by
the same submitter for the product; if found, updates it in place (new `proposed`,
`status: 'pending'`, `moderationNotes: null`) instead of creating a second row. A
`pending` edit is untouched — that 409 is correct (genuinely under review, not a dead
end; the admin resolving it frees the slot). New tests: sequential (non-racing) second
patch against a `pending` edit still 409s; full loop patch → admin request_changes →
patch again → 202, single row updated in place, visible in the pending queue again,
approvable.

### 2. DEFERRABLE constraints break upsert/ON CONFLICT (IMPORTANT — new, documentation)
Verified as a real, unavoidable trade-off of round 1's deferrable-constraint fix (not
a bug to revert): PostgreSQL refuses a deferrable unique constraint as an `ON CONFLICT`
arbiter (SQLSTATE `55000`), and Prisma's `.upsert(...)` on `ProductPhoto`/
`ProductEditPhoto` fails the same way with an unclassifiable `err.code === undefined`
— it will not match the `P2002` handling pattern used everywhere else in this
codebase. Documented in
`plans/.../phase-03-product-media-pipeline-and-vps-delivery.md`: a Requirements bullet
citing the reviewer's SQLSTATE/error-shape probe, plus a pointed reminder inside Task
3's reorder implementation step (where the code will actually get written) that photo
position writes must use explicit find-then-create/update + `SET CONSTRAINTS ...
DEFERRED`, never `upsert`/`ON CONFLICT` on `(product_id, position)` /
`(product_edit_id, position)`.

### 3. Uncommitted corrected migration-B header (MODERATE — new)
The committed `d929a56` header still said "Phase 8 owns running `prisma migrate
deploy`" — the exact instruction class that caused the original incident — while the
README committed alongside it said the opposite. The corrected header (pointing at the
README instead of duplicating instructions) was sitting as an uncommitted working-tree
edit. Included in this task's commit.

### 4. Request Changes button used Alert Red (MODERATE — new)
`variant="destructive"` on a resumable, non-destructive action violates
`docs/design-guidelines.md` ("Alert Red — destructive-only"). Added a proper `accent`
variant to the shared `Button` primitive (`bg-accent text-accent-foreground`, using the
same theme tokens the `Badge` "expiring" variant already uses) rather than reusing
`outline` — team-lead specifically asked for the theme's non-destructive emphasis
color, not neutral. `pending-actions.tsx` now uses `variant="accent"`.

### 5. `is_legacy` DEFAULT (residual, done now per team-lead)
New migration `20260730052600_default_product_edits_is_legacy_false`:
`ALTER TABLE product_edits ALTER COLUMN is_legacy SET DEFAULT false`. Applied to both
`pantry` and `pantry_test` via manual `psql` + `prisma migrate resolve --applied`
(checked pending state with **`migrate status`**, never `deploy`, per the standing
rule). Verified via `information_schema.columns` on both DBs: `column_default =
'false'`. `schema.prisma`'s `@default(true)` → `@default(false)`; Prisma client
regenerated. New test: a writer that omits `isLegacy` entirely now gets `false` and a
second such insert for the same product/submitter fails closed — proves the fail-open
trap the original review flagged is gone for *any* future writer, not just the ones
I've made explicit.

### Test verification (new DB-per-agent rule)
`flock` proved insufficient in practice (another process doesn't take the lock it
doesn't know about). Per team-lead's replacement rule, provisioned a private scratch
database the same way `products-schema.test.ts`'s upgrade fixture does: `CREATE
DATABASE`, `pg_trgm` extension, `psql -f` over all 23 migration files in sort order,
`prisma migrate resolve --applied` for each to reconcile bookkeeping, ran the full
suite via `TEST_DATABASE_URL` override, then dropped it.

- Full api suite, isolated DB: **561/561 pass** (was 555/558 pass + 3 shared-Redis
  flakes at reviewer's last check; no attribution ambiguity now, includes Phase 2/3
  in-flight code from other agents).
- `products-schema.test.ts`: 30/30 (29 + 1 new is_legacy-default test).
- `products-patch.test.ts`: 7/7 (5 + 2 new resubmit/dead-end tests).
- Typecheck: api / packages/shared / apps/admin all clean.
- `prisma migrate status` (read-only) on both `pantry` and `pantry_test`: "23
  migrations found... Database schema is up to date!" after applying/resolving the new
  migration — confirms no dangling/missing record on either DB.

Status: DONE
Summary: Fixed both new IMPORTANT regressions (creator dead-end, documented the upsert/DEFERRABLE trade-off) plus both new MODERATE items (committed the corrected header, non-destructive button color) plus the is_legacy default residual; verified on a fully isolated scratch database per the new team test-DB rule — 561/561 api tests, typecheck clean across api/shared/admin.
Concerns/Blockers: none. Phase 3 must respect the upsert/ON CONFLICT prohibition now documented in its phase file when it builds photo insert/reorder services.
