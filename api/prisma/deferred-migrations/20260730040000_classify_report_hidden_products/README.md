# Deferred migration: classify report-hidden products

This migration lives outside `api/prisma/migrations/` on purpose. Prisma's
`migrate deploy`/`migrate dev` apply every migration found under
`api/prisma/migrations/` in sorted order — there is no built-in way to tell
Prisma "skip this one until later." A purely procedural warning comment was
tried first (see the migration's own header) and still got applied by
accident within the same session that wrote the warning, while sanity-checking
unrelated pending-migration state. Moving the file out of the auto-apply path
closes that hole structurally instead of relying on operator discipline alone.

## Why this migration is gated

`UPDATE products SET status = 'report_hidden' WHERE status = 'pending'`
classifies every remaining legacy report-hidden `pending` row. This is only
safe once:

1. Migration A (`expand_product_drafts_photos_and_moderation`) and Phase 1's
   compatibility readers are fully deployed, and every pre-compatibility API
   instance has drained.
2. Phase 2's active-only legacy lookup and `report_hidden` report writers are
   fully deployed — no deployed report writer still emits legacy `pending`.
3. `product_creation.mode` has stayed `off` continuously since before
   migration A, so no row with `status = 'pending'` can be a creator
   submission.

Running it before all three hold would reclassify creator-submitted drafts as
report-hidden, silently disappearing them from their creator's draft list
with no audit trail. The migration's own `DO` block preflight-checks every
piece of this that is DB-checkable (current `product_creation.mode`, and
per-row lifecycle/activity markers); it cannot verify deployed-writer state
or rollout-mode *history*, which is why the file stays out of the automatic
path rather than relying on the preflight alone.

## Phase 8's execution procedure

1. Confirm preconditions 1–3 above against the actual deployed fleet (not
   just this repo).
2. Move this directory back into `api/prisma/migrations/`
   (`git mv api/prisma/deferred-migrations/20260730040000_classify_report_hidden_products api/prisma/migrations/20260730040000_classify_report_hidden_products`).
3. Review the migration SQL one more time in place.
4. Apply it the same way every other migration in this repo has been
   reconciled after manual review: `psql <url> -f migration.sql` against the
   target database, then `prisma migrate resolve --applied
   20260730040000_classify_report_hidden_products` to record it — do not run
   `prisma migrate deploy`/`migrate dev` for this step, for the same reason
   the file was moved out of the auto-apply path in the first place: those
   commands would also try to apply any *other* migration that has landed in
   `api/prisma/migrations/` since this file was moved back, in whatever order
   they sort, which is not a reviewed sequence.
5. Verify zero remaining `products.status = 'pending'` rows with a
   `moderated_at`/`moderated_by_user_id`/`version > 1`/`product_photos`/
   non-legacy-`product_edits` marker were misclassified (the preflight should
   have already refused to run if any existed) before declaring the rollout
   step complete.

## Testing this migration before Phase 8

`api/tests/integration/products-schema.test.ts` reads this file directly from
`api/prisma/deferred-migrations/` and exercises it only inside rolled-back
Postgres transactions — it is never applied for real by the test suite.
