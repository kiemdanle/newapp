# Expyrico — Product Overview & PDR

## What Expyrico is

Expyrico is a cross-platform application for tracking product expiry dates. Users
record the products they own and their expiry dates, receive push notifications
before items expire, and share product reviews with the community. Around that
core, Expyrico adds a community layer:

- **Giveaways marketplace** — a currency-free exchange where users offer and
  claim products, with reputation ratings on completed exchanges.
- **Deals feed** — community-submitted deals with voting.
- **Reviews & reputation** — product reviews with votes, plus per-user
  reputation scores derived from behaviour.
- **Households (shared pantries)** — shared product records synced across
  members.
- **Referrals** — invite-driven growth.

The backend is self-hosted on a single VPS. The product is mobile-first, with a
Next.js admin console for moderation and operations.

> Naming note: the product is Expyrico, but package scopes, cookie names,
> SecureStore keys, and systemd units still use the legacy `pantry` name from an
> earlier iteration of the product.

## Target platforms

- **Mobile** (primary): Android via Expo / React Native, built locally with
  Gradle (no Expo Go, no EAS). iOS-capable stack (Apple OAuth, Apple auth) but
  the shipped build target and verified build path is Android.
- **Admin** (operations): Next.js 15 web console, server-rendered, bound to
  localhost and fronted by nginx in production.

## Core user journeys

1. **Onboarding** — welcome, sign up (email/password, Google, Apple, passkey),
   email verification via 6-digit OTP.
2. **Track** — scan or add a product, set expiry, receive scheduled push
   reminders. OCR (ML Kit text recognition) assists expiry-date capture.
3. **Offline-first records** — records are stored locally (WatermelonDB /
   SQLite) and synced to the server; personal records use last-write-wins,
   household records are server-authoritative.
4. **Community** — browse products and reviews, submit reviews, post/claim
   giveaways, vote on deals, build reputation.
5. **Households** — create or join a shared pantry; members share synced
   records.

## Feature domains (API surface)

Auth, current user (`/v1/me`), products, records (with sync), reviews, reports,
deals, giveaways, users/reputation, referrals, households, and a broad admin
surface (analytics, moderation, user management, settings, and system
observability).

## Security posture (summary)

- JWT HS256 access tokens (Bearer header, mobile-oriented), DB-backed refresh
  sessions (30-day).
- argon2id password hashing.
- MFA: TOTP (encrypted secret, recovery codes); admin login forces TOTP
  enrollment. Passkeys / WebAuthn. Google + Apple OAuth.
- RBAC with two roles (`user`, `admin`); admin actions audited via
  `AdminAuditLog`.
- Rate limiting via Redis at the API (per-user, per-IP, tighter for auth) and
  again at nginx.
- Idempotency keys for mutating community endpoints.

See `system-architecture.md` for detail and `project-roadmap.md` for security
gaps.

## Explicit non-goals / clarifications

- **No wallet, coins, "pink coin", balance, or monetary transactions exist**
  anywhere in the codebase. Giveaways are a free exchange; reputation ratings
  (`TransactionRating`) are the only "transaction"-named concept and involve no
  currency. Any concurrency mandate about balance/topup/coin-spend in project
  instructions maps to no implemented feature.
- There is **no "Aurora" theme**. The default/brand theme is **Expyrico**.

## Product Design Requirements (PDR)

### Functional requirements

- FR1: Users can register, verify email, and sign in via password, Google,
  Apple, or passkey.
- FR2: Users can create products and records with expiry dates, offline, and
  have them sync when connectivity returns.
- FR3: The system sends push notifications ahead of expiry (scheduled +
  send workers, Expo push).
- FR4: Users can review products; reviews receive votes and feed a Wilson-score
  product rating.
- FR5: Users can create and claim giveaways through a defined state machine, and
  rate completed exchanges.
- FR6: Users can create and vote on deals.
- FR7: Users can create/join households and share synced records.
- FR8: Admins can moderate content, manage users, adjust settings/feature flags,
  and observe system health.

### Non-functional requirements

- NFR1: Strict TypeScript across all workspaces; shared contracts defined once in
  `@expyrico/shared` (zod) and consumed by API, mobile, and admin.
- NFR2: Fail-fast configuration — the API validates all env vars at startup.
- NFR3: Resilience for external product-data APIs via circuit breakers, with
  failures persisted for admin visibility.
- NFR4: Concurrency safety for records sync (advisory locks) and giveaway state
  transitions (transactional + idempotent).
- NFR5: Accessibility — mobile ships a11y linting, WCAG contrast checks,
  touch-target checks, and a global font-scale cap of 1.5x.
- NFR6: Observability — Bull-board queue dashboard, persisted API errors, push
  logs, external-API health, all exposed in admin.

### Known constraints and mandate gaps

- The security mandate calls for reCAPTCHA v3 on register/login/forgot-password
  and a hand-tuned CSP; neither is implemented. Rate limiting is the only
  brute-force control and CSP is helmet's default only.
- The API uses Bearer-header tokens for mobile rather than SameSite/HttpOnly
  cookies. (The admin console does use HttpOnly cookies.)

These are recorded as gaps in `project-roadmap.md`.
