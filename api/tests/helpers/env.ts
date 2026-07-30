// Pure env bootstrap — no other imports. This file exists ONLY so Vitest's
// `setupFiles` can guarantee `.env.test` is loaded into `process.env` before
// ANYTHING else in the test process touches `getConfig()`.
//
// Why this has to be a separate file: `tests/helpers/setup.ts` statically imports
// `../../src/db.js` and `../../src/redis.js`. Per ES module semantics, a module's
// static imports are fully evaluated *before* that module's own top-level code runs
// — so `db.js` (which imports `logger.js`, which eagerly calls `getConfig()` at
// module-evaluation time to pick a pino log level) always ran before setup.ts's own
// env-loading code, regardless of where that code was placed in the file.
//
// Separately, Vite/Vitest auto-loads `.env` (not `.env.test`) into `process.env`
// during its own startup, before any setupFile runs, whenever it resolves `mode` to
// something other than `test` (which it does here, since nothing in this repo pins
// vitest's mode to `test`). That means by the time `logger.ts`'s eager call ran, every
// required env var already had a *valid-looking* value from `api/.env` (the dev file,
// e.g. a 32+ char placeholder `JWT_ACCESS_SECRET`) — so `getConfig()` didn't throw, it
// successfully cached the wrong (dev) config permanently for that module instance,
// only to be silently outrun by `.env.test`'s later, correct overwrite of
// `process.env` (too late — `getConfig()` never re-parses once cached).
//
// The failure was invisible in every full-suite run: `process.env` is a real mutable
// global that survives across test files even when Vitest gives each file a fresh
// module registry (`isolate: true`, the default), so any earlier file's setupFiles
// execution already primed it correctly before this file's own eager consumers ran.
// It only surfaced when a file doing `vi.doMock(...) + vi.resetModules()` was the
// first (or only) file in the whole process: the *original* module graph (used by
// anything statically imported at the top of that test file, e.g. `issueAccessToken`)
// kept the poisoned dev secret, while the *freshly re-imported* graph (built via
// `await import(...)` after `resetModules()`) picked up a brand-new, correctly-primed
// config instance — two different secrets in the same test, so a token signed by one
// never verified against the other.
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest runs from the api package root, so resolve relative to cwd. We OVERRIDE any
// pre-existing values (Vite's own `.env` auto-load, a parent shell's exported vars,
// etc.) because tests must use the `.env.test` values unconditionally.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const envPath = existsSync(resolve('.env.test')) ? '.env.test' : '.env.test.example';
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let val = m[2]!.trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]!] = val;
  }
}

// Keep checked-out local .env.test files compatible with config additions without
// weakening production's fail-fast Firebase credential validation.
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;
process.env.FIREBASE_PROJECT_ID ??= 'expyrico-test';
process.env.FIREBASE_CREDENTIAL_MODE ??= 'workload_identity';
