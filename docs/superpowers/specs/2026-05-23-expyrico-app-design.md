# Expyrico — Design Spec

**Date:** 2026-05-23
**Status:** Approved (pending user review of this document)
**Topic:** Cross-platform mobile app for tracking product expiry dates with shared product reviews and a self-hosted backend

> **App name:** **Expyrico** (formerly "Pantry"). The word "pantry" still appears below as the *generic feature noun* — a user's personal list of items — not as the product name.

---

## Requirement revision — 2026-06-08 (Expyrico)

A product-requirements revision renamed the app to **Expyrico** and reshaped several v1 features. These supersede the earlier 2026-05-26 amendments where they conflict; sections noted carry the detail.

1. **Brand → Expyrico (§1, §4, §10).** App name, deep-link scheme (`expyrico://`), unix user (`expyrico`), systemd units (`expyrico-api`, `expyrico-admin`), paths (`/opt/expyrico`, `/etc/expyrico`), test DB (`expyrico_test`), monorepo root (`expyrico/`).
2. **Brand color palette (§2.10).** Full Expyrico design-system palette (see §2.10 table) — Primary Fresh Sage `#4BAE8A`, Primary Dark Deep Sage `#3A8F6F`, Primary Light Mint Mist `#D6F0E6`, Secondary Warm White `#FAFAF8`, Accent Honey `#F5A623`, Accent Light Soft Butter `#FEEFC3`, Neutral Light Stone `#F0F0ED`, Neutral Mid Pebble `#8C8C85`, Neutral Dark Almost Black `#2C2C28`. The **default theme ("Expyrico")** is built on this palette; the four-theme switcher is retained and the three secondary themes recolor to harmonize. Reserved status colors: Good `#4BAE8A`, Expiring soon `#F5A623`, Expired `#E0442A` (status only, never branding).
3. **Rating model replaced (§2.6, §5).** The taste(1–5)+value(1–5) model is **replaced** by a single three-option rating: **Will buy again** / **Will buy again on sale** / **Will not buy again**, plus an optional comment. Aggregate shows all three as separate percentages filtered by country, e.g. "65% will buy again / 20% on sale only / 15% won't (43 ratings)".
4. **Voting replaced (§2.7).** Up/down review voting is **replaced** by **Helpful / Not helpful** voting, shown **only on reviews that include a comment**. Helpful votes are independent of submitting your own rating and are **not** counted in the rating aggregate.
5. **Community ratings are barcode-only (§2.3, §2.6).** Only products added via **barcode scan** participate in community ratings/aggregates. Manually-entered items (loose produce, wet-market items) support **personal notes only** and are excluded from the community aggregate.
6. **Record fields (§2.2).** Fields: name, category, expiry date, quantity, notes; **price** and **store** hidden in an accordion. All optional except **name** and **expiry date**. Manual entry auto-suggests from the Open Food Facts database.
7. **Dashboard (new §2.16).** Green/amber/red item status, summary count header, category filter, configurable "expiring soon" threshold (default **7 days**).
8. **Reminders default → [7,3,1,0] (§2.5).** Push at 7/3/1/0 days before expiry; user-configurable intervals; deep link from notification to the item. (This reverts the 2026-05-26 `[3,1,0]` default.)
9. **Item management (§2.2).** Item detail view, edit, mark used/thrown away, delete, and **duplicate** (copies all fields except expiry date).
10. **Item limit (new §2.17).** 50-item cap; upgrade-prompt CTA at the limit; read-only mode when the cap is hit (reminders still fire).
11. **Referral → passive (§2.14, M7).** Unique referral code per user, shareable via native share sheet, referrer code captured on signup, activation = referee adds 5 items. Data stored only — **no rewards, points, or badges until V2**.
12. **Household → sub-users under one account (§2.15, M8).** Multiple member profiles under one owning account, per-owner item tracking, shared dashboard view. Replaces the earlier separate-accounts-with-invites model.
13. **Settings (new §2.18).** Edit profile, notification preferences, view/share referral code, item count display (X of 50), delete account, and a "Contact us" email link / feedback form for bug reports and feedback.

---

## Validation amendments — 2026-05-26

Two contract clarifications resolved during plan validation. They refine this spec; the implementation plans (M0–M4) follow these:

1. **API field casing is camelCase.** The data-model (§5) and API (§6) tables below spell columns/fields in snake_case for readability, but the **wire contract** (JSON request/response bodies consumed by the TS mobile and admin clients) uses **camelCase** — e.g. `requiresTotp`, `themePreference`, `emailVerifiedAt`. Database column names remain snake_case via Prisma `@map`. Stable error `code` strings (§6.8) stay snake_case (e.g. `email_not_verified`), as they are identifiers, not field names.
2. **Review writes are online-only.** §2.11's conflict-policy line lists "my reviews" under last-write-wins offline data. This is amended: a user's own review create/edit/delete are **online-only** TanStack mutations (server is the source of truth), because reviews require server-side validation (one-per-product uniqueness, profanity moderation, vote integrity). The offline write queue covers `records` only. Reads of reviews remain cached locally.

## Feature additions — 2026-05-26

Approved new-feature decisions. These extend the spec; details live in the sections noted:

1. **Notification default changed (§2.5).** ⚠️ **SUPERSEDED by the 2026-06-08 revision (item 8).** Default reminder schedule is now `[7, 3, 1, 0]` (7/3/1/0 days). ~~Previously this amendment set `[3, 1, 0]`.~~ Per-user/per-record overrides unchanged.
2. **Reviews now have two required criteria (§2.6, §5).** ⚠️ **SUPERSEDED by the 2026-06-08 revision (item 3) — see top of file.** The taste+value model below was replaced by the three-option rating (`buy_again` / `buy_again_on_sale` / `wont_buy`). Retained here only as change history. ~~Each review requires a taste rating (1–5) and a value rating (1–5)...~~
3. **New v1.x social/growth features added (§2.12–§2.15, §13 M5–M8).** Four milestones layered on top of v1 M0–M4: deal sharing (deals on catalog products with price/store/photo/expiry, browsable feed, up/down votes via `deal_votes`, reportable); blessing/giveaway (free local pickup, request → giver picks recipient → mutual transaction rating, coordination by pickup note + push, no in-app chat); referral (⚠️ **reshaped by 2026-06-08 item 11 → passive tracking, no rewards/points/badges until V2**); household sharing (⚠️ **reshaped by 2026-06-08 item 12 → sub-users under one account, not separate-account invites**).
4. **Households moved in-scope (§12).** "Multi-user shared pantries (households)" removed from the out-of-scope list — now delivered as milestone M8.

---

## 1. Overview

A cross-platform mobile app (iOS + Android) that lets users:

- Sign up and sign in via email + password, Google, Apple, or passkey
- Scan product barcodes (UPC/EAN) and QR codes
- Track expiry dates of items they own (their personal pantry)
- Receive push notifications before items expire
- Rate products in a shared global catalog (three-option) and optionally comment
- Mark others' comments Helpful / Not helpful

The app ships with four switchable visual themes (Expyrico (default), Bento Grid, Soft Clay, Material You), all built on the Expyrico brand palette (§2.10).

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

- Each user owns private records of items they have. Records are not visible to other users (household sharing in §2.15 is the one exception).
- A record can optionally link to a product in the shared catalog (via barcode/QR scan), or be fully manual (custom name).
- **Source flag:** every record/product carries whether it originated from a **barcode scan** or **manual entry**. Only barcode-sourced products participate in community ratings (§2.6); manual items support personal notes only.
- **Fields:** `name`, `category`, `expiry_date`, `quantity`, `notes`, plus `price` and `store` surfaced in a collapsed **accordion** (advanced/optional). All fields are optional **except `name` and `expiry_date`**.
- On manual entry, the name field **auto-suggests** from the Open Food Facts catalog; if no product matches, the user creates their own entry (`source = 'user'`).
- Status lifecycle: `active` → `consumed` | `discarded` | `expired`.
- **Item actions:** detail view, edit, mark used (`consumed`) / thrown away (`discarded`), delete, and **duplicate** — duplicate copies all fields **except `expiry_date`** (which is re-entered).
- **Item limit:** a free account is capped at **50 active records** (§2.17).

### 2.3 Scanning

- The mobile app accepts both **product barcodes (UPC/EAN/EAN-13/UPC-A)** and **QR codes** through one camera flow. The scanner detects either format and routes accordingly.
- After a successful scan, the app calls `POST /products/lookup` with the decoded value.
- The lookup hierarchy is:
  1. Local Postgres `products` cache (instant)
  2. Open Food Facts API (food)
  3. UPCitemdb API (non-food fallback)
  4. If nothing matches: prompt user to enter product details manually; manual product is saved to the catalog with `source = 'user'`.
- **Community-rating eligibility:** products resolved from a **barcode scan** (`source` `off`/`upcitemdb`, or a `user` product that carries a barcode) are eligible for community ratings (§2.6). Purely manual records with no barcode are **personal-notes-only** and never enter the community aggregate. Synonym/naming variation is therefore a non-issue: loose produce is excluded, and packaged products follow Open Food Facts naming where available.

### 2.4 Expiry date capture

The app supports two ways to capture an expiry date:

- **Manual entry** — date picker after the scan
- **OCR** — user taps a "scan date" button that opens the camera; on-device ML Kit text recognition extracts a date and pre-fills the picker. User confirms before saving.

OCR runs entirely on-device. No image data is sent to the backend.

### 2.5 Notifications

- Push notifications via Expo Push Notifications service.
- Default schedule per record: **7 days before expiry, 3 days before, 1 day before, on expiry day** (default `offsetsDays` `[7, 3, 1, 0]`). User can adjust intervals globally or per record.
- Tapping a notification **deep-links** straight to that item's detail view (`expyrico://record/:id`).
- Scheduled jobs are computed when a record is created/updated and stored in `records.notify_at`. BullMQ delayed jobs fire them via Expo Push.

### 2.6 Reviews and ratings

- A rating is a single **three-option choice** attached to a `(user, product)` pair: `buy_again` ("Will buy again"), `buy_again_on_sale` ("Will buy again on sale"), or `wont_buy` ("Will not buy again"). An **optional written comment** may accompany it.
- **Barcode-only:** ratings exist only for products that are community-eligible (barcode-sourced, §2.3). Manual personal-notes-only items have no community rating.
- One rating per user per product. **Editable.** Soft-deletable.
- **Aggregate (country-scoped):** product detail shows all three options as separate percentages plus a total count, e.g. **"65% will buy again / 20% on sale only / 15% won't (43 ratings)"**. The aggregate is filtered by the viewer's `users.country` so both quality and price signals are country-specific.
- **Aggregate logic:** computed **only** from users who submitted their own rating. Helpful/Not-helpful votes (§2.7) are **not** counted toward the aggregate.
- Reviews (ratings that include a comment) display sorted by helpfulness (Wilson score over helpful/not-helpful) by default; "Newest" is an alternative sort.

### 2.7 Helpful / Not-helpful voting

- On any review **that includes a written comment**, other users can mark it **Helpful** or **Not helpful**. Reviews with no comment show no voting affordance.
- Voting is **independent** of submitting your own rating — a user may vote on others' comments whether or not they have rated the product themselves.
- A user can change or remove their vote. Constraint: one vote per (user, review).
- Helpful/Not-helpful counts and the Wilson helpfulness score are denormalized on the review row and updated by a debounced background job. These votes never affect the rating aggregate (§2.6).

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

- **Default theme: "Expyrico"**, built on the brand design system below. The four-theme switcher is retained: Expyrico (default), Bento Grid, Soft Clay, Material You — the three secondaries recolor to harmonize with the Expyrico palette.
- User can switch themes in Settings → Theme. Choice persists locally and syncs to user profile.
- Each theme is a token object: `{ colors, radii, shadows, typography, spacing, animations }`. Components consume tokens; never raw values.
- Theme switch animation: 200ms cross-fade.

**Expyrico color palette (design tokens):**

| Token | Name | Hex | Usage |
|---|---|---|---|
| `primary` | Fresh Sage | `#4BAE8A` | logo, headers, active states |
| `primaryDark` | Deep Sage | `#3A8F6F` | pressed states, text on light bg |
| `primaryLight` | Mint Mist | `#D6F0E6` | soft panels, success highlights |
| `secondary` | Warm White | `#FAFAF8` | main background, cards |
| `accent` | Honey | `#F5A623` | CTAs, badges, highlights |
| `accentLight` | Soft Butter | `#FEEFC3` | expiring-soon status background |
| `neutralLight` | Stone | `#F0F0ED` | section backgrounds, dividers |
| `neutralMid` | Pebble | `#8C8C85` | secondary text, icons |
| `neutralDark` | Almost Black | `#2C2C28` | primary text |

**Reserved status colors** (status only, never branding):

| Status | Hex | Note |
|---|---|---|
| Good | `#4BAE8A` | reuses primary |
| Expiring soon | `#F5A623` | reuses accent; `#FEEFC3` as its tile background |
| Expired | `#E0442A` | Alert Red — status only |

All themes must meet **WCAG AA** contrast (§3) — re-verify after recolor.

### 2.11 Offline-first

- All reads come from local WatermelonDB.
- All writes go to WatermelonDB first, then a sync engine pushes them to the API.
- Every write generates a `client_id` (UUID) used as `Idempotency-Key` so retries cannot duplicate.
- Sync triggers: app foreground, network reconnect, after every local write, every 5 min while foregrounded.
- Sync uses `?since=<timestamp>` for delta pulls.
- Conflict policy: last-write-wins on user-owned data (records, my ratings); server wins on shared data (product details, helpful/not-helpful counts on others' reviews). Household-owned shared records are server-authoritative (§2.15).

### 2.12 Deal sharing (v1.x — M5)

- A deal links to a catalog product and carries a price, a store (free-text name/location), and an optional photo and/or expiry.
- Deals appear in a **country-scoped** browsable feed — filtered by the viewer's `users.country` (derived from IP at signup, §2.9); a viewer with no country sees a global fallback. No precise geolocation is used.
- Other users can upvote/downvote a deal (one vote per user per deal, tracked in `deal_votes`); a user can change or remove their vote.
- Deals are reportable like other content.

### 2.13 Blessing / giveaway (v1.x — M6)

- A user can list an item for free local pickup, optionally linked to a pantry record. Giveaways appear in a **country-scoped** feed (by the viewer's `users.country`, global fallback when absent).
- Other users request the item; the giver picks a recipient. Pickup notes from claimants are withheld from the giver until a claim is selected.
- Handover is two-phase: the giver marks the item handed off and the recipient confirms receipt before the giveaway completes. Both parties then leave a **blind** mutual transaction rating (giver↔recipient).
- Coordination happens via a pickup note plus push notifications — there is no in-app chat.

### 2.14 Referral tracking — passive (v1.x — M7)

- Each user has a **unique referral code**, shareable through the native share sheet (WhatsApp, Telegram, etc.).
- On signup, a referee may enter a referrer's code; the code attributes the new signup to the referrer. (Auto-opening universal/app links are deferred — the shared code is entered in-app at signup.)
- **Activation condition:** a referral is marked *activated* once the referee adds **5 items**.
- **Passive in v1.x:** attribution and activation data are **stored only**. There are **no rewards, points, or badges until V2**. No leaderboard, no payments. (Anti-abuse velocity/clustering checks become relevant when rewards land in V2.)

### 2.15 Household sharing — sub-users under one account (v1.x — M8)

- An owning account can host **multiple member profiles (sub-users)** under it; there is no separate-account invite/approval flow in v1.x.
- **Per-owner item tracking:** every shared record records which member profile owns it, so the household can see who added what.
- **Shared dashboard view:** members see a combined household dashboard (all members' records) alongside per-owner attribution and filtering.
- Shared household records are server-authoritative (no offline last-write-wins for household-owned records).
- Expiry reminders for a shared record fan out to the relevant member profiles, each using its own reminder schedule (default `[7,3,1,0]`); membership changes reschedule accordingly.

### 2.16 Dashboard (home)

- **Status tiers** per item, by days-to-expiry: **green** (good), **amber** (expiring soon, within the threshold), **red** (expired). Colors map to the reserved status palette (§2.10): green `#4BAE8A`, amber `#F5A623`, red `#E0442A`.
- **Summary count header** — total items plus a breakdown of how many are good / expiring soon / expired.
- **Category filter** — filter the list by item `category`.
- **Configurable "expiring soon" threshold** — default **7 days**; user-adjustable in Settings. Drives the amber tier boundary and (independently) reminder defaults.

### 2.17 Item limit

- A free account is capped at **50 active records**.
- At the cap, the add-item flow shows an **upgrade-prompt CTA** instead of creating a new record.
- The account enters **read-only mode** for adds (existing records still editable/consumable/deletable, and **expiry reminders still fire**). Deleting/consuming items frees slots and lifts read-only mode.

### 2.18 Settings

- Edit profile (name, country, avatar; email edit re-verifies — §2.9).
- Notification preferences (reminder intervals, expiring-soon threshold).
- View / share referral code (§2.14).
- Item count display — **"X of 50"**.
- Delete account (soft-delete — §6.6).
- **Contact us** — a simple email link / feedback form for bug reports and feedback.

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
expyrico/
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
- **api** (Fastify, Node 20 LTS) — runs as a `expyrico` user under a systemd unit, port 4000.
- **admin** (Next.js, Node 20 LTS) — runs as `expyrico` under systemd, port 4001.
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
- Secrets in `/etc/expyrico/.env.production`, owned by `expyrico:expyrico`, mode 600
- Renovate bot for dependency upgrades; weekly `npm audit` in CI

### 4.3 Background jobs (BullMQ on Redis)

- `product-lookup` — async fetch from OFF and UPCitemdb when local cache misses; persists result.
- `notification-schedule` — recomputes a record's `notify_at` array and enqueues delayed `notification-send` jobs.
- `notification-send` — fires a single Expo Push at the scheduled time.
- `score-recalc` — Wilson helpfulness score for a review when its helpful/not-helpful votes change. Debounced 30s per review.
- `rating-recalc` — recomputes the per-country rating rollup (`buy_again`/`buy_again_on_sale`/`wont_buy` tallies, §5) for a product when a rating is added/edited/removed. Debounced per product.
- `moderation-flag` — runs profanity check on a new review comment; if positive, marks review pending and creates an internal report.
- `referral-activation` — marks a referral `activated_at` when its referee reaches 5 items (§2.14).

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
| theme_preference | enum | `expyrico`, `bento`, `clay`, `material` (default `expyrico`) |
| totp_secret | text | nullable; encrypted at rest; required to be set for `role = 'admin'` |
| totp_enabled_at | timestamptz | nullable |
| referral_code | text unique | this user's own shareable code (§2.14) |
| expiring_soon_threshold_days | int | default 7; drives amber tier + reminder default (§2.16) |
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
| is_community_eligible | boolean | true when barcode-sourced (has barcode); gates ratings (§2.6) |
| buy_again_count | int | denormalized rating tally |
| buy_again_on_sale_count | int | denormalized rating tally |
| wont_buy_count | int | denormalized rating tally |
| rating_count | int | denormalized total ratings |
| review_count | int | denormalized count of ratings that include a comment |
| created_by_user_id | uuid fk users | |
| status | enum | `active`, `pending`, `merged_into` |
| merged_into_product_id | uuid fk products | for soft-merge |
| created_at, updated_at | timestamptz | |

GIN trigram index on `(name, brand)` for fuzzy search.

> The `*_count` columns on `products` are a **global** denormalized fallback. The country-scoped aggregate shown on product detail (§2.6) is computed per `users.country` — either via a `product_rating_country` rollup table (`product_id, country, buy_again_count, buy_again_on_sale_count, wont_buy_count, rating_count`) refreshed by the `rating-recalc` job, or aggregated on read from `reviews ⋈ users.country`. The rollup table is preferred at the v1 scale target.

### records

A user's personal pantry items. Private (unless shared to a household — §2.15).

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | owning member profile |
| household_id | uuid fk households | nullable; set when shared (§2.15) |
| product_id | uuid fk products | nullable (manual records) |
| custom_name | text | when no product |
| category | text | item category (drives dashboard filter) |
| expiry_date | date | required |
| purchase_date | date | nullable |
| quantity | numeric | |
| unit | text | "pcs", "g", "ml" |
| price | numeric(10,2) | nullable; accordion field |
| store | text | nullable; accordion field |
| notes | text | |
| photo_url | text | |
| status | enum | `active`, `consumed`, `discarded`, `expired` |
| notify_at | jsonb | array of timestamptz, pre-computed |
| client_id | uuid unique | offline-first idempotency |
| created_at, updated_at, consumed_at | timestamptz | |

### reviews

A rating is one three-option choice per `(user, product)`, with an optional comment.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| product_id | uuid fk products | must be community-eligible (§2.6) |
| rating | enum | `buy_again`, `buy_again_on_sale`, `wont_buy` — required |
| body | text | nullable; voting only shown when present (§2.7) |
| helpful_count | int | denormalized |
| not_helpful_count | int | denormalized |
| score | numeric | Wilson lower bound over helpful/not-helpful |
| status | enum | `visible`, `hidden`, `deleted` |
| created_at, updated_at | timestamptz | |

Unique `(user_id, product_id)`.

### review_votes

Helpful / Not-helpful votes on reviews that carry a comment. Independent of the voter's own rating (§2.7).

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | |
| review_id | uuid fk reviews | |
| helpful | boolean | true = helpful, false = not helpful |
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

### households / household_members (§2.15 — sub-users under one account)

`households` — one row per owning account's household.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| owner_user_id | uuid fk users | the account that owns the household |
| name | text | display name |
| created_at, updated_at | timestamptz | |

`household_members` — member profiles (sub-users) under a household.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| household_id | uuid fk households | |
| user_id | uuid fk users | the profile/sub-user |
| role | enum | `owner`, `member` |
| created_at | timestamptz | |

Unique `(household_id, user_id)`. A shared `records.household_id` + `records.user_id` gives per-owner tracking on the shared dashboard.

### referrals (§2.14 — passive)

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| referrer_user_id | uuid fk users | owner of the code |
| referee_user_id | uuid fk users | new signup that entered the code |
| code | text | referral code used |
| activated_at | timestamptz | set when referee reaches 5 items; null until then |
| created_at | timestamptz | |

Unique `(referee_user_id)` (a signup is attributed once). `users.referral_code` (text unique) holds each user's own shareable code. No rewards/points columns in v1.x — passive only.

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
GET    /records?status=&category=&sort=expiry      paginated; category filter (§2.16)
POST   /records                          requires Idempotency-Key from client_id; 409 at 50-item cap (§2.17)
PATCH  /records/:id
DELETE /records/:id
POST   /records/:id/duplicate            copies all fields except expiry_date (§2.2)
POST   /records/sync                      batch endpoint for offline queue
```

### 6.4 Reviews (ratings) and helpful votes

```
GET    /products/:id/reviews?sort=helpful|new       country-scoped aggregate + comment list
POST   /products/:id/reviews                         { rating, body? } — product must be community-eligible
PATCH  /reviews/:id                                  own only — edit rating/comment
DELETE /reviews/:id                                  own only
POST   /reviews/:id/helpful                           { helpful: true | false } — idempotent upsert; review must have a comment
DELETE /reviews/:id/helpful
```

`rating` ∈ `buy_again | buy_again_on_sale | wont_buy`. The aggregate in the GET response is filtered by the requester's `users.country` and returns the three percentages + `ratingCount` (helpful votes excluded).

### 6.5 Reports

```
POST   /reports                          { target_type, target_id, reason, body? }
```

### 6.6 Profile, referral, household

```
PATCH  /me                               first_name, last_name, country, avatar_url, expiring_soon_threshold_days
POST   /me/avatar                        multipart upload
POST   /me/push-token
DELETE /me/push-token/:id
DELETE /me                               soft-delete account
GET    /me/usage                         { itemCount, itemLimit: 50, readOnly } (§2.17)
GET    /me/referral                      { code, shareUrl, activatedCount } (§2.14)
POST   /feedback                         { subject, body } — Contact-us / bug report (§2.18)

GET    /households/:id                    members + shared records
POST   /households                        create household
POST   /households/:id/members            add a member profile (sub-user)
DELETE /households/:id/members/:userId
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
- **Idempotency:** writes accept `Idempotency-Key` header. Required on `POST /records` and `POST /reviews/:id/helpful`. Stored in Redis 24h.
- **Logging:** pino, JSON, with `request_id` propagated to BullMQ jobs.
- **CORS:** restricted to mobile app origin (`exp://`, `expyrico://`) and the admin domain.

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

The four shipped themes (all built on the Expyrico palette, §2.10):

1. **Expyrico** (default) — Fresh Sage primary, Warm White surfaces, Honey accents; clean and calm
2. **Bento Grid** — modular asymmetric tiles, Stone surfaces, single Honey accent
3. **Soft Clay** — warm Mint Mist / Soft Butter palette, chunky 3D depth, rounded everything
4. **Material You** — Google MD3 dynamic theming seeded from Fresh Sage, chips and pills, Android-native

All four keep the reserved status colors (Good `#4BAE8A` / Expiring soon `#F5A623` / Expired `#E0442A`) and must pass WCAG AA (§3).

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
| API integration | Vitest + Supertest + dedicated test Postgres database | full request cycles against real DB; locally a separate `expyrico_test` schema, in CI a GitHub Actions Postgres service |
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
- Creates `expyrico` non-root user
- Drops systemd units for `expyrico-api` and `expyrico-admin`
- Configures nginx vhosts and obtains TLS certs
- Sets up ufw, fail2ban, logrotate

One command from a fresh VPS to running services.

### 10.2 Code deploys

GitHub Actions on `main` push:

1. Run unit + integration tests
2. Build api and admin (compile TS, prune dev deps)
3. ssh-rsync built artifacts to `/opt/expyrico/releases/<sha>/`
4. Symlink `/opt/expyrico/current` to the new release
5. Run Prisma migrations (`prisma migrate deploy`)
6. `systemctl reload expyrico-api expyrico-admin` — graceful shutdown handlers drain in-flight requests
7. Smoke test `/health/ready`; rollback on failure

Mobile:

- EAS Build for iOS and Android binaries
- EAS Update for OTA JS bundle pushes (JS-only fixes without store review)
- TestFlight + Google Play internal testing for staged rollouts

### 10.3 Secrets

- `/etc/expyrico/.env.production`, mode 600, owned by `expyrico:expyrico`
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
- Web app for end users (mobile-only)
- Server-Sent Events / WebSockets for admin (polling instead)
- Third-party analytics
- Internationalization beyond English (architecture allows it; copy isn't translated)
- Apple Watch / Android Wear companions

These are deliberately deferred. The architecture does not preclude any of them.

---

## 13. Milestones

> **Build order (2026-05-26): backend + admin first.** Execution runs in two tracks — the entire **Backend + Admin track** (all `api/` + `apps/admin/` work) is built, tested, and deployed before **any** mobile work begins (the **Mobile track**). The vertical milestones (M1, M2, M5–M8) are split: their backend/admin phases run in the first track, their mobile phases in the second. Authoritative sequence: `docs/superpowers/plans/2026-05-26-build-order-backend-first.md`. Each plan carries an `## Execution order — backend-first` header with its per-phase split.
>
> - **Track A (Backend + Admin):** M0a → M0b → M0d → M1 (backend) → M2 (backend) → M3 → M5–M8 (backend + admin).
> - **Track B (Mobile):** M0c → M1 (mobile) → M2 (mobile) → M5–M8 (screens) → M4.

The milestones divide work into:

- **M0 — Infra + Auth.** Provision VPS, scaffold monorepo, Postgres + Redis + Fastify skeleton, all auth methods (password, Google, Apple, passkeys), Expo app shell with auth flow, theme system foundation.
- **M1 — Personal pantry.** Product lookup with OFF + UPCitemdb, scan flow (barcode + QR), records CRUD with category/price/store fields + duplicate action, manual entry with OFF auto-suggest, manual + OCR expiry, dashboard (green/amber/red tiers + summary header + category filter + configurable threshold), push notifications (default `[7,3,1,0]` + deep link), 50-item limit + read-only mode, offline-first sync.
- **M2 — Reviews + ratings.** Three-option rating (`buy_again`/`buy_again_on_sale`/`wont_buy`) + optional comment, country-scoped 3-percentage aggregate (barcode-only products), Helpful/Not-helpful voting on commented reviews, Wilson helpfulness score, product detail screen, profanity filter, report submission.
- **M3 — Admin.** Next.js admin app, all dashboard pages, moderation queue, audit log, analytics, system health.
- **M4 — Polish + launch.** All four themes (recolored to the Expyrico palette) implemented end-to-end, accessibility audit (WCAG AA), App Store + Play Store submission, runbooks, restore drill, soft launch.

The following v1.x social/growth milestones layer on top of the v1 M0–M4 set:

- **M5 — Deal sharing.** Deals linked to catalog products with price + store + optional photo/expiry, browsable feed, up/down voting (`deal_votes`), reportable.
- **M6 — Blessing / giveaway.** List items for free local pickup, request → giver picks recipient → mutual transaction rating, coordination via pickup note + push (no in-app chat).
- **M7 — Referral + app sharing (passive).** Unique referral code per user, native share sheet, referrer code captured at signup, activation when referee adds 5 items. Data stored only — **no rewards/points/badges until V2**.
- **M8 — Household sharing (sub-users).** Multiple member profiles under one owning account; per-owner item tracking; shared dashboard view; server-authoritative shared records; reminder fan-out to member profiles.
