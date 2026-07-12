# Expyrico — Roadmap

This roadmap is derived from what exists in the codebase today versus known gaps.
Phases are ordered by risk and dependency, not by calendar. Items flagged
"verified bug" block clean builds or deploys and should be resolved first.

## Current state (what exists)

- **API**: Fastify backend with full auth (password, Google/Apple OAuth, TOTP
  MFA, passkeys), products, records + offline sync, reviews, reports, deals,
  giveaways with a transactional state machine, reputation, referrals,
  households, and a broad admin surface. BullMQ workers for product lookup,
  notifications, reputation, moderation, and product-rating recalculation.
  Circuit breakers and persisted API errors for resilience.
- **Mobile**: Expo / RN app with offline-first records (WatermelonDB), OCR
  expiry capture, push notifications, theming, and all major community flows.
  Local Gradle build path.
- **Admin**: Next.js 15 console with cookie/TOTP auth, moderation, user
  management, settings, and system observability.
- **Shared/theme packages**: single-source zod contracts and design tokens with
  five theme variants.
- **Infra**: Ansible provisioning, nginx, systemd units, ordered deploy script,
  backups, CI/CD via GitHub Actions.

## Phase 0 — Unblock builds and deploys (verified bugs, high priority)

1. **Commit `packages/theme/src/palette.ts`.** It is untracked in git while every
   theme variant + `index.ts` imports `./palette.js`. A clean clone or CI build
   of `@expyrico/theme` currently fails. This is the highest-priority fix.
2. **Fix the deploy script package filter.**
   `infra/scripts/deploy-remote.sh` (lines ~57-59) filters Prisma steps on
   `@pantry/api`, but the package is `@expyrico/api`. `prisma generate` /
   `migrate deploy` do not match and no-op or fail during release.
   `deploy.yml` already uses the correct `@expyrico/api`.
3. **Resolve the deep-link scheme mismatch.** `app.config.ts` scheme is
   `Expyrico`, the Android manifest registers `expyrico`, but
   `parseAuthDeepLink` only accepts `pantry:` and SecureStore keys are `pantry.*`.
   Password-reset deep links depend on the backend emitting the `pantry:` scheme.
   Pick one scheme end to end (backend email, config, manifest, parser, storage
   keys) and align them.

## Phase 1 — Production signing and distribution

- **Replace the debug keystore for release builds.** `android/app/build.gradle`
  (line ~37) uses `signingConfigs.debug` for the release build type. Release APKs
  are signed with the debug key: fine for sideload testing, but blocks Play Store
  distribution. Introduce a production keystore + secure signing config before any
  store submission.
- Decide the update strategy: `expo-updates` is configured with an EAS URL but
  dormant under the local-Gradle workflow. Either wire it up intentionally or
  remove the dormant config to avoid confusion.

## Phase 2 — Close security-mandate gaps

The project security mandate (`CLAUDE.md`) is not fully met. These are gaps, not
regressions:

- **reCAPTCHA v3** on register, login, and forgot-password (mobile and admin
  login). Currently absent; rate limiting is the only brute-force control.
- **Content-Security-Policy.** No CSP is set in the API (helmet default only),
  the admin app, or nginx. Add a hand-tuned CSP at the appropriate layer.
- Review whether the API's Bearer-header token model should be complemented by
  SameSite/HttpOnly cookies for any web-facing surface (admin already uses
  cookies; the API is mobile-Bearer by design).

Mitigations already in place for admin: nginx auth rate-limit + mandatory TOTP.

## Phase 3 — Connect deferred features

- **Wire review submission to the API.**
  `apps/mobile/app/(app)/product/[id]/review.tsx:24` carries a TODO: "wire to API
  when M2 backend lands." Review submission is not yet connected on mobile even
  though the backend supports reviews.

## Phase 4 — Reduce maintenance hazards

- **Eliminate vendored-package drift.** Mobile consumes committed `dist` copies
  of `@expyrico/shared` and `@expyrico/theme` under `apps/mobile/local-packages`.
  These must be manually rebuilt to stay in sync with `packages/*`. Consider a
  build step or check that fails when the vendored copies drift from source.
- **Wire an API lint gate.** The API `lint` script is a no-op (`echo skip`).
  Add ESLint/Biome so the API has the same style enforcement mobile has.
- **Enable nightly Maestro E2E.** The nightly Maestro E2E job in CI is currently
  TODO/commented in `ci.yml`.

## Phase 5 — Hardening and observability follow-ups

- Continue leaning on the `ApiError` model, push logs, and Bull-board for
  operational visibility; consider alerting on external-API breaker trips.
- Replace the manual UptimeRobot reminder with a provisioned monitor if uptime
  monitoring becomes a requirement.

## Non-goals (explicit)

- **No wallet/coin/transaction/balance feature is planned or present.** The
  security mandate's concurrency requirements around balance/topup/coin-spend map
  to no code. Giveaways are a currency-free exchange; the concurrency work that
  does exist is records-sync advisory locking and giveaway transactional
  transitions.
- No "Aurora" theme — the brand theme is Expyrico.
