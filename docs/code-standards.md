# Expyrico — Code Structure & Standards

## Language and compiler settings

TypeScript everywhere, strict. `tsconfig.base.json` sets ES2022/ESNext,
`moduleResolution: Bundler`, `noUncheckedIndexedAccess`, and
`exactOptionalPropertyTypes`. Each workspace extends the base config. Because
`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on, array/record
indexing yields `T | undefined` and optional properties are not silently
widened — write code accordingly (guard indexed access, don't assign `undefined`
to a non-optional field).

## Module systems

- **API**: pure ESM, `module: NodeNext`. Use explicit `.js` import specifiers in
  source where NodeNext requires them.
- **shared / theme packages**: ESM, built with `tsc` to `dist/`. `shared`
  exposes a single `"."` export; `theme` exports a themes record + `themeList`.
- **admin**: Next.js resolves shared ESM via `transpilePackages` plus a webpack
  `extensionAlias` mapping `.js -> .ts`.

## Contracts: one source of truth

All cross-workspace contracts live in `@expyrico/shared` as zod schemas with
inferred types. API, mobile, and admin import these — do not redefine request or
response shapes locally. The **API is the validation authority**: it zod-parses
inputs at the boundary. Admin server actions are typed against shared schemas and
zod-parse API responses, but action inputs themselves are not re-validated in
admin (the API validates them).

When a contract changes, change it in `packages/shared` and rebuild. For mobile,
also rebuild the vendored copy (see below).

## API layering

Keep the layers distinct:

```
routes/    thin HTTP handlers; per-domain index.ts aggregates routes
services/  business logic + repositories (all DB access lives here)
Prisma     data access
```

Supporting directories: `plugins/` (Fastify plugins), `queues/` + `workers/`
(BullMQ), `lib/` (`breaker.ts`, `http.ts`), `utils/` (encryption, random),
`config.ts`, `db.ts`, `redis.ts`, `errors.ts`.

Rules of thumb:
- Route handlers stay thin: parse/validate, call a service, map the result.
- Business logic and all Prisma access belong in `services/`. Do not query the
  DB from a route handler.
- Plugin registration order is load-bearing (helmet -> CORS -> auth ->
  idempotency -> apiErrorRecorder -> rate-limit -> error-handler). Auth runs
  before the rate limiter so limits can key on `req.user`.

## Configuration and secrets

- The API validates all env vars via zod in `src/config.ts` and fails fast.
  Never read `process.env` directly outside the config module — import the
  validated config.
- Admin validates env in `src/lib/env.ts` (cached, fail-fast).
- Never commit `.env*` files, tokens, keys, or credentials. Logging redacts
  `password`, `passwordHash`, `refreshToken`, `accessToken`, `totpSecret`, and
  `authorization`; do not log secrets around that redaction.

## Errors

The API uses a centralized error handler (last in the plugin chain) and returns
problem+json shaped errors defined in `@expyrico/shared`. Persist notable
failures via the `ApiError` model + api-error-recorder plugin rather than
swallowing them.

## Concurrency and idempotency

- Records sync uses Postgres advisory transaction locks
  (`pg_advisory_xact_lock`) keyed on household UUID. Personal records are
  last-write-wins; household records are server-authoritative and surface
  `scope_changed` conflicts.
- Giveaway transitions run inside `prisma.$transaction` through the state machine
  in `services/giveaways/state-machine.ts`.
- Mutating community endpoints (notably giveaways) require an `Idempotency-Key`;
  the idempotency plugin caches responses in Redis for 24h (opt-in per route).
- Notifications use the NotificationOutbox pattern: enqueue in the same DB
  transaction, then `sweepOutbox` after commit.

## Naming conventions

- New files: descriptive kebab-case for JS/TS/shell, matching existing local
  patterns.
- Domains are grouped by folder in both `routes/` and `services/`; keep new code
  inside the matching domain rather than adding cross-cutting modules.
- Prefer existing helpers, conventions, and test utilities over new abstractions.

## Mobile conventions

- Navigation is file-based via Expo Router with typed routes; route groups
  `(auth)` and `(app)` gate authenticated vs unauthenticated flows through
  `AuthGate`.
- State: zustand for session/theme/pantry-scope; react-query for server state
  (`staleTime` 30s, `gcTime` 5m, no retry on 4xx). Local persistence via
  WatermelonDB.
- API access goes through the hand-rolled `src/api/client.ts` wrapper (no axios).
  It handles the `/v1` prefix, single-flight refresh on 401, and sign-out on
  refresh failure. Do not call `fetch` directly for API traffic.
- `react-native-get-random-values` must be imported first (crypto polyfill).
- Styling uses nativewind + tailwind with runtime `@expyrico/theme` tokens; use
  theme tokens rather than hard-coded colors.

## Vendored shared packages (mobile)

`@expyrico/shared` and `@expyrico/theme` are consumed by mobile as committed
built copies under `apps/mobile/local-packages/@expyrico/*/dist` (`file:` deps).
The source of truth is `packages/*`. When you change a shared package, rebuild it
and refresh the vendored `dist` copy — otherwise mobile silently runs stale
contracts/tokens. This drift is a known maintenance hazard.

## Testing standards

- **API**: Vitest 2. Unit tests in `tests/unit`; integration tests in
  `tests/integration` run against real Postgres + Redis and truncate all tables
  before each test (`setup.ts`, loads `.env.test`). Workers are skipped in test
  unless `RUN_WORKERS=1`. Run the narrowest relevant suite first, then broaden.
- **Mobile**: Jest + jest-expo + @testing-library/react-native; colocated
  `*.test.ts` and `__tests__/`. Maestro for E2E. Keep a11y, WCAG-contrast, and
  touch-target checks green; respect the 1.5x font-scale cap.
- Write or update tests for new features and bug fixes. Prove a bug with a test
  before fixing it. Do not weaken tests to make them pass.

## Linting caveat

The API `lint` script is currently a no-op (`echo skip`) — there is no
ESLint/Biome gate for the API. Rely on `typecheck` and tests for the API; do not
assume lint is enforcing style there. Mobile does run lint (including a11y) in
CI.

## Commits

Focused, conventional-commit format, no AI references. Do not embed plan IDs,
phase numbers, or audit labels in code comments, migration names, test names, or
commit messages — describe the behavior or invariant directly.
