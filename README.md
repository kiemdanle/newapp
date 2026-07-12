# Expyrico

Expyrico is a cross-platform app for tracking product expiry dates with shared
product reviews, plus a community layer: a giveaways marketplace, a deals feed,
reviews and reputation, households (shared pantries), and referrals. The backend
is self-hosted and the product is mobile-first.

> Package names still carry the legacy `pantry` / `@expyrico/*` naming in some
> places (workspace scopes, SecureStore keys, cookie names, systemd units). The
> product name is **Expyrico**.

## Monorepo layout

```
api/            Fastify backend (@expyrico/api)
apps/mobile/    Expo / React Native app (@expyrico/mobile)
apps/admin/     Next.js admin console (@expyrico/admin)
packages/shared/  Zod schemas + inferred types (@expyrico/shared)
packages/theme/   Design tokens + theme variants (@expyrico/theme)
infra/          Ansible roles, nginx, deploy scripts
docs/           Project documentation
```

Tooling: pnpm workspaces (pnpm@9, Node >= 20) with Turbo for task orchestration
(`build`, `dev`, `lint`, `typecheck`, `test`, `clean`). TypeScript is strict
across the repo (`tsconfig.base.json`: ES2022/ESNext, `moduleResolution: Bundler`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

## Prerequisites

- Node >= 20 and pnpm 9 (`corepack enable`)
- PostgreSQL and Redis for the API (integration tests use real instances)
- Android Studio + JDK (bundled JBR) for local mobile builds
- Docker is optional; the reference deployment is a single self-hosted VPS

## Getting started

```bash
pnpm install
pnpm -r build          # builds packages so downstream workspaces resolve dist/
```

### API

```bash
cd api
cp .env.example .env    # then fill required vars (see docs/deployment-guide.md)
pnpm --filter @expyrico/api dev
```

The server (`api/src/server.ts`, `buildServer()`) validates env at startup and
fails fast on missing critical vars. Default bind is `127.0.0.1:4000`.

### Admin

```bash
pnpm --filter @expyrico/admin dev   # binds 127.0.0.1:4001
```

Admin is a Next.js App Router app. It delegates authentication to the API over
HttpOnly cookies and requires an admin account with TOTP enrolled.

### Mobile

Expo Go and EAS are **not** used. Builds are local Gradle + adb.

```bash
pnpm --filter @expyrico/mobile start     # Metro dev server
pnpm mobile:apk                          # assembleRelease -> app-release.apk
```

APK output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.

> The mobile app consumes **vendored** built copies of `@expyrico/shared` and
> `@expyrico/theme` under `apps/mobile/local-packages/.../dist`. The source of
> truth is `packages/*`; the vendored copies must be rebuilt and kept in sync
> manually.

## Testing

- API: Vitest 2 (`pnpm --filter @expyrico/api test`). Unit tests plus integration
  tests against real Postgres + Redis (tables truncated before each test).
- Mobile: Jest + jest-expo, plus a11y / WCAG-contrast / touch-target checks.
  Maestro drives E2E (`test:e2e`).
- CI runs mobile typecheck/lint/tests on every push; `deploy.yml` runs the API
  test suite against Postgres 16 + Redis 7 before building.

## Documentation

| Doc | Purpose |
| --- | --- |
| [docs/project-overview-pdr.md](docs/project-overview-pdr.md) | Product overview and PDR |
| [docs/codebase-summary.md](docs/codebase-summary.md) | Structure and key modules |
| [docs/code-standards.md](docs/code-standards.md) | Conventions and standards |
| [docs/system-architecture.md](docs/system-architecture.md) | Architecture + data flow |
| [docs/project-roadmap.md](docs/project-roadmap.md) | Phases and known gaps |
| [docs/deployment-guide.md](docs/deployment-guide.md) | Infra and deploy |
| [docs/design-guidelines.md](docs/design-guidelines.md) | Palette and theming |

## Known high-priority issues

These are tracked in detail in the roadmap and deployment guide:

- `packages/theme/src/palette.ts` is **untracked in git** while every theme
  variant imports from it; a clean clone/CI build of `@expyrico/theme` would fail.
- `infra/scripts/deploy-remote.sh` filters Prisma steps on `@pantry/api`, but the
  package is `@expyrico/api`, so migrations would not run during deploy.
- Mobile release builds are signed with the **debug** keystore
  (`android/app/build.gradle`), which blocks Play Store distribution.
- Deep-link scheme mismatch: config uses `Expyrico`, the Android manifest
  registers `expyrico`, but the parser only accepts the legacy `pantry:` scheme.
- No reCAPTCHA and no hand-tuned CSP anywhere, despite the security mandate in
  `CLAUDE.md`.

## Security notes

Auth is JWT (HS256 access tokens) with DB-backed refresh sessions, argon2id
passwords, TOTP MFA (mandatory for admins), passkeys/WebAuthn, and Google/Apple
OAuth. Rate limiting is enforced via Redis at the API and nginx layers. There is
**no** wallet/coin/transaction feature in the codebase; the closest analogue is
the currency-free giveaway flow with reputation ratings.
