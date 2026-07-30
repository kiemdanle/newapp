# Test Infra Fix — env-load ordering quirk (task #11)

## Executed
- Task: #11, "Fix test-infra env-load ordering quirk (spurious 401s)"
- Status: completed

## Root cause (confirmed, not just diagnosed)

`tests/helpers/setup.ts` statically imports `../../src/db.js` and `../../src/redis.js`
at the top of the file. Per ES module semantics, a module's static imports are fully
evaluated *before* that module's own top-level code runs — so `db.js` (which imports
`logger.js`, which eagerly calls `getConfig()` at module-evaluation time to pick a pino
log level) always ran before setup.ts's own `.env.test`-loading loop, regardless of
where that loop was placed in the file.

Separately, Vite/Vitest auto-loads `.env` (not `.env.test`) into `process.env` during
its own startup, before any setupFile runs, because nothing in this repo pins
Vitest/Vite's `mode` to `test`. By the time `logger.ts`'s eager call ran, every
required env var already had a valid-looking value from `api/.env` (the dev file, not
`.env.test`) — so `getConfig()` didn't throw; it successfully cached the **wrong** (dev)
config permanently for that module instance. `config.ts`'s cache never re-parses once
successfully populated, so setup.ts's later, correct overwrite of `process.env` with
`.env.test` values came too late to matter for that already-cached instance.

The bug was invisible in every full-suite run: `process.env` is a real mutable global
that survives across test files even when Vitest gives each file a fresh module
registry, so any earlier file's setupFiles execution had already primed it correctly
before a later file's own eager consumers ran. It only surfaced when a
`vi.doMock(...)` + `vi.resetModules()` file was the first (or only) file in the whole
process: the *original* module graph (used by anything statically imported at the top
of that test file, e.g. `issueAccessToken`) kept the poisoned dev secret, while the
*freshly re-imported* graph (built via `await import(...)` after `resetModules()`)
picked up a brand-new, correctly-primed config instance — two different secrets in the
same test, so a token signed by one never verified against the other. Confirmed via a
direct before/after comparison: `getConfig().jwt.accessSecret` before `resetModules()`
was `api/.env`'s `change-me-32-bytes-minimum-aaaaaaa`; after, `.env.test`'s
`test-secret-32-bytes-aaaaaaaaaaa`.

## Fix

- New `api/tests/helpers/env.ts`: pure env-loading logic (moved out of `setup.ts`),
  deliberately **zero other imports** so nothing can call `getConfig()` before it runs.
- `api/tests/helpers/setup.ts`: env-loading code removed (now lives in `env.ts`); kept
  its DB/Redis lifecycle hooks.
- `api/vitest.config.ts`: `setupFiles: ['./tests/helpers/env.ts',
  './tests/helpers/setup.ts']` — `env.ts` first, guaranteeing `process.env` is correct
  before `setup.ts`'s static imports (and their eager consumers) ever evaluate.

## Regression tests

- `api/tests/integration/env-load-order-repro.test.ts`: minimal, DB-free fixture.
  Statically imports `getConfig`, then does the exact `vi.resetModules()` +
  dynamic-reimport dance, asserting both instances agree and match the literal
  `.env.test` value (not the dev fallback). Runs in-suite too (fast, harmless).
- `api/tests/integration/env-load-order.test.ts`: spawns `vitest run
  tests/integration/env-load-order-repro.test.ts` as a genuinely fresh child process
  — the only way to prove the "alone/first in the process" condition that caused the
  original bug, since an in-suite run of the repro file isn't running alone by
  definition.
- **Sanity-checked both directions**: temporarily reordered `setupFiles` back to
  `[setup.ts, env.ts]` (wrong order) — the repro test failed with exactly the expected
  value mismatch (`test-secret...` expected, `change-me...` received), proving the test
  is a real regression guard, not a tautology. Restored the correct order, verified
  green again.

## Verification

- Originally-reported repro file (`tests/integration/products-lookup.test.ts`) run
  alone: was 10/19 passing (9 spurious 401s) before the fix, **19/19 passing** after.
- `src/services/products/lookup.test.ts` (unit, same `vi.doMock` pattern) run alone:
  27/27 passing.
- `tests/integration/products-draft-lifecycle.test.ts` (same pattern) run alone:
  23/23 passing.
- New regression tests: 2/2 passing (both in-suite and the nested-process case).
- `pnpm --dir api typecheck`: clean.
- Did not run a full-suite verification for this task: Phase 3's concurrent,
  uncommitted `config.ts` work (new required `MEDIA_ROOT`/`MEDIA_PUBLIC_BASE_URL`) was
  mid-edit on shared `api/.env.test` during part of this investigation, causing
  unrelated transient failures across the whole suite; confirmed those clear up on
  their own once that file settles (re-ran the same "unrelated" failures moments later
  and they passed). Not a regression from this fix — did not touch `config.ts`,
  `.env.test`, or anything Phase-3-owned.

## Scope discipline
Touched only test-infra files: `tests/helpers/{env,setup}.ts`, `vitest.config.ts`, and
two new regression test files. No production source (`src/`) changed. No refactor
beyond the ordering fix.

Status: DONE
Summary: Root-caused and fixed a real ESM-module-evaluation-order bug (not the shared-DB/Redis contention that's a separate, already-known issue) causing spurious 401s when certain mocked test files run alone/first; added a regression test that spawns an isolated child process to prove it, sanity-checked the test actually catches the bug.
Concerns/Blockers: none. Unrelated Phase 3 config changes were mid-flight on shared `.env.test` during verification — noted above, not a defect in this fix.
