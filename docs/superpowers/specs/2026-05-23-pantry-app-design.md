# Pantry App — Design Spec

**Date:** 2026-05-23
**Status:** Approved (pending user review of this document)
**Topic:** Cross-platform mobile app for tracking product expiry dates with shared product reviews and a self-hosted backend

---

## 1. Overview

A cross-platform mobile app (iOS + Android) that lets users:

- Sign up and sign in via email + password, Google, Apple, or passkey
- Scan product barcodes (UPC/EAN) and QR codes
- Track expiry dates of items they own (their personal pantry)
- Receive push notifications before items expire
- Rate and review products in a shared global catalog
- Upvote and downvote other users' reviews

The app ships with four switchable visual themes (Aurora Glass, Bento Grid, Soft Clay, Material You). Aurora Glass is the default.

The system also includes a web admin dashboard for the operator to manage users, products, reviews, reports, analytics, and system health.

The entire backend is self-hosted on a single VPS without Docker.

---

## 2. Functional requirements

### 2.1 Authentication

- Email + password registration with email verification (required before first sign-in)
- Forgot-password via magic link
- Social sign-in: Google and Apple (Apple Sign-In required by App Store policy when any other social provider is offered)
- Passkeys (WebAuthn) for passwordless sign-in
- One user account can have multiple credentials linked simultaneously (e.g., password + Google + passkey on the same account)
- Sessions: short-lived JWT access token (15 min) + opaque refresh token (30 days, rotates on use, hashed in DB)
- Tokens stored in `expo-secure-store` on mobile and HTTP-only cookies in admin web

### 2.2 Personal pantry (records)

- Each user owns private records of items they have. Records are not visible to other users.
- A record can optionally link to a product in the shared catalog (via barcode/QR scan), or be fully manual (custom name).
- Required fields: expiry date, name (or product reference). Optional: brand, quantity, unit, purchase date, notes, photo.
- Status lifecycle: `active` → `consumed` | `discarded` | `expired`.

### 2.3 Scanning

- The mobile app accepts both **product barcodes (UPC/EAN/EAN-13/UPC-A)** and **QR codes** through one camera flow. The scanner detects either format and routes accordingly.
- After a successful scan, the app calls `POST /products/lookup` with the decoded value.
- The lookup hierarchy is:
  1. Local Postgres `products` cache (instant)
  2. Open Food Facts API (food)
  3. UPCitemdb API (non-food fallback)
  4. If nothing matches: prompt user to enter product details manually; manual product is saved to the catalog with `source = 'user'`.

### 2.4 Expiry date capture

The app supports two ways to capture an expiry date:

- **Manual entry** — date picker after the scan
- **OCR** — user taps a "scan date" button that opens the camera; on-device ML Kit text recognition extracts a date and pre-fills the picker. User confirms before saving.

OCR runs entirely on-device. No image data is sent to the backend.

### 2.5 Notifications

- Push notifications via Expo Push Notifications service.
- Default schedule per record: 7 days before expiry, 1 day before, on expiry day. User can adjust globally or per record.
- Scheduled jobs are computed when a record is created/updated and stored in `records.notify_at`. BullMQ delayed jobs fire them via Expo Push.

### 2.6 Reviews

- A review is **one rating (1–5 stars, required) and an optional written body** attached to a `(user, product)` pair.
- One review per user per product. Editable. Soft-deletable.
- Reviews display sorted by Wilson score by default; "Newest" and "Highest rating" are alternative sorts.

### 2.7 Voting

- Other users can upvote (+1) or downvote (-1) any visible review.
- A user can change or remove their vote. Constraint: one vote per (user, review).
- Vote counts and Wilson score are denormalized on the review row and updated by a debounced background job.

### 2.8 Reporting and moderation

- Any user can flag a review, user, or product as inappropriate.
- Automated profanity filter runs on every new review and may auto-flag.
- A report queue in the admin dashboard lets moderators resolve flagged content (hide, delete, ban offender, dismiss).
- Reports `>3` on the same target auto-hide the content pending admin review.

### 2.9 Profile

- Editable fields: first name, last name, country (auto-detected from IP at signup, user can override), avatar.
- Country detection uses ipapi.co (free tier, no API key for low volume) at registration time, with a fallback chain to ip-api.com if the primary fails. The result is cached against the IP for 24h in Redis to avoid duplicate calls. ISO-3166 alpha-2 code stored in `users.country`.
- Email is editable but requires re-verification.

### 2.10 Theming

- Four built-in themes: Aurora Glass (default), Bento Grid, Soft Clay, Material You.
- User can switch themes in Settings → Theme. Choice persists locally and syncs to user profile.
- Each theme is a token object: `{ colors, radii, shadows, typography, spacing, animations }`. Components consume tokens; never raw values.
- Theme switch animation: 200ms cross-fade.

### 2.11 Offline-first

- All reads come from local WatermelonDB.
- All writes go to WatermelonDB first, then a sync engine pushes them to the API.
- Every write generates a `client_id` (UUID) used as `Idempotency-Key` so retries cannot duplicate.
- Sync triggers: app foreground, network reconnect, after every local write, every 5 min while foregrounded.
- Sync uses `?since=<timestamp>` for delta pulls.
- Conflict policy: last-write-wins on user-owned data (records, my reviews); server wins on shared data (product details, vote counts on others' reviews).

---

## 3. Non-functional requirements

- **Performance:** product lookup cache hit responds in <50ms p95 from VPS region. Mobile cold start to home screen <2s on a mid-range Android.
- **Availability:** target 99.5% (single VPS; planned downtime acceptable for upgrades).
- **Security:** WCAG AA color contrast across all themes; HTTPS-only; secrets at rest mode-600; admin behind IP allowlist + TOTP.
- **Privacy:** no third-party analytics. No user data leaves the VPS except product lookups (barcode only, no PII) to OFF/UPCitemdb.
- **Scale target v1:** 10,000 users, 1M records, 100k reviews. Single VPS handles this comfortably.

---

## 4. Architecture

### 4.1 Repository layout

Monorepo using pnpm workspaces + Turborepo:

```
pantry/
├── apps/
│   ├── mobile/         Expo (React Native) — iOS + Android
│   └── admin/          Next.js 15 admin web UI
├── api/                Fastify + Prisma + Postgres backend
├── packages/
│   ├── shared/         TypeScript types, Zod schemas
│   └── theme/          Four theme token sets
└── infra/              Ansible playbook, systemd units, nginx config, deploy scripts
```

`packages/shared` is the single source of truth for API request/response types. Mobile and admin import from it; api validates against it. A breaking schema change forces all three to update together.

### 4.2 Runtime topology (single VPS, no Docker)

Target host: Ubuntu 22.04 LTS or 24.04 LTS, 4 vCPU / 8 GB RAM / 80 GB SSD (Hetzner, DigitalOcean, or similar).

Native services:

- **PostgreSQL 16** — installed via apt, listens on localhost only. Extensions: `pg_trgm` (fuzzy search), `pgcrypto` (UUID generation).
- **Redis 7** — via apt, localhost only. Used for: rate limiting, session/refresh-token cache, BullMQ job queue, idempotency keys.
- **api** (Fastify, Node 20 LTS) — runs as a `pantryapp` user under a systemd unit, port 4000.
- **admin** (Next.js, Node 20 LTS) — runs as `pantryapp` under systemd, port 4001.
- **nginx** — reverse proxy with Let's Encrypt TLS via certbot.
  - `api.<domain>` → 127.0.0.1:4000
  - `admin.<domain>` → 127.0.0.1:4001 (IP-allowlisted at nginx layer)

Backups:

- Nightly `pg_dump` (custom format) → encrypted with age → uploaded to S3-compatible object storage (Backblaze B2 or Cloudflare R2)
- Retention: 7 daily, 4 weekly, 3 monthly
- Quarterly restore drill on a scratch VPS

Monitoring:

- Pino structured JSON logs → file → logrotate (7 days local)
- `/health` and `/health/ready` endpoints
- UptimeRobot pings `/health` every 5 min, alerts via email (and optional secondary channel of your choice — Telegram, Slack, or Discord webhook)

Security baseline:

- ufw firewall: 22 (key-only ssh), 80, 443 open; everything else closed
- fail2ban on ssh
- nginx: TLS 1.2+, HSTS, rate limits, request body size cap
- Postgres: localhost only, app user has no superuser, separate read-only role for ad-hoc queries
- Secrets in `/etc/pantry/.env.production`, owned by `pantryapp:pantryapp`, mode 600
- Renovate bot for dependency upgrades; weekly `npm audit` in CI

### 4.3 Background jobs (BullMQ on Redis)

- `product-lookup` — async fetch from OFF and UPCitemdb when local cache misses; persists result.
- `notification-schedule` — recomputes a record's `notify_at` array and enqueues delayed `notification-send` jobs.
- `notification-send` — fires a single Expo Push at the scheduled time.
- `score-recalc` — Wilson score for a review when its votes change. Debounced 30s per review.
- `moderation-flag` — runs profanity check on a new review; if positive, marks review pending and creates an internal report.

External API calls (OFF, UPCitemdb, Expo Push) go through a circuit breaker (`opossum`). On open circuit, the lookup endpoint gracefully returns "not found" so the user can enter manually; notifications retry with exponential backoff.

---

## 5. Data model

Key tables (Postgres, managed via Prisma migrations).

### users

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| email | citext unique | |
| email_verified_at | timestamptz | null until verified |
| password_hash | text | nullable (social-only users) |
| first_name | text | |
| last_name | text | |
| country | char(2) | ISO-3166 alpha-2 |
| avatar_url | text | |
| role | enum | `user`, `admin` |
| status | enum | `active`, `suspended`, `deleted` |
| theme_preference | enum | `aurora`, `bento`, `clay`, `material` (default `aurora`) |
| totp_secret | text | nullable; encrypted at rest; required to be set for `role = 'admin'` |
| totp_enabled_at | timestamptz | nullable |
| created_at, updated_at, last_seen_at | timestamptz | |

### auth_credentials

One row per linked credential. Lets a user combine password + Google + Apple + passkey.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| type | enum | `password`, `google`, `apple`, `passkey` |
| provider_user_id | text | Google `sub`, Apple `sub`, or passkey credential ID |
| public_key | bytea | passkeys only |
| counter | bigint | passkeys only |
| metadata | jsonb | provider-specific |
| created_at, last_used_at | timestamptz | |

Unique on `(type, provider_user_id)`.

### sessions

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| refresh_token_hash | text | sha256 of opaque token |
| device_info | jsonb | platform, version, model |
| ip | inet | last-seen IP |
| expires_at | timestamptz | |
| revoked_at | timestamptz | |

### products

Shared catalog. One row per unique scannable item.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| barcode | text unique | nullable |
| qr_payload | text unique | nullable |
| name | text | |
| brand | text | |
| category | text | |
| image_url | text | |
| default_shelf_life_days | int | optional hint for new records |
| source | enum | `off`, `upcitemdb`, `user` |
| source_id | text | |
| rating_avg | numeric(3,2) | denormalized |
| rating_count | int | denormalized |
| review_count | int | denormalized |
| created_by_user_id | uuid fk users | |
| status | enum | `active`, `pending`, `merged_into` |
| merged_into_product_id | uuid fk products | for soft-merge |
| created_at, updated_at | timestamptz | |

GIN trigram index on `(name, brand)` for fuzzy search.

### records

A user's personal pantry items. Private.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| product_id | uuid fk products | nullable (manual records) |
| custom_name | text | when no product |
| expiry_date | date | |
| purchase_date | date | nullable |
| quantity | numeric | |
| unit | text | "pcs", "g", "ml" |
| notes | text | |
| photo_url | text | |
| status | enum | `active`, `consumed`, `discarded`, `expired` |
| notify_at | jsonb | array of timestamptz, pre-computed |
| client_id | uuid unique | offline-first idempotency |
| created_at, updated_at, consumed_at | timestamptz | |

### reviews

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| product_id | uuid fk products | |
| rating | smallint | 1–5, required |
| body | text | nullable |
| upvote_count | int | denormalized |
| downvote_count | int | denormalized |
| score | numeric | Wilson lower bound |
| status | enum | `visible`, `hidden`, `deleted` |
| created_at, updated_at | timestamptz | |

Unique `(user_id, product_id)`.

### review_votes

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| review_id | uuid fk reviews | |
| value | smallint | -1 or 1 |
| created_at | timestamptz | |

Unique `(user_id, review_id)`.

### reports

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| reporter_id | uuid fk users | |
| target_type | enum | `review`, `user`, `product` |
| target_id | uuid | polymorphic |
| reason | enum | `spam`, `abuse`, `incorrect`, `other` |
| body | text | optional detail |
| status | enum | `open`, `resolved`, `dismissed` |
| resolved_by_admin_id | uuid fk users | |
| resolved_at | timestamptz | |
| created_at | timestamptz | |

### push_tokens

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| expo_push_token | text unique | |
| platform | enum | `ios`, `android` |
| device_info | jsonb | |
| created_at, last_used_at, revoked_at | timestamptz | |

### admin_audit_log

Append-only. Every admin write action.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| admin_id | uuid fk users | |
| action | text | e.g., `user.suspend`, `product.merge` |
| target_type, target_id | text, text | |
| diff | jsonb | before/after |
| request_id | text | correlation ID |
| ip | inet | |
| created_at | timestamptz | |

---

## 6. API design

Fastify, prefix `/v1`. All endpoints validate input/output against Zod schemas in `packages/shared`.

### 6.1 Auth

```
POST   /auth/register                    email + password → {user, tokens}
POST   /auth/login                       password
POST   /auth/oauth/google                exchanges Google id_token
POST   /auth/oauth/apple                 exchanges Apple identity_token
POST   /auth/passkey/register/options    WebAuthn challenge
POST   /auth/passkey/register/verify     saves public key
POST   /auth/passkey/login/options
POST   /auth/passkey/login/verify
POST   /auth/refresh                     rotates refresh token
POST   /auth/logout
POST   /auth/forgot-password             magic link
POST   /auth/reset-password
GET    /auth/verify-email?token=...
POST   /auth/resend-verification
GET    /auth/me
```

### 6.2 Products

```
POST   /products/lookup                  { barcode | qr } → product (cache → OFF → UPCitemdb → null)
GET    /products/search?q=...            pg_trgm fuzzy search
GET    /products/:id                     full product + top reviews
POST   /products                         manual create when scan returned nothing
PATCH  /products/:id                     user-suggested edits → moderation queue
```

### 6.3 Records

```
GET    /records?status=&sort=expiry      paginated
POST   /records                          requires Idempotency-Key from client_id
PATCH  /records/:id
DELETE /records/:id
POST   /records/sync                     batch endpoint for offline queue
```

### 6.4 Reviews and votes

```
GET    /products/:id/reviews?sort=score|new|rating
POST   /products/:id/reviews
PATCH  /reviews/:id                      own only
DELETE /reviews/:id                      own only
POST   /reviews/:id/vote                 { value: -1 | 1 } — idempotent upsert
DELETE /reviews/:id/vote
```

### 6.5 Reports

```
POST   /reports                          { target_type, target_id, reason, body? }
```

### 6.6 Profile

```
PATCH  /me                               first_name, last_name, country, avatar_url
POST   /me/avatar                        multipart upload
POST   /me/push-token
DELETE /me/push-token/:id
DELETE /me                               soft-delete account
```

### 6.7 Admin

Separate router; every endpoint requires `role = 'admin'`. Every mutation appends to `admin_audit_log`.

```
GET    /admin/users
GET    /admin/users/:id
PATCH  /admin/users/:id                  status, role, name
POST   /admin/users/:id/sessions/revoke-all
POST   /admin/users/:id/impersonate      audit-logged

GET    /admin/products
PATCH  /admin/products/:id
POST   /admin/products/:id/merge         { winner_id, loser_ids[] }

GET    /admin/reviews
PATCH  /admin/reviews/:id/status

GET    /admin/reports?status=open
PATCH  /admin/reports/:id/resolve

GET    /admin/analytics/overview
GET    /admin/analytics/scans
GET    /admin/analytics/reviews
GET    /admin/analytics/geography

GET    /admin/system/queue-health
GET    /admin/system/push-logs
GET    /admin/system/api-errors
GET    /admin/system/external-apis

GET    /admin/settings/feature-flags
PATCH  /admin/settings/feature-flags
GET    /admin/settings/notification-templates
PATCH  /admin/settings/notification-templates/:id
GET    /admin/settings/moderation
PATCH  /admin/settings/moderation
GET    /admin/settings/admins
POST   /admin/settings/admins/invite
PATCH  /admin/settings/admins/:id
```

### 6.8 Cross-cutting concerns

- **Errors:** RFC 7807 problem+json with `type`, `title`, `status`, `detail`, `instance`, plus a stable `code` for client matching.
- **Rate limiting:** Redis-backed. Defaults: 60/min per user, 30/min per IP. `/auth/*` tighter at 10/min per IP.
- **Idempotency:** writes accept `Idempotency-Key` header. Required on `POST /records` and `POST /reviews/:id/vote`. Stored in Redis 24h.
- **Logging:** pino, JSON, with `request_id` propagated to BullMQ jobs.
- **CORS:** restricted to mobile app origin (`exp://`, `pantry://`) and the admin domain.

---

## 7. Mobile app

### 7.1 Stack

- Expo SDK (latest stable), React Native, TypeScript
- Expo Router (file-based)
- Zustand for UI state, TanStack Query for server state
- NativeWind (Tailwind for React Native) consuming theme tokens
- WatermelonDB for offline-first local storage
- expo-camera with `expo-barcode-scanner` for combined barcode + QR scanning (one library, both formats)
- `@react-native-ml-kit/text-recognition` for on-device OCR
- `expo-secure-store` for tokens
- `expo-notifications` for push registration; Expo Push for delivery
- `@react-native-google-signin/google-signin`, `expo-apple-authentication`
- `react-native-passkey` for WebAuthn

### 7.2 Folder structure

```
apps/mobile/
├── app/                          Expo Router routes
│   ├── (auth)/
│   │   ├── welcome.tsx
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   ├── forgot-password.tsx
│   │   └── verify-email.tsx
│   ├── (app)/
│   │   ├── _layout.tsx           bottom tabs
│   │   ├── (tabs)/
│   │   │   ├── home.tsx
│   │   │   ├── browse.tsx
│   │   │   ├── reviews.tsx
│   │   │   └── profile.tsx
│   │   ├── scan.tsx
│   │   ├── record/[id].tsx
│   │   ├── product/[id].tsx
│   │   ├── product/[id]/review.tsx
│   │   └── settings/
│   │       ├── index.tsx
│   │       ├── theme.tsx
│   │       ├── notifications.tsx
│   │       └── account.tsx
│   └── _layout.tsx               root: auth gate, theme provider
├── src/
│   ├── api/                      TanStack Query hooks per endpoint
│   ├── auth/                     session store, secure storage, social SDKs
│   ├── db/                       WatermelonDB models + sync engine
│   ├── components/               Button, Card, Input, FAB, etc.
│   ├── features/                 scan/, expiry/, reviews/, voting/
│   ├── lib/                      date, country, formatters
│   └── theme/                    consumes packages/theme tokens
└── assets/
```

### 7.3 Core flows

| Flow | Screens |
|---|---|
| Onboarding | welcome → sign-up → verify-email → first-scan tutorial overlay |
| Sign-in | welcome → sign-in (password / Google / Apple / passkey) → home |
| Add a record | home → FAB → scan (or manual) → expiry (manual or OCR) → save → home |
| Review a product | product/[id] → review form → submit → product/[id] |
| Vote on a review | inline thumbs on product/[id], optimistic update |
| Switch theme | profile → settings → theme → preview → saved instantly |

### 7.4 Permissions

Requested at the moment of need, never up front:

- Camera — first time the user taps Scan
- Notifications — after the first record is saved
- Photo library — only if user taps "use photo for OCR"
- Location — never; country is derived from IP at signup

### 7.5 Theme system

Each theme is a token object: `{ colors, radii, shadows, typography, spacing, animations }`. Components consume tokens via a `useTheme()` hook backed by Zustand. Switching themes mutates the store; the whole app re-themes with a 200ms cross-fade. The user's choice persists to `expo-secure-store` and syncs to `users.theme_preference` on the server.

The four shipped themes:

1. **Aurora Glass** (default) — flowing gradient mesh, frosted glass cards, soft neon accents
2. **Bento Grid** — modular asymmetric tiles, light surface, single accent
3. **Soft Clay** — warm peach palette, chunky 3D depth, rounded everything
4. **Material You** — Google MD3 dynamic purple, chips and pills, friendly Android-native

---

## 8. Admin dashboard

### 8.1 Stack

Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + TanStack Query + TanStack Table. Server components for data-heavy pages, client components for interactivity. Same Zod schemas from `packages/shared`.

### 8.2 Auth and security posture

- Logs in against the same `/auth/login`, gated by `users.role = 'admin'`
- Tokens in HTTP-only cookies (not localStorage)
- TOTP second factor required for `role = 'admin'` accounts. Secret is generated at first admin login (or when an existing user is promoted), shown once as a QR code, then stored encrypted in `users.totp_secret`. Login endpoint returns `requires_totp: true` and a one-time challenge token; admin web exchanges challenge + 6-digit code for full session.
- nginx vhost behind IP allowlist
- CSRF protection on cookie-based mutations
- Every admin mutation writes to `admin_audit_log`

### 8.3 Pages

```
/login
/                                  Overview dashboard
/users                             list, filter, search
/users/[id]                        detail: profile, sessions, records, reviews, reports
/products                          list with rating/review counts
/products/[id]                     detail + edit + merge
/products/pending                  user-submitted edits awaiting approval
/reviews                           filter by status/rating
/reviews/[id]                      detail + vote breakdown
/reports                           open queue (default landing for moderators)
/reports/[id]                      detail + resolve
/analytics/{overview,scans,reviews,geography}
/system/{queue,push,api-errors,external-apis}
/settings/{feature-flags,notification-templates,moderation,admins}
```

### 8.4 Notable interactions

- **Reports queue** — one-click Hide / Delete / Dismiss / Ban with confirmation
- **Product merge tool** — search duplicates, side-by-side, choose winner per field, transactional merge that repoints `records` and `reviews`
- **User detail** — sessions list with revoke buttons; "Login as" impersonation (audit-logged)
- **BullMQ dashboard** — `@bull-board/api` mounted at `/system/queue`
- **Bulk actions** on lists for moderation at scale
- **Realtime** — reports queue and queue health poll every 10s; SSE deferred to v1.1

---

## 9. Testing

| Layer | Tool | Scope |
|---|---|---|
| API unit | Vitest | services, validators, score math |
| API integration | Vitest + Supertest + testcontainers Postgres | full request cycles against real DB |
| API contract | Zod schemas in `packages/shared` | mobile + admin can't drift |
| Mobile unit | Vitest | hooks, stores, utilities |
| Mobile component | React Native Testing Library | screens render and behave |
| Mobile E2E | Maestro | sign-up, scan, add record, review, vote |
| Admin unit | Vitest | server actions, table logic |
| Admin E2E | Playwright | login, moderate report, merge product |

CI: full unit + integration on every PR. E2E nightly + on release tags.

---

## 10. Deployment

### 10.1 Provisioning

Ansible playbook in `infra/`:

- Installs Postgres 16, Redis 7, Node 20 LTS, nginx, certbot
- Creates `pantryapp` non-root user
- Drops systemd units for `pantry-api` and `pantry-admin`
- Configures nginx vhosts and obtains TLS certs
- Sets up ufw, fail2ban, logrotate

One command from a fresh VPS to running services.

### 10.2 Code deploys

GitHub Actions on `main` push:

1. Run unit + integration tests
2. Build api and admin (compile TS, prune dev deps)
3. ssh-rsync built artifacts to `/opt/pantry/releases/<sha>/`
4. Symlink `/opt/pantry/current` to the new release
5. Run Prisma migrations (`prisma migrate deploy`)
6. `systemctl reload pantry-api pantry-admin` — graceful shutdown handlers drain in-flight requests
7. Smoke test `/health/ready`; rollback on failure

Mobile:

- EAS Build for iOS and Android binaries
- EAS Update for OTA JS bundle pushes (JS-only fixes without store review)
- TestFlight + Google Play internal testing for staged rollouts

### 10.3 Secrets

- `/etc/pantry/.env.production`, mode 600, owned by `pantryapp:pantryapp`
- Loaded by systemd via `EnvironmentFile=`
- Never committed; never logged
- Annual rotation; documented runbook for emergency rotation

---

## 11. Observability and ops

- Pino structured JSON logs → file → logrotate (7 days local, optional ship to S3)
- `/health` (liveness) and `/health/ready` (DB + Redis reachable)
- UptimeRobot pings `/health` every 5 min
- Optional v1.1: Grafana + Loki + Prometheus on the same box if log volume justifies it

Runbooks in `docs/runbooks/`:

- Rollback a deploy
- Restore from backup
- Revoke all sessions
- Rotate secrets
- Incident response checklist

---

## 12. Out of scope for v1

- Multiple "locations" or "rooms" within a pantry (everything is one shelf)
- Tags or custom categories
- Shopping list / restock suggestions
- Recipes / meal planning from expiring items
- Multi-user shared pantries (households)
- Web app for end users (mobile-only)
- Server-Sent Events / WebSockets for admin (polling instead)
- Third-party analytics
- Internationalization beyond English (architecture allows it; copy isn't translated)
- Apple Watch / Android Wear companions

These are deliberately deferred. The architecture does not preclude any of them.

---

## 13. Milestones

The implementation plan(s) will divide work into:

- **M0 — Infra + Auth.** Provision VPS, scaffold monorepo, Postgres + Redis + Fastify skeleton, all auth methods (password, Google, Apple, passkeys), Expo app shell with auth flow, theme system foundation.
- **M1 — Personal pantry.** Product lookup with OFF + UPCitemdb, scan flow (barcode + QR), records CRUD, manual + OCR expiry, push notifications, offline-first sync.
- **M2 — Reviews + voting.** Reviews CRUD, voting, Wilson score, product detail screen with reviews list, profanity filter, report submission.
- **M3 — Admin.** Next.js admin app, all dashboard pages, moderation queue, audit log, analytics, system health.
- **M4 — Polish + launch.** All four themes implemented end-to-end, accessibility audit, App Store + Play Store submission, runbooks, restore drill, soft launch.
