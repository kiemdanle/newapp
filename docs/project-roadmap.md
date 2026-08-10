# Expyrico — Roadmap

This roadmap is derived from what exists in the codebase today versus known gaps.
Phases are ordered by risk and dependency, not by calendar. Items flagged
"verified bug" block clean builds or deploys and should be resolved first.

## Current state (what exists)

- **API**: Fastify backend with full auth (password, Google/Apple OAuth, TOTP
  MFA, passkeys), products (with draft/pending/active lifecycle, moderation, revisions),
  creator-private photo uploads (Sharp processing, media pipeline, quota enforcement),
  records + offline sync, reviews, reports, deals,
  giveaways with a transactional state machine, reputation, referrals,
  households, and a broad admin surface. BullMQ workers for product lookup,
  notifications, reputation, moderation, product-rating recalculation, and media cleanup.
  Circuit breakers and persisted API errors for resilience. reCAPTCHA Enterprise server-side
  abuse verification on product submission. Durable media-operation outbox with crash recovery.
- **Mobile**: Expo / RN app with offline-first records (WatermelonDB), OCR
  expiry capture, barcode/QR scanning with draft product creation, resumable draft editor,
  reCAPTCHA Enterprise client-side token generation, push notifications, theming, and all major community flows.
  Local Gradle build path.
- **Admin**: Next.js 15 console with cookie/TOTP auth, product moderation queue (submissions + revisions),
  side-by-side revision comparison, approval/feedback/merge operations, user
  management, settings (including product-creation mode), and system observability.
- **Shared/theme packages**: single-source zod contracts (including product lifecycle, media, and abuse schemas)
  and design tokens with the `expyrico` and `expyricoDark` themes.
- **Infra**: Ansible provisioning, nginx (API + dedicated CDN vhost for public media),
  systemd units, ordered deploy script, database + media backups with restore validation, CI/CD via GitHub Actions.

## Phase 0 — Mobile scan product creation and moderation (COMPLETED)

Implemented end-to-end: creator-private drafts with optional multi-photo uploads, moderated submission,
admin revision/approval workflow, mobile scan-v2 state machine with resumable draft editor, secure media pipeline
with WebP variants and separate public/private namespaces, reCAPTCHA Enterprise abuse verification, per-user/day quotas,
media cleanup worker, operational health monitoring, and CDN vhost configuration. See
`plans/260724-1612-mobile-scan-product-creation/` for full scope and verification report.

### Deployment prerequisites (before rollout)

1. **Provision required environment keys** in `api/.env` and `/etc/pantry/secrets/api.env`:
   - `MEDIA_ROOT` — VPS media directory (e.g., `/var/lib/expyrico/media`)
   - `MEDIA_PUBLIC_BASE_URL` — public CDN base URL (e.g., `https://cdn.expyrico.app`)
   - `RECAPTCHA_PROJECT_ID`, `RECAPTCHA_SITE_KEY_ANDROID`, `RECAPTCHA_SITE_KEY_IOS` — from Google Cloud console
   - Rotate `JWT_ACCESS_SECRET` from placeholder (see verification report for details)
2. **Run Phase 1 expand migration** (new enum values, schema additions).
3. **Deploy API/admin with `product_creation.mode=off`** to disable creation while setup continues.
4. **Provision infra** (media root permissions, CDN nginx vhost, systemd timer for cleanup worker).
5. **Enable for internal users** (via allowlist), exercise moderation flow, test backup/restore.
6. **Classify legacy pending products** via deferred migration B when confident no concurrent report-writer emits legacy `pending`.
7. **Expand to all users** by setting `product_creation.mode=all`.

## Phase 1 — Production signing and mobile distribution

- **Replace the debug keystore for release builds.** `android/app/build.gradle`
  (line ~37) uses `signingConfigs.debug` for the release build type. Release APKs
  are signed with the debug key: fine for sideload testing, but blocks Play Store
  distribution. Introduce a production keystore + secure signing config before any
  store submission.
- **iOS build on real hardware.** Verify iOS compile and runtime against known external limitation
  (bare React Native toolchain issue unrelated to this codebase).

## Phase 2 — Close remaining security-mandate gaps

The project security mandate (`CLAUDE.md`) is not fully met. Completed: reCAPTCHA Enterprise
on product submission (server-verified). Gaps:

- **reCAPTCHA Enterprise on additional flows** (register, login, forgot-password on mobile and admin).
  Currently rate-limiting is the only brute-force control for auth.
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
  does exist is records-sync advisory locking, giveaway transactional
  transitions, and media-operation atomic reservations.
- No "Aurora" theme — the brand theme is Expyrico.
- **Product creation is now fully operational** (draft/pending/active lifecycle with moderation).
  Earlier roadmap entries about product creation gaps are superseded by Phase 0.
