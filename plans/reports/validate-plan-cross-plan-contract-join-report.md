# Cross-Plan Validation — Contract Join Report

**Date:** 2026-05-26
**Scope:** All 9 plans in `docs/superpowers/plans/` + spec `2026-05-23-pantry-app-design.md`
**Method:** 6 parallel per-milestone reviews → each produced PROVIDES manifest + verbatim CONSUMES list → joined here. Project is greenfield (no code yet); "validation" = internal consistency + cross-plan contract consistency + spec coverage.
**Per-milestone reports:** `validate-plan-m0a-m0b-backend-auth-report.md`, `...-m0c-mobile-shell-report.md`, `...-m0d-admin-infra-report.md`, `...-m1-pantry-report.md`, `...-m2-reviews-voting-report.md`, `...-m3-m4-admin-polish-report.md`.

---

## Dependency chain

```
M0a (foundation) → M0b (auth routes) → M0c (mobile shell) ┐
                                      → M0d (admin shell + infra) ┤
                                                                  ├→ M1 (pantry) → M2 (reviews) → M3 (admin dash) → M4 (polish)
mobile-mockup-prototype (standalone, gitignored output)
```

---

## A. CROSS-PLAN CONTRACT BREAKS (confirmed by ≥2 independent reviewers)

These compile/run-break as written. They are mechanical (objectively wrong), not opinion.

| # | Break | Where | Evidence | Severity |
|---|-------|-------|----------|----------|
| C1 | **`issueAccessToken` return shape.** M0a defines it returning object `{token, expiresIn}`; M0b route code + every M2 integration test treat it as a bare string → `{user,tokens}` malformed, `authResultSchema.parse` throws on register; M2 authed tests send `Bearer [object Object]` → 401. | M0a↔M0b↔M2 | A + E independently | **Critical — breaks every authed route** |
| C2 | **`getQueueConnection()` double-wrap.** M1 returns `{ connection: ConnectionOptions }`; M2 passes it as `connection: getQueueConnection()` at ~8 sites → nested `{connection:{connection:…}}`, BullMQ fails to connect. | M1↔M2 | E (read both); D confirms M1 shape | **High** |
| C3 | **Worker-registry path drift.** M2 (Task E5) + its prereqs cite `api/src/queues/workers.ts`; M1 actually ships the runner at `api/src/workers/runner.ts` (`startWorkers`/`stopWorkers`). M2 builds a duplicate registry at the wrong path → M1 workers never merged. | M1↔M2 | D + E independently | **High** |
| C4 | **M2 statically imports an M3-only module.** M2 reports repo does `import { getSetting, SETTING_KEYS } from '../settings/service.js'` (configurable auto-hide threshold). That module ships in **M3**, two milestones later. Static ESM import = compile failure in M2; backwards milestone dependency. | M2→M3 | E | **High (layering violation)** |
| C5 | **Admin API client name mismatch (M3-internal).** M3 Phase H exports `serverAdminApi`/`browserAdminApi` (and M0d provides `apiServerFetch`/`apiBrowserFetch`); ~20 M3 pages import `{ adminApi }`. Won't compile; M3 self-review repeats the wrong name. | M0d↔M3 internal | F | **High — blocks admin build** |

## B. WITHIN-PLAN CONTRADICTIONS (single-plan, still break as written)

| # | Issue | Plan | Severity |
|---|-------|------|----------|
| W1 | **`templateKey` broken end-to-end.** `push_logs.templateKey` is NOT NULL; `NotificationSendJob` omits it; schedule worker never sets it; send worker reads it → real sends throw. | M1 | High |
| W2 | **`/v1/me` mount self-contradiction.** H2 mounts `pushTokenRoutes` standalone at `prefix:'/v1/me'`; H3 assumes a `meScope` sub-app. Pick one composition. | M1 | Medium |
| W3 | **`product-lookup` queue never enqueued.** Worker + queue exist but nothing calls `.add()` → §4.3 background backfill non-functional. | M1 | Medium |
| W4 | **M2 H2 worker test asserts `'pending'` review status** — abolished by D15 (enum is visible/hidden/deleted; worker sets `hidden`). Guaranteed test failure. | M2 | Medium |
| W5 | **Detail pages built on list-search stand-in.** `/products/[id]` uses `list({q:id})` (q matches name/brand/barcode, not id) → valid products 404; `/reviews/[id]` uses unfiltered first page → reviews past page 1 unreachable. | M3 | Medium |
| W6 | **`tailwind.config.js` `require('…tailwind-tokens.ts')`** — CommonJS require of raw `.ts` at config-eval has no transpiler → likely metro/build break; typecheck won't catch. | M0c | Medium |
| W7 | **Refresh single-flight race** — `refreshInFlight` cleared via `setTimeout(0)` masks a real multi-tick race (token rotation thrash). Clear synchronously. | M0c | Medium |
| W8 | **`prisma migrate deploy` likely fails on host** — `pnpm install --prod` prunes the Prisma CLI devDep before the deploy step runs it. | M0d | High (deploy) |
| W9 | **`systemctl reload pantry-*` is a no-op** — Type=simple units define no `ExecReload`; "graceful drain" claim unmet. | M0d | Medium |
| W10 | **Non-idempotent Ansible DB password** — `lookup('password','/dev/null')` regenerates a new password each run when var undefined → resets live DB password, breaks running app. | M0d | High (ops) |
| W11 | **Next 15 cookie-set-in-render** — server-component `tryRefresh` sets cookies during render (forbidden) → possible refresh→redirect loop. Self-acknowledged, unfixed. | M0d | Medium |

## C. SPEC-COVERAGE GAPS (plan silently drops a spec requirement)

These reverse/omit stated spec intent → require user confirmation (cannot be auto-cut).

| # | Spec requirement | Status in plans | Plan |
|---|------------------|-----------------|------|
| S1 | §2.1 Email verification **required before first sign-in** | Login never checks `emailVerifiedAt` → unverified users can sign in | M0b |
| S2 | §6.8 Rate limits (60/min user, 30/min IP, `/auth/*` 10/min IP) | No per-IP tiers; limiter disabled in tests | M0a/M0b |
| S3 | §8.2 Admin **always** requires TOTP | Freshly-promoted admin with no `totpSecret` logs in password-only | M0b |
| S4 | TOTP recovery codes | Generated but never persisted/redeemable (dead UX) | M0b |
| S5 | §7.3 Passkey **registration** flow (mobile) | Only passkey *login* built; registration not built and not deferred | M0c |
| S6 | §7.2 `settings/index.tsx` screen | Not built by M0c, not claimed by M1/M2 | M0c |
| S7 | §11 UptimeRobot `/health` ping | Never wired or documented as manual step | M0d |
| S8 | §3 WCAG AA across all 4 themes | M4 contrast test covers only 6 pairs at 4.5:1; **omits `text.muted` + non-text/border 1.4.11 (3:1)**; light-theme muted hex (e.g. bento `#8A8A8A` on white ≈3.5:1) likely fails AA but is untested → CI passes on real violations | M4 |
| S9 | §2.11 User's own review writes go through offline write queue | M2 makes review writes online-only TanStack mutations (read-from-server) | M2 |
| S10 | §2.5 Per-user notification-preference override | `users.notificationPreferences` column added but **never read** — create/patch/sync always default `[7,1,0]` | M1 |

## D. INTENTIONAL-BUT-UNRECORDED DECISIONS (consistent across plans, deviate from spec)

| # | Decision | Detail |
|---|----------|--------|
| D1 | **API field casing = camelCase.** Spec §5/§6 wrote snake_case (`requires_totp`, `email_verified_at`, `theme_preference`). All plans (M0a/b/c/d) consistently use **camelCase** (`requiresTotp`, `themePreference`). Mutually consistent — except M4's security-review test asserts snake_case `requires_totp` (will fail). | Mostly consistent; M4 test is the lone drift |
| D2 | **TOTP challenge-verify endpoint path** = `POST /v1/auth/totp/challenge-verify` (M0a/b), and M0c+M0d both consume that exact path + camelCase shape — **consistent**. | OK |
| D3 | **M1 product_edits side-table** + **users.notificationPreferences** — both explicit architecture decisions, applied in schema. (Prefs column not wired — see S10.) | OK except S10 |
| D4 | Theme token field `animation` (singular) vs spec §2.10 `animations` (plural); M0c consumes `animation` — consistent within plans, deviates from spec wording. | Cosmetic |
| D5 | M1 sync delta sends `since` in POST body; spec §2.11 says `?since=` querystring. Functional, contract differs from spec. | Minor |
| D6 | Mockup prototype: relative URLs + gitignored output dir (deliberate, documented deviations from mockup spec §3/§5). | OK |

## E. RESOLVED (flagged by one reviewer, cleared by the join)

- **`requireAdmin` vs `requireAuth`:** M3 assumes `requireAdmin`; M0a PROVIDES **both** `app.requireAuth` and `app.requireAdmin` → satisfied. M3's `admin-only` prose is just redundant.
- **`writeAuditLog` attribution:** M3 prereq line attributes it to M0a/B but a code comment says M0d; **M0d Phase C actually ships it** with the exact signature M3 consumes (`{adminId, action, targetType, targetId, diff?, requestId?, ip?}`). `admin_audit_log` *table* is M0a init migration. Consistent — only the prereq prose is mis-attributed.
- **TOTP/me camelCase consumption (M0d, M0c):** matches M0a's `toApiUser` camelCase output → satisfied.

---

## Verification Results
- **Tier:** Full (9 plans, 5+ phases each)
- **Method:** 6 parallel reviewers, manifest join
- **Cross-plan breaks (A):** 5 (C1–C5) — all ≥2-reviewer confirmed or single-reviewer-read-both
- **Within-plan contradictions (B):** 11 (W1–W11)
- **Spec-coverage gaps (C):** 10 (S1–S10)
- **Intentional deviations (D):** 6 (D1–D6)
- **False alarms cleared (E):** 3

---

## Validation Log

### Session 1 — 2026-05-26
**Trigger:** `/ck:plan validate` — full review + validation of all 9 plans in `docs/superpowers/plans/`.
**Method:** 6 parallel per-milestone reviews → contract join → 6-question interview → 6 parallel patch agents (strict file ownership) → enrollment-contract follow-up → whole-plan consistency sweep.

#### Confirmed Decisions
- **Security S1–S4:** Enforce ALL four in v1 (email-verify-before-signin §2.1, auth rate limits §6.8, admin always-TOTP §8.2, redeemable TOTP recovery codes).
- **API casing D1:** **camelCase** is canonical (wire contract). Spec tables keep snake_case for readability; DB columns snake_case via Prisma `@map`; error `code` strings stay snake_case. Spec annotated; M4 test fixed.
- **Reviews S9:** **Online-only** TanStack mutations (server source of truth). Spec §2.11 amended; offline write queue covers `records` only.
- **Notification prefs S10:** **Wire** `users.notificationPreferences.offsetsDays` into notify_at computation; default `[7,1,0]`.
- **Auto-hide C4:** **Hardcode `>3`** in M2; removed the M3-only `getSetting` import (killed the backwards dependency). M3 may add a configurable override later.
- **Mechanical breaks:** **Patched into plans now** (C1–C5, W1–W11).

#### Patches Applied (by milestone)
- **M0a/M0b:** `issueAccessToken`→string; email-verify login gate; rate-limit tiers (60/min user, 30/min IP, 10/min `/auth/*`); admin always-TOTP with new `{requiresTotpEnrollment, enrollmentChallenge}` branch; persisted+redeemable recovery codes (`totp_recovery_codes` table, `recovery-verify` route); `TotpChallenge.purpose` column.
- **M0c:** Tailwind tokens via `.cjs` (no `.ts` require); synchronous refresh single-flight; passkey **registration** flow + `settings/index.tsx` hub.
- **M0d:** deploy migrate-before-prune; `systemctl restart` + SIGTERM drain (no-op reload fixed); idempotent Ansible DB password; refresh moved out of server-component render (Next 15); UptimeRobot wired; **admin TOTP-enrollment login flow** (enroll/verify-enrollment proxies + `TotpEnrollForm`).
- **M1:** `getQueueConnection()`→raw `ConnectionOptions`; canonical worker registry `api/src/workers/runner.ts`; `templateKey` threaded through notify chain; single `meScope` mount; `product-lookup` enqueue wired; `notificationPreferences` wired; Expo scanning→`expo-camera CameraView`.
- **M2:** workers register in M1's `runner.ts` (dup `queues/workers.ts` removed); hardcoded `>3` threshold; moderation test asserts `hidden` not `pending`; reviews online-only note.
- **M3/M4:** admin client standardized `serverAdminApi`/`browserAdminApi` (all ~27 pages fixed); detail pages use real by-id endpoints (`GET /v1/admin/products/:id`, `/reviews/:id` added); M4 security test camelCase; WCAG test expanded (muted + 1.4.11 border pairs) with palette sign-off note — **no theme hex changed**.

### Verification Results
- **Tier:** Full (9 plans)
- **Cross-plan breaks (A):** 5 → all resolved
- **Within-plan contradictions (B):** 11 → all resolved
- **Spec-coverage gaps (C):** 10 → S1–S4 enforced, S5/S6 added (passkey reg, settings hub), S7 (UptimeRobot) added, S8 (WCAG) test expanded + sign-off note, S9/S10 decided & applied
- **Failed:** 0

### Whole-Plan Consistency Sweep
- Files reread/grepped: all 9 plans + spec
- Decision deltas checked: 6 (token shape, queue connection, worker path, admin-api naming, casing, new enrollment branch)
- Reconciled stale references: worker-registry path, `issueAccessToken` shape, `adminApi` name, Expo scanner API, `requires_totp` casing
- New contract introduced & verified consumed: `requiresTotpEnrollment` (M0a/b producer ↔ M0d consumer) — endpoint paths + response fields (`qrCodeDataUrl`, `recoveryCodes`) match
- **Unresolved contradictions: 0**

## Remaining flags (no blocker — user awareness)
- **WCAG (S8):** expanded test will likely fail some light-theme muted/border pairs (e.g. Bento `text.muted #8A8A8A` on white). Palette re-tune needs your sign-off during M4 — colors deliberately left unchanged.
- **Mobile native creds (M0c):** Google OAuth scheme, Apple entitlements, passkey RP ID are placeholders — real values required before social/passkey login works end-to-end (provisioning step, not a plan defect).
- **`age` key custody (M0d):** backup encryption key stored on the same VPS it backs up — consider off-host key escrow.
