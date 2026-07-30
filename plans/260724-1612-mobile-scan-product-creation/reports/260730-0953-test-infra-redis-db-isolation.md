# Test-infra: per-run Redis DB isolation

Owner: dev-1. Filler task ahead of Phase 5, assigned to close the recurring
shared-Redis flake class (reviewer-p4's "N1") that hit at least 4 verification
runs: rate-limit / idempotency / media-capacity-reservation state bleeding
across concurrent agents all pointed at the same `redis://localhost:6379/15`.

## Change

Mirrors the existing `TEST_DATABASE_URL` override exactly, in the same file
(`api/tests/helpers/env.ts`) that already implements it:

- `TEST_REDIS_URL`, if set in the invoking shell, overwrites `process.env.REDIS_URL`
  after `.env.test` loads and before anything (`db.js` -> `logger.js` -> `getConfig()`)
  evaluates it. `getRedis()` (`api/src/redis.ts`) has exactly one call site that reads
  Redis config — `getConfig().redisUrl` — so this one override point is sufficient;
  no other module constructs a Redis client independently.
- Unset (default/CI/single-agent runs): behavior is unchanged, `.env.test`'s
  `REDIS_URL=redis://localhost:6379/15` still applies.
- `tests/helpers/setup.ts` already calls `getRedis().flushdb()` in its `beforeEach`
  (per-test, not just suite-start — stricter than the ask). No change needed there:
  once `REDIS_URL` is overridden, that flush already targets the agent's own DB
  instead of the shared one.
- Documented the override in both `api/.env.test` and `api/.env.test.example` with a
  comment directly above `REDIS_URL`, matching the existing `DATABASE_URL` comment's
  wording/placement.

## Usage

```sh
export TEST_DATABASE_URL="postgresql://pantry_app:<pw>@127.0.0.1:5432/<your_throwaway_db>?schema=public"
export TEST_REDIS_URL="redis://localhost:6379/<your_index>"
pnpm --dir api test
```

Pick any unused DB index (0-15 on a stock Redis config); no provisioning step is
needed since `flushdb` handles cleanup and Redis DBs exist implicitly.

## Verification

Provisioned a throwaway Postgres DB (`pantry_dev1_r22`, migrations applied, dropped
after) and pointed `TEST_REDIS_URL` at DB index 3 (confirmed empty beforehand via
`redis-cli -n 3 dbsize`). Ran `product-edits.test.ts` (27 tests),
`admin-product-moderation.test.ts` (21), `admin-product-merge.test.ts` (17) — 65/65
pass. `tsc --noEmit` clean.

Cross-contamination check: set a canary key in the shared `db15` with a 5-minute TTL
before the run. By the time the run finished, another concurrently-running agent's
own `beforeEach` had already flushed `db15` and wiped the canary — while `db3` (this
run's isolated DB) was untouched by anyone else throughout. That's the bug this task
fixes, caught live: on the shared index, an unrelated agent's per-test flush can
delete another agent's in-flight state at any moment; per-run isolation removes that
interference entirely.

## Scope

Touched only `api/tests/helpers/env.ts`, `api/.env.test`, `api/.env.test.example` —
test-infra files, no production code path changed. `getRedis()` / `redis.ts` /
`config.ts` untouched; the override works entirely through `process.env.REDIS_URL`
before config parsing, same mechanism `TEST_DATABASE_URL` already uses.

## Follow-up (not in scope here)

The `.claude/agent-memory/code-reviewer/project_expyrico_test_infra.md` project-memory
note documents the shared-`db15` hazard as one of three known non-defects; once this
lands, agents provisioning a review DB should also export `TEST_REDIS_URL` alongside
`TEST_DATABASE_URL`. Left that memory file unedited here since it's owned by the
reviewer tooling, not test-infra source — flagging for whoever next touches it.
