# ProductEdit Resubmission Hardening (task #13)

## Executed
- Task: #13, two MODERATEs from reviewer-p1's `ced0e72` re-verification
- Status: completed
- File touched: `api/src/routes/products/patch.ts`, `api/tests/integration/products-patch.test.ts`

## Fix 1 — read-then-write race guard

The resubmit-in-place branch (`ced0e72`) did `findFirst` then `update({where:{id}})` with
no predicate re-check at write time. Two concurrent resubmissions of the same edit could
both "succeed", the second silently dropping the first's proposal; once Phase 4 ships
rebase/supersede, a stale resubmit could also resurrect an edit an admin just moved out
of `draft|changes_required`.

Changed to `updateMany({ where: { id, submittedBy, status: { in: ['draft',
'changes_required'] } }, data: {...} })`, checking `result.count === 0` for the 409
path instead of trusting the earlier read. Postgres serializes this correctly under
concurrency: the second concurrent `updateMany` blocks on the row lock, then re-evaluates
its `WHERE` against the first transaction's committed result — by then `status` is
`pending`, so the predicate no longer matches and `count` is `0`.

Test: two concurrent resubmissions of the same `changes_required` edit resolve to
exactly one `202` + one `409`; exactly one `ProductEdit` row, status `pending`.

## Fix 2 — refresh moderation metadata on resubmit (team-lead's ruling)

Resubmission is a fresh submission, not a continuation. The `updateMany` now also sets:
- `submittedAt: new Date()`
- `resolvedBy: null`, `resolvedAt: null` (clearing the previous admin's resolution stamp)
- `baseProductVersion: product.version` — the version already read and validated
  against **in this same request** (not re-queried), per team-lead's explicit ruling
  that this must reflect what the proposal was actually authored against, not silently
  drift to "whatever the product happens to be at" if that ever diverges from what was
  checked earlier in the handler.

`moderationNotes: null` was already cleared by `ced0e72`; unchanged here.

Test: after `request_changes` (which sets `resolvedBy`/`resolvedAt`) and a subsequent
product version bump (simulating an admin correction between rounds), resubmitting
clears `resolvedBy`/`resolvedAt`, sets a fresh `submittedAt`, and stamps
`baseProductVersion` with the product's version at resubmit time (5, not the stale 1).

## Scope note

Reviewer-p1 flagged that the CREATE path (first-ever submission) has the same latent
gap — `submittedAt` stays `null`, `baseProductVersion` stays the DB default `1` — but
explicitly noted that predates this commit; it is not one of the two MODERATEs and
team-lead's ruling was scoped to "resubmission is a fresh submission." Left the create
branch untouched to stay surgical. Phase 4 (which owns `createOrResumeProductEdit` per
its Produced Interfaces, i.e. the real replacement for this legacy write path) is the
natural place to fix the create-path gap comprehensively — flagging here so it isn't
lost.

## Verification
- `products-patch.test.ts`: 9/9 (7 previous + 2 new).
- `pnpm --dir api typecheck`: `patch.ts` itself reports zero errors. Full `tsc --noEmit`
  currently fails in `services/products/lookup.ts` — confirmed via `git status` that
  file is unmodified by me; the failure traces to dev-2's concurrent, uncommitted
  `packages/shared/product.ts` schema changes (task #12, still in flight). Not caused
  by, or related to, this change.
- Coordinated with dev-2 before editing: they were about to add an authorization gate
  to the same file (task #12, IMPORTANT-4) above the `existingOpenEdit` logic this task
  touches. Confirmed no overlap, asked them to hold until this commit landed to avoid
  a working-tree collision.

Status: DONE
Summary: Hardened the resubmission-in-place write with a status-guarded updateMany (count===0 -> 409) instead of a naive read-then-write, and refreshed submittedAt/resolvedBy/resolvedAt/baseProductVersion on resubmit per team-lead's "fresh submission" ruling; both with dedicated tests.
Concerns/Blockers: none for this task. Noted the pre-existing, out-of-scope create-path metadata gap for Phase 4's attention. Full-suite typecheck currently blocked by dev-2's in-flight task #12 work, unrelated to this change.
