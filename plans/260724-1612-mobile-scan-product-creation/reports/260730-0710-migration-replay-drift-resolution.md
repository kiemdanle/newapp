# Migration-Replay Drift Resolution Report

## Task
- Task: #14, "Resolve migration-replay drift on older tables"
- Source: dev-3's Phase 3 report, "Second Finding: Pre-existing DB/migration-file
  drift" (`260730-0625-phase-03-product-media-pipeline-and-vps-delivery.md`)
- Commit: `89bccae fix(db): reconcile legacy table conventions for clean
  migration replay`

## Addendum: pantry_test reconciled for real (team-lead authorized)
After reporting the flag below, team-lead explicitly lifted the no-touch
constraint for `pantry_test` only, for this one migration, since it genuinely
has the drift (an honest "pending" beats a faked "clean"). Applied for real:
1. `prisma migrate status` against `pantry_test` — confirmed **only**
   `20260730070000_reconcile_legacy_table_conventions` pending (precondition
   satisfied; deferred classify migration correctly absent from
   `api/prisma/migrations/`, nothing else pending).
2. `prisma migrate deploy` against `pantry_test` — applied successfully.
3. Verified after: `prisma migrate status` → "Database schema is up to date!";
   `prisma migrate diff --from-url <pantry_test> --to-schema-datamodel
   schema.prisma` → empty.
4. Re-confirmed `pantry` unaffected: still empty diff, still "up to date"
   (untouched by this step).
5. Ran a narrow sanity check against `pantry_test` with the real connection
   string via `TEST_DATABASE_URL` override (health + product-get integration
   tests) — both pass. (Note: running with no override at all correctly
   fails closed with an auth error against the tracked placeholder credential
   from the earlier `.env.test` fix — expected, not a regression.)

Both `pantry` and `pantry_test` are now genuinely clean and diff-empty against
`schema.prisma`. No further pantry_test flag outstanding.

## Investigation
Provisioned my own throwaway DB (`pantry_dev2_mig`), replayed all 23 existing
`api/prisma/migrations/*/migration.sql` files via `psql -f` in order, then ran
`prisma migrate diff --from-url <scratch> --to-schema-datamodel schema.prisma
--script` to get the exact corrective SQL (not just a description). Confirmed
independently:
- Live `pantry`: diffs **empty** against `schema.prisma` (read-only diff only,
  never applied).
- `pantry_test`: diffs **non-empty** — 235 lines, identical in shape to the
  scratch DB. This is new information beyond what the task assumed (see
  "pantry_test" section below).

Root cause: six pre-Phase-1 migrations (`m8_household_sharing`,
`deals_and_deal_votes`, `giveaways`, `referrals`,
`m3_admin_tables`/`api_errors_camelcase_created_at`,
`review_rating_enum`) were hand-authored raw SQL instead of generated via
`prisma migrate dev`, and used different conventions than what `schema.prisma`
(and, evidently, the live DB) actually converged to:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` — a DB-level default; every
  Prisma-generated migration in this repo instead emits `id UUID NOT NULL`
  with no default (Prisma Client generates `@default(uuid())` values
  client-side), so these tables' columns needed `DROP DEFAULT`.
- `TIMESTAMPTZ` where the datamodel's plain `DateTime` maps to `TIMESTAMP(3)`.
- `reviews.rating ... DEFAULT 'buy_again'` — a convenience default the
  migration's own backfill statement needed; `schema.prisma` never declared
  one and the app always supplies `rating` explicitly.
- A handful of indexes/FK constraint names that never matched their current
  `@@index`/relation declarations (Prisma names these deterministically from
  the datamodel; hand-written SQL used shorter names).
- `ThemePreference` enum still carries a legacy `'aurora'` value that
  `schema.prisma` never included; nothing ever ran the type-rebuild Postgres
  requires to actually remove an enum label (`ALTER TYPE ... DROP VALUE`
  doesn't exist).

## Fix
New migration `20260730070000_reconcile_legacy_table_conventions`:
- Rebuilds `ThemePreference` without `'aurora'` (guarded: only runs if the
  label still exists; preflight `RAISE EXCEPTION` if any row still references
  it — none do, migration `20260703081600` already converted them).
- Drops the FKs that must be recreated once their referenced/referencing
  columns change type (`DROP CONSTRAINT IF EXISTS`), aligns
  `id`/timestamp columns, drops `reviews.rating`'s default, adds the 5 missing
  indexes (`CREATE INDEX IF NOT EXISTS`), recreates the FKs (guarded via
  `pg_constraint` existence checks), and renames indexes to their current
  names (guarded: only when the old name exists and the new one doesn't).
- Every statement is idempotent/no-op-safe on a database already in the
  target shape: `DROP DEFAULT`/`SET DATA TYPE` on an already-correct column
  are harmless no-ops in Postgres; every constraint/index/enum change has an
  explicit existence guard.

## Verification
- Applied the new migration to the already-replayed scratch DB → `prisma
  migrate diff` against `schema.prisma` = **empty**.
- Re-ran the same migration file a second time against the now-corrected DB →
  succeeded with no errors (expected "already exists, skipping" notices for
  the `IF NOT EXISTS` indexes) → diff still empty. Proves real idempotency,
  not just "written to look idempotent."
- Full fresh replay from scratch (drop DB, recreate, `psql -f` all 24 files in
  order) → diff **empty**.
- Same fresh DB via the real tool (`prisma migrate deploy`, not manual
  `psql -f`) → "All migrations have been successfully applied", `prisma
  migrate status` → "Database schema is up to date!", `prisma validate` →
  passes, diff → empty.
- Full API suite against that `migrate deploy`-created DB: **101 files, 726
  tests, all pass**.
- `pantry` (live): registered the new migration via `prisma migrate resolve
  --applied` (bookkeeping only — confirmed via a before/after `migrate
  status` that this made zero schema changes: the datamodel diff against
  `pantry` was empty before and remains empty after). `prisma migrate status`
  now reports "Database schema is up to date!" on `pantry`.
- Dropped both throwaway scratch databases when done.

## `pantry_test` — initially flagged, then fixed for real (team-lead authorized)
Initially discovered `pantry_test` had the **same drift** as a fresh scratch
replay (235-line non-empty diff). Per the original explicit "must not be
touched" constraint I did not apply DDL or fake `resolve --applied` bookkeeping
there, and flagged it instead of acting unilaterally (see Addendum above for
the resolution: team-lead authorized a real `prisma migrate deploy`, applied,
verified clean/empty-diff). No outstanding flag remains.

## Tests
- No test-suite changes were needed or made — this is a migration-files-only
  fix, verified via full-suite runs against the reconciled scratch DB (above)
  and a narrow sanity check (health + product-get) against the now-reconciled
  `pantry_test`.
- `deferred-migrations/` untouched; migration B still unapplied/uninvolved.

## Issues / Deviations
- None from the assigned scope. Surfaced new evidence (pantry_test's actual
  drift) rather than acting on it unilaterally against the original
  constraint; team-lead reviewed and authorized the real fix, which is now
  applied and verified (see Addendum).

Status: DONE
Summary: Added a guarded, idempotent migration reconciling 6 pre-Phase-1 hand-authored tables' id-default/timestamp-precision/index/FK-name/ThemePreference-enum drift; fresh scratch-DB replay (both manual psql and real `prisma migrate deploy`) now diffs empty against schema.prisma, full suite green (726/726) against the reconciled DB. Both `pantry` (bookkeeping-only `resolve --applied`, zero DDL) and `pantry_test` (real `prisma migrate deploy`, team-lead authorized) are now clean/empty-diff. Both throwaway scratch DBs dropped.
Concerns/Blockers: None outstanding.
