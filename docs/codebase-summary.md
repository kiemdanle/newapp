# Expyrico — Codebase Summary

A pnpm + Turbo monorepo. Node >= 20, pnpm@9. Workspaces: `api`, `apps/*`,
`packages/*`. Turbo tasks: `build`, `dev` (persistent), `lint`, `typecheck`
(depends `^build`), `test` (depends `^build`), `clean`. Global env dependency
`**/.env.*`. Root TS config (`tsconfig.base.json`) is strict with ES2022/ESNext,
`moduleResolution: Bundler`, `noUncheckedIndexedAccess`, and
`exactOptionalPropertyTypes`. Renovate runs weekly (Monday), semantic commits,
patch automerge, majors gated, security alerts labeled `security`.

> The root `lint` for the API is a no-op (`echo skip`) — no ESLint/Biome gate is
> wired for the API.

## Repository structure

```
api/            @expyrico/api      Fastify backend
apps/mobile/    @expyrico/mobile   Expo / React Native
apps/admin/     @expyrico/admin    Next.js admin
packages/shared/ @expyrico/shared  zod schemas + types
packages/theme/  @expyrico/theme   design tokens + variants
infra/          Ansible, nginx, deploy scripts
docs/           documentation
```

## API (`api/`)

Fastify 4.28, Node 20, TypeScript 5.4, pure ESM (`module: NodeNext`).

- **Entry**: `api/src/server.ts` — `buildServer()`; a symlink-resilient guard
  decides whether to call `listen()`.
- **Boot**: pino logger with redaction of `password`, `passwordHash`,
  `refreshToken`, `accessToken`, `totpSecret`, `authorization`; `trustProxy`;
  1 MB body limit.
- **Plugin order**: helmet -> CORS -> authPlugin -> idempotencyPlugin ->
  apiErrorRecorderPlugin -> rate-limit -> error-handler. The auth `onRequest`
  hook populates `req.user` before the rate limiter so budgets can be per-user
  vs per-IP.
- **Layers**: `routes/` (thin handlers, per-domain `index.ts` aggregators) ->
  `services/` (business logic + repositories) -> Prisma. Plus `plugins/`,
  `queues/`, `workers/`, `lib/` (`breaker.ts` opossum circuit breaker, `http.ts`
  undici), `utils/` (encryption, random), `config.ts`, `db.ts`, `redis.ts`,
  `errors.ts`.

### Data layer

PostgreSQL via Prisma 5.18. Schema at `api/prisma/schema.prisma` (716 lines),
15 migrations (`20260528` init through `20260614` api_errors_camelcase). Seeds:
`seed.ts` (system user with fixed UUID ending `...0001`), `seed-admin.ts`
(argon2id).

Models: `User`, `AuthCredential`, `Session`, `PushToken`, `EmailToken`,
`PasswordReset`, `TotpChallenge`, `TotpRecoveryCode`, `AdminAuditLog`, `Product`,
`ProductEdit`, `Record`, `PushLog`, `Review`, `ReviewVote`, `Report`, `Setting`,
`NotificationTemplate`, `ApiError`, `Deal`, `DealVote`, `Giveaway`,
`GiveawayClaim`, `TransactionRating`, `NotificationOutbox`, `Referral`,
`Household`, `HouseholdMember`.

### Route domains

- `/health`
- `/v1/auth`: register, login, logout, refresh, verify-email,
  resend-verification, forgot-password, reset-password, me, oauth-google,
  oauth-apple, passkey-register, passkey-login, totp
- `/v1/me`
- `/v1/products`
- `/v1/records` (incl. sync)
- `/v1` reviews, reports, deals, giveaways, users (reputation), referrals,
  households
- `/v1/admin`: analytics; products (incl. merge & pending-approval); reviews;
  reports; users (incl. impersonate / revoke-sessions); households; deals;
  giveaways; referrals; settings (admins, feature-flags, moderation,
  notification-templates); system (api-errors, bullboard, external-apis,
  push-logs, queue-health).

### Key services / mechanisms

- **Records sync** (`api/src/services/records/sync.ts`): Postgres advisory
  transaction locks (`pg_advisory_xact_lock`) keyed on household UUID. Personal
  records are last-write-wins; household records are server-authoritative with
  `scope_changed` conflicts.
- **Giveaway state machine** (`services/giveaways/state-machine.ts`): transitions
  wrapped in `prisma.$transaction`; mutating endpoints require an
  `Idempotency-Key`.
- **Background jobs** (BullMQ + Redis via ioredis; 6 workers in
  `src/workers/runner.ts`, skipped in test unless `RUN_WORKERS=1`):
  `product-lookup` (OpenFoodFacts + upcitemdb), `notification-schedule`,
  `notification-send` (Expo push via expo-server-sdk), `score-recalc`
  (reputation), `moderation-flag` (profanity auto-flag -> reports as system
  user), `product-rating-recalc` (Wilson score). Bull-board mounted at
  `/v1/admin/bullboard` (admin-only). NotificationOutbox pattern: enqueue in the
  same DB tx, `sweepOutbox` after commit.
- **Email** (`services/auth/email.ts`): nodemailer SMTP; verification code
  (10-min) + password-reset link (`APP_DEEP_LINK` + token). In test env, emails
  are logged, not sent.
- **Resilience**: opossum circuit breakers around external product APIs;
  `ApiError` model + api-error-recorder plugin persist failures for admin.

### Testing

Vitest 2 (pool forks, singleFork, 15s timeout, `NODE_ENV=test`), supertest.
`tests/unit` (~28) + `tests/integration` (~55, real Postgres + Redis; `setup.ts`
truncates all tables before each test, loads `.env.test`). Scripts: `test`,
`test:watch`, `test:unit`, `test:integration`.

## Mobile (`apps/mobile/`)

Expo SDK ~52, RN 0.76.9, React 18.3.1, New Architecture + Hermes on. Expo Router
~4 (file-based, typed routes). Builds are local Gradle + adb — no Expo Go, no
EAS.

- **State**: zustand ^4.5 (session, theme, pantry-scope stores) +
  @tanstack/react-query ^5.51.
- **Local-first data**: @nozbe/watermelondb ^0.28 (SQLite) with offline records
  push/pull sync.
- **Styling**: nativewind ^4 + tailwind ^3.4 + runtime `@expyrico/theme` tokens.
- **Auth libs**: expo-secure-store, google-signin, expo-apple-authentication,
  react-native-passkey, react-native-get-random-values (crypto polyfill imported
  first).
- **Device**: expo-camera, @react-native-ml-kit/text-recognition (OCR for expiry
  dates), expo-notifications. Validation with zod ^3.23.

### Navigation

Root `app/_layout.tsx` renders providers (GestureHandlerRootView >
SafeAreaProvider > QueryClientProvider > ThemeProvider) plus `AuthGate`
(redirects `(auth)/welcome` vs `(app)/(tabs)/home`) and `DeepLinkHandler`.

- `(auth)`: welcome, sign-in (email/pw + Google/Apple/passkey), sign-up,
  verify-email (6-digit OTP), forgot-password, reset-password (via
  `pantry://reset-password?token=`).
- `(app)`: `(tabs)` floating pill bar = home, giveaways, deals, browse, reviews,
  profile; `settings/{index,theme,add-passkey}`; `product/{new,[id],[id]/review}`;
  `record/[id]`; `deal/{new,[id]}`;
  `giveaway/{new,mine,[id],[id]/rate,[id]/manage}`; household, report, invite,
  scan.

### API integration

Hand-rolled fetch wrapper `src/api/client.ts` (no axios); base URL from
`Constants.expoConfig.extra.apiBaseUrl` = `https://api.linhkienkts.com`,
auto-prefixes `/v1`. Tokens live in expo-secure-store keys
`pantry.access_token` / `pantry.refresh_token`. Single-flight refresh on 401; on
failure clears storage + `onSignOut`. React Query `staleTime` 30s, `gcTime` 5m,
no retry on 4xx.

### Android

`applicationId com.expyrico.app`, versionCode 1, versionName 0.0.1. Kotlin pinned
2.0.21 via expo-build-properties (for react-native-passkey coroutines metadata).
Manifest permissions: INTERNET, CAMERA, POST_NOTIFICATIONS, USE_BIOMETRIC,
USE_CREDENTIALS; deep-link intent filter scheme `expyrico`. Build:
`pnpm mobile:apk` -> assembleRelease (pins JAVA_HOME to Android Studio JBR). APK
at `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

### Shared-code vendoring

`@expyrico/shared` and `@expyrico/theme` are consumed as **vendored built
copies** under `apps/mobile/local-packages/@expyrico/{shared,theme}/dist`
(`file:` deps, committed `dist` artifacts). Source of truth is `packages/*`.
Drift risk: the copies must be manually rebuilt and kept in sync.

### Testing

Jest + jest-expo ~52 + @testing-library/react-native. E2E via Maestro
(`test:e2e`). Tests in `__tests__/` (components + routes), `src/tests/`, and
colocated `*.test.ts` (auth, api client, theme, linking, sync). a11y tooling:
eslint-plugin-react-native-a11y, wcag-contrast; global font-scale cap 1.5x.

### Known mobile notes

- Deep-link scheme mismatch (config `Expyrico` vs manifest `expyrico` vs parser
  `pantry:`) — see roadmap and design guidelines.
- Release build signed with debug keystore — see deployment guide.
- `app/(app)/product/[id]/review.tsx:24` TODO "wire to API when M2 backend
  lands" — review submission not yet connected.
- `expo-updates` is configured with an EAS URL but dormant (local-Gradle
  workflow). `react-native-worklets` is a local stub.

## Admin (`apps/admin/`)

Next.js 15.5.19, App Router (`src/app/`), React 18.3.1, TS 5.7.

- **next.config**: `output: standalone`, `poweredByHeader: false`, typedRoutes,
  `transpilePackages: ['@expyrico/shared']`, webpack `extensionAlias .js -> .ts`
  for shared ESM. Dev binds `127.0.0.1:4001`; prod runs
  `node .next/standalone/apps/admin/server.js`.
- **Pages** (route group `src/app/(admin)/`, all Server Components,
  `force-dynamic`): dashboard; analytics (overview/scans/reviews/geography);
  users (+`[id]` patch/revoke-sessions/impersonate); products (+`[id]`,
  `[id]/merge`, pending-approval queue); reviews; reports; deals; giveaways;
  households; referrals; settings (admins, feature-flags, moderation,
  notification-templates); system (queue counts, push logs, api-errors,
  external-apis). `login/` sits outside the group (multi-step: credentials ->
  TOTP -> TOTP-enroll).
- **Auth**: cookie-based, delegating to the Fastify API. Cookies
  (`src/lib/cookies.ts`): `pantry_admin_access` (HttpOnly, 15min),
  `pantry_admin_refresh` (HttpOnly, 30d), `pantry_admin_csrf` (readable, 30d);
  all `SameSite=Lax`; `Secure`/`Domain` via `COOKIE_SECURE`/`COOKIE_DOMAIN`.
  Route Handlers under `src/app/api/auth/*` are the only place cookies are
  written. TOTP is mandatory: login returns `requiresTotp` or
  `requiresTotpEnrollment`; `finalizeSession` enforces `role === 'admin'` (403
  otherwise). `requireAdminSession()` (`src/lib/session.ts`) fetches
  `/v1/auth/me`, enforces admin, and on 401 hands off to
  `/api/auth/refresh-redirect`. `middleware.ts` redirects unauthenticated to
  `/login?next=`, returns 405 on unsafe methods on public pages, uses
  `x-forwarded-host`/`proto` behind nginx. CSRF is a double-submit token with a
  timing-safe compare (`src/lib/csrf.ts`, header `x-csrf-token`).
- **Server actions**: `src/lib/actions.ts` (`'use server'`) -> `serverAdminApi`.
  The API is the validation authority; responses are zod-parsed against
  `@expyrico/shared` admin schemas (action inputs are typed, not zod-validated in
  admin). env validation `src/lib/env.ts` (`API_BASE_URL`, `COOKIE_SECURE`,
  `COOKIE_DOMAIN`, `NODE_ENV`; cached, fail-fast). `apiServerFetch`
  (`src/lib/api.ts`) reads the access cookie, forwards Bearer to the API, cache
  `no-store`.
- **Styling**: Tailwind 3.4, shadcn/ui-style components (`components/ui/*`, Radix
  + CVA + tailwind-merge), HSL CSS vars in `globals.css` implementing the
  Expyrico palette; fonts Outfit (display) / Inter (body) / JetBrains Mono. Data
  via @tanstack/react-table + react-query.
- **Gaps**: no CSP header anywhere (app or nginx); no reCAPTCHA on admin login
  (mitigated by nginx auth rate-limit + mandatory TOTP).

## Packages

### `packages/shared` (`@expyrico/shared`)

ESM, `tsc` build to `dist`, single `"."` export, only dependency is zod. Exports
zod schemas + inferred types: auth, user, error (problem+json), product, record,
review, report, deal, giveaway, reputation, referral, household, plus the full
admin schema tree (`schemas/admin/*`) and `types.ts`. Single source of truth for
contracts across api/mobile/admin.

### `packages/theme` (`@expyrico/theme`)

ESM, `tsc` build, no runtime deps. `tokens.ts` is the Theme contract
(ColorTokens, radii, shadows, clay + md3 elevation, typography, MD3 typeRamp
displayLarge...labelSmall, spacing, animation). `palette.ts` is the mandated
Expyrico palette. Variants `themes/{expyrico(+expyricoDark),bento,clay,material}`.
`index.ts` exports the themes record + `themeList`. See `design-guidelines.md`.

> **Verified build blocker**: `packages/theme/src/palette.ts` is **untracked in
> git** while every theme variant + `index.ts` imports from `./palette.js`. A
> clean clone or CI build of `@expyrico/theme` would fail. High priority to
> commit.
