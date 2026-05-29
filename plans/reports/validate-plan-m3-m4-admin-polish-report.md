# Validation Report — M3 Admin Dashboard + M4 Polish/Launch

Plans validated (greenfield, no source to check against):
- `/Users/lekiemdan/newapp/docs/superpowers/plans/2026-05-24-m3-admin-dashboard.md`
- `/Users/lekiemdan/newapp/docs/superpowers/plans/2026-05-24-m4-polish-and-launch.md`
Spec: `/Users/lekiemdan/newapp/docs/superpowers/specs/2026-05-23-pantry-app-design.md`

---

## 1. CONSUMES list (VERBATIM — what M3/M4 assume from earlier milestones)

### M3 from M0a/M0b (prerequisites block, lines 15)
> M0a/M0b — Fastify API foundation, `requireAuth`/`requireAdmin` decorators, sessions service (with `revokeAllSessions`), `users`, `sessions`, `admin_audit_log` tables, `@pantry/shared` Zod plumbing.

Concrete symbol usages found in M3 route/test code:
- `app.requireAdmin(req, reply)` — used in `admin-only.ts` plugin (line 507). **FLAG: see §requireAdmin below.**
- `buildServer` from `../../../src/server.js`; `getPrisma()` from `src/db.js`; `hashPassword` from `src/services/auth/passwords.js`; `issueAccessToken` from `src/services/auth/tokens.js` (signature `issueAccessToken({ sub, role })`, and overload `issueAccessToken({ sub, role }, { expiresIn })` — M3 explicitly notes M0a may need inline extension, line 1397).
- `revokeAllSessions(id)` from `../../../services/auth/sessions.js` (line 1286, 1294).
- `AppError` from `../../../errors.js`; `ERROR_CODES` (`.NOT_FOUND`, `.VALIDATION_ERROR`, `.CONFLICT`) from `@pantry/shared`.
- Prisma models assumed: `user` (fields incl. `role`, `status`, `country`, `lastSeenAt`, `emailVerifiedAt`, `totpEnabledAt`, `passwordHash`, `firstName`, `lastName`), `session` (`refreshTokenHash`, `ip`, `deviceInfo`, `expiresAt`, `revokedAt`), `adminAuditLog` (`adminId`, `action`, `targetType`, `targetId`, `diff`, `requestId`, `ip`).
- `writeAuditLog({...})` from `../services/audit/log.js` — M3 audit plugin imports it; comment says **"helper shipped in M0d (Phase C)"** (line 601) — but the prerequisites block lists audit-log under M0a/M0b tables and M0d for the helper. Signature consumed (lines 615-623): `writeAuditLog({ adminId, action, targetType, targetId, diff, requestId, ip })` returning `Promise<void>`.
- `EmailToken` model with **`purpose String`** column accepting value `'admin_grant'` (G3a, G5; lines 4080, 4227, 4249). `hashToken`, `randomToken` from `../../../utils/random.js`; `cfg.frontend.adminUrl` from `../../../config.js`; `transport`, `cfg.smtp.from` in `services/auth/email.js`.

### M3 from M0d (prerequisites block, line 16)
> M0d — Admin Next.js app shell, `/login` with TOTP, CSRF middleware, HTTP-only cookie session, the API client `lib/api.ts`, the `writeAuditLog({...})` low-level helper, page stubs at every route listed in spec §8.3, Ansible/nginx/systemd plumbing.

Concrete usages:
- `apiServerFetch`, `apiBrowserFetch` imported from `./api.js` ("exported by M0d", line 4317). Fetcher contract: `(path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>`.
- shadcn primitives assumed installed by M0d: button, dialog, input, dropdown-menu, table, badge, toast, sonner, select, tabs, switch, textarea (line 4271).
- `NEXT_PUBLIC_API_BASE_URL` env (line 5979).
- Playwright config + `loginAsAdmin(page)` helper + dev seed routes `POST /v1/dev/seed-report`, `/v1/dev/seed-duplicate-products`, `/v1/dev/seed-user` (Phase K; flagged as "add if missing").
- Page stubs at every §8.3 route to be replaced.

### M3 from M1 (prerequisites block, line 17)
> M1 — `products`, `records`, `product_edits`, `push_logs` tables; BullMQ queues registered (`product-lookup`, `notification-schedule`, `notification-send`); opossum circuit breakers wrapping OFF/UPCitemdb/Expo Push exposed via `getBreaker(name)`.

Concrete usages:
- `getAllQueues()` from `../../queues/index.js` (`api/src/queues/index.ts`), returns `{ name: string; queue: Queue }[]` (lines 3310, 3331, 3653).
- `getBreaker(name)` AND `getAllBreakers()` from `api/src/services/external/breakers.ts`; breaker names **`'off'`, `'upcitemdb'`, `'expo-push'`** (lines 3559, 3561, 3579). Breaker object shape consumed: `.opened`, `.halfOpen`, `.stats.{fires,failures,successes}`, `.lastFailureAt`.
- Prisma models: `product` (incl. `qrPayload`, `ratingAvg`, `ratingCount`, `reviewCount`, `mergedIntoProductId`, `createdByUserId`, `status` enum incl. `merged_into`), `record` (`productId`, `userId`, `expiryDate`, `clientId`), `productEdit` (`id`, `productId`, `submittedBy`, `proposed Json`, `status 'pending'|'approved'|'rejected'`, `createdAt`, `resolvedBy`, `resolvedAt`, `notes` — line 2004), `pushLog` (`userId`, `templateKey`, `status 'sent'|'failed'`, `errorMessage`, `createdAt`).

### M3 from M2 (prerequisites block, line 18)
> M2 — `reviews`, `review_votes`, `reports` tables; review status enum (`visible`, `hidden`, `deleted`); `moderation-flag` queue.

Concrete usages:
- `review` model (`userId`, `productId`, `rating`, `body`, `upvoteCount`, `downvoteCount`, `status`), `report` model (`reporterId`, `targetType`, `targetId`, `reason`, `status`, `resolvedByAdminId`, `resolvedAt`).
- **Queue-health test asserts 6 queue names** (line 3293): `'product-lookup','notification-schedule','notification-send','score-recalc','moderation-flag','product-rating-recalc'`. Spec §4.3 only names 5 queues — `product-rating-recalc` is NOT in spec §4.3 and not in the M1/M2 prereq lists (which name `product-lookup/notification-schedule/notification-send` for M1 and `moderation-flag` for M2; `score-recalc` is spec but unlisted in prereqs). **FLAG: contract drift on queue name list — see Risks.**
- M3 also assumes a seeded **system user** id `00000000-0000-0000-0000-000000000001` "M2 seeds it" (lines 830, 892). Spec/M2 prereq does not mention this seed. **FLAG.**

### M4 prerequisites (line 13)
> Prerequisite: M0a, M0b, M0c, M0d, M1, M2, and M3 complete. Aurora Glass theme polished. All screens functional. Deploy pipeline live. Backups configured.

Concrete consumes:
- `@pantry/theme` `Theme` interface from M0a with `colors / radii / shadows / typography / spacing / animations`; themes `aurora/bento/clay/material` created (stubs) in M0a, fully implemented here.
- `useTheme()` and `ThemeProvider` (+ to-add `useThemeSwitcher`) from `apps/mobile/src/theme/ThemeProvider.tsx` (M0c).
- M0c screens at every `app/(auth)/*` and `app/(app)/*` path.
- `EXPO_PUBLIC_API_BASE_URL` (M0c), JWT env `JWT_ACCESS_SECRET`, `REDIS_URL`, `DATABASE_URL` (M0a), `rclone` + `b2:pantry-backups`, `infra/scripts/backup.sh`/`restore.sh` (M0d), M3 `feature_flags.maintenanceBanner` seed.

### `requireAdmin` vs `requireAuth` — FLAG (as requested)
- M3 **assumes `requireAdmin` already exists** on M0a/M0b: prerequisites line 15 lists `requireAuth`/`requireAdmin` decorators; `admin-only.ts` calls `app.requireAdmin(req, reply)` directly (line 507).
- BUT the architecture prose (line 7) says: `admin-only` *"extends `requireAuth` with `role === 'admin'`"* — implying `requireAdmin` is derived, not pre-existing.
- These are contradictory. If M0a/M0b only provide `requireAuth` (the more likely PROVIDES, since spec §6 only references generic auth and §6.7 says "every endpoint requires `role = 'admin'`"), then `admin-only.ts` as written (`app.requireAdmin`) will fail. The plugin would need to call `requireAuth` then assert `req.user.role === 'admin'`. **This is the single most important contract to verify against M0a/M0b PROVIDES.** Tests (401 no-auth, 403 non-admin, 200 admin) presume `requireAdmin` enforces both layers.

### Login / TOTP response shape — FLAG (as requested)
- Spec §8.2: login *"returns `requires_totp: true` and a one-time challenge token; admin web exchanges challenge + 6-digit code for full session."*
- M3 does NOT implement or re-verify this; it defers entirely to M0d's `/login`. M3's `makeAdmin()` test helper bypasses TOTP by minting `issueAccessToken({ sub, role:'admin' })` directly (line 683) and tests send `Bearer` tokens — so M3 integration tests never exercise the TOTP challenge flow.
- M4 security-review checklist (line 3654) asserts `login ... | jq .requires_totp == true` — uses `requires_totp` (snake_case), consistent with spec.
- M3 impersonate returns `{ accessToken, expiresIn }` (`adminUserImpersonateResponseSchema`, line 775) — a plain access token, NOT a TOTP-gated session. Acceptable per spec ("audit-logged" only), but note the impersonation token has no TOTP/refresh story (15-min access only).

---

## 2. Spec coverage gaps

### §6.7 endpoints — ALL 27 present. No missing endpoints.
Cross-checked every line of spec §6.7 (lines 439-473) against M3 routes:
- users: list/get/patch/revoke-all/impersonate → B2-B6 ✓
- products: list/patch/merge → C2-C4 ✓; pending edits (PATCH /products/:id user-edits → moderation) → C5 ✓
- reviews: list/status → D2-D3 ✓
- reports: list/resolve → D4-D5 ✓
- analytics overview/scans/reviews/geography → E3 ✓
- system queue-health/push-logs/api-errors/external-apis → F3-F6 ✓ (+ bull-board F7, extra)
- settings feature-flags GET/PATCH, notification-templates GET/PATCH/:id, moderation GET/PATCH, admins GET/invite/PATCH:id → G3-G5 ✓

Spec coverage matrix at end of M3 (lines 2566-2596) is **accurate** — every §6.7 row maps to a real task. One row label imprecise: "§5 admin_audit_log | M0a" — but the *table* is listed under M0a/M0b prereq, fine.

### §8.3 pages — ALL present. No missing pages.
Every §8.3 route (lines 592-605) has a task: `/`→I1, `/users`→I2, `/users/[id]`→I3, `/products`→I4, `/products/[id]`→I5, `/products/pending`→I6, `/reviews`→J1, `/reviews/[id]`→J2, `/reports`→J3, `/reports/[id]`→J4, analytics 4→J5, system 4→J6, settings 4→J7, `/products/[id]/merge`→I7 (§8.4). `/login` is M0d (correctly out of M3 scope).

### M3 coverage caveats (not missing, but weak):
- **`/products/[id]` and `/reviews/[id]` detail pages use list-filter as a stand-in** because spec has no per-product / per-review GET endpoint (lines 5277-5279, 5621-5623). The product detail does `list({ q: id })` and finds by id — fragile (id is not a search term in the `q` OR-clause for products: q matches name/brand/barcode equals, NOT id). **This page can silently render "not found" for valid products.** Review detail `list({})` without status filter then `.find` — only returns first page (limit 50), so deep reviews 404 in UI.
- Audit-history sidebar on product detail is a deferred placeholder ("queryable via psql", line 5300) — no §8 requirement violated but it's a stub.
- User-detail records/reviews/reports tabs are placeholder text (lines 5083-5085), not wired lists. §8.3 says detail shows "records, reviews, reports" — partially stubbed.

### M4 coverage gaps:
- **All 4 themes end-to-end:** Bento/Clay/Material implemented B1-B3; Aurora backfilled A3; wired into screens via D7/D3/D11/D15 (but D7/D11/D15 only switch layout for bento/clay/material on a SUBSET of screens — home, scan, settings. Other screens just tokenize, relying on token swap alone for theme distinctiveness. Acceptable but "across every screen" is looser than the goal statement claims).
- **WCAG AA across 4 themes (§3):** F1 tests 6 color pairs × 4 themes = 24 assertions at ratio ≥ 4.5. Covers normal text. **Does NOT test large-text 3:1, nor UI-component/border 3:1 (WCAG 1.4.11).** `text.muted` and `accentMuted`-on-surface pairs are NOT in the PAIRS list — muted text is the most likely AA failure and is untested. Several proposed tokens look risky (see Risks).
- **All runbooks named in spec §11:** spec §11 names 5 (rollback, restore, revoke sessions, rotate secrets, incident). M4 delivers all 5 PLUS uptime-monitoring, security-review, soft-launch, release-checklist (9 total) ✓ — superset, no gap.
- **Store submission (§10.2):** EAS Build (G1), EAS Update (G2), TestFlight + Play internal (G5/G6) all covered ✓.
- **§10.2 code-deploy pipeline** (GitHub Actions rsync/symlink/migrate/reload/smoke/rollback) is assumed pre-existing (M0d) — M4 only references it in rollback runbook. Not re-validated; out of M4 scope per prereq. Fine.

---

## 3. PROVIDES manifest (brief)

**M3 provides:**
- API: `admin-only.ts` + `audit.ts` (`req.auditLog`) + `api-error-recorder.ts` plugins; 27 `/v1/admin/*` routes; `@bull-board` at `/v1/admin/bullboard`; services `admin/merge.ts`, `admin/analytics.ts`, `admin/breakers.ts`, `admin/settings.ts`; Prisma `Setting`, `NotificationTemplate`, `ApiError` models + seed; extends `email.ts` with `sendAdminInviteEmail`.
- Shared: `packages/shared/src/schemas/admin/*` (common cursor/diff, users, products, reviews, reports, analytics, system, settings).
- Admin web: `serverAdminApi`/`browserAdminApi` client, `ConfirmModal`, `DataTable`, `KpiCard`, `ChartLine/Bar`, `StatusBadge`, `useBulkSelection`, `toast`; all §8.3 pages; 3 Playwright specs.

**M4 provides:**
- `@pantry/theme`: full `bento`/`clay`/`material` token sets + aurora backfill; extended `Theme` (ClayElevation, MD3Elevation, TypeRamp).
- Mobile: `BentoTile`, `ClayCard`, `ClayButton`, `MD3Chip/ListRow/FAB/TextField`, real `ThemePreviewCard`, `parseShadow` helper, 4-theme `ThemeProvider` cross-fade, tokenized screens, contrast/touch-target/snapshot tests, a11y lint config, font-scale cap.
- Ops: `eas.json`, EAS Update config, app icons/splash config; 9 runbooks; legal privacy-policy + terms; iOS/Android submission docs; CI a11y+snapshot job; Maestro theme-switch flow.

---

## 4. Top risks / decision points

1. **`adminApi` import name mismatch (M3, BLOCKING build).** Task H2 exports `serverAdminApi` and `browserAdminApi` (line 4411-4414) and deletes any `adminApi`. EVERY page in Phases I/J imports `{ adminApi } from '@/lib/admin-api'` (I1 line 4774, and ~20 more). This will not compile. Either H2 must also export `adminApi`, or all pages must be rewritten to pick server vs browser. The plan's own self-review (line 6552, 6555) reinforces the wrong name "`adminApi`". Must reconcile before execution.

2. **`requireAdmin` contract assumption (M3, possibly BLOCKING).** `admin-only.ts` calls `app.requireAdmin` directly but the architecture prose says it should "extend `requireAuth`". If M0a/M0b PROVIDES only `requireAuth`, the plugin and all admin tests break. Highest-priority cross-milestone contract to confirm.

3. **Queue-name + system-user contract drift (M3).** queue-health test hard-asserts `product-rating-recalc` and `score-recalc` queues (line 3293) — `product-rating-recalc` appears in NO spec section and NO prereq list; spec §4.3 lists only `product-lookup/notification-schedule/notification-send/score-recalc/moderation-flag`. Also the hidden system-user id `00000000-…-001` is assumed seeded by M2 but unstated in M2 prereq. Both will fail tests unless M1/M2 actually PROVIDE them. Verify against M1/M2 PROVIDES.

4. **Product/review detail pages built on list-search stand-in (M3).** `/products/[id]` uses `list({ q: id })` but products `q` matches name/brand/barcode (not id) → valid products render "not found"; `/reviews/[id]` uses unfiltered `list({})` first-page-only → reviews beyond page 1 unreachable. Functional bug in UI even though endpoints exist. Spec §8.3 expects working detail pages.

5. **WCAG AA token feasibility across 4 themes (M4).** Several proposed tokens are likely to fail or barely pass the 4.5:1 requirement and `text.muted`/border pairs are untested: e.g. bento `text.muted #8A8A8A` on `surface #FFFFFF` ≈ 3.5:1 (would FAIL if tested — it isn't); clay `text.muted #8A7567` on `surface #FBEFE6` ≈ 3.2:1; status colors on light surfaces (`warning #C77700`, `info #1F6FB5`) hover near 4.5. F1 only tests 6 pairs and excludes muted/border, so CI can pass while real screens still violate AA. Decision: expand PAIRS to include `text.muted` + WCAG 1.4.11 non-text 3:1, expect token re-tuning. Audit-only — do not change without user sign-off on the palette.

Secondary notes: audit-log on every mutation is enforced and tested everywhere ✓ (good). Merge tx repoints records+reviews and handles unique-(user,product) collision by deleting loser-side review ✓ but `movedReviews` count in test expects 2 while one review may be deleted on collision — test data avoids collision so it passes; the response `movedReviews` semantics vs deletions is mildly ambiguous. Impersonation has no TOTP re-gate and token stashed in `sessionStorage` (line 4970) — XSS-exfil risk, v1 acceptable but note. bull-board mounted under admin-only gate; smoke test expects 401 unauth ✓. EAS config has `REPLACE_WITH_*` placeholders (expected, documented). Analytics raw SQL is unbounded-window counts — fine at 10k-user scale per spec §3.

---

## Open questions
- Does M0a/M0b PROVIDES expose `requireAdmin`, or only `requireAuth`? (Risk 2)
- Do M1/M2 actually register queues `product-rating-recalc` + `score-recalc`, and does M2 seed the system user `…0001`? (Risk 3)
- Is `writeAuditLog` provided by M0a/M0b or M0d? M3 text says both in different places.
