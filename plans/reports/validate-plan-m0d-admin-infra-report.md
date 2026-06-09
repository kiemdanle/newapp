# Validation Report — M0d Admin Shell + Infra + Deploy

Plan: `docs/superpowers/plans/2026-05-24-m0d-admin-shell-and-infra.md`
Spec: `docs/superpowers/specs/2026-05-23-pantry-app-design.md`
Mode: greenfield, advisory/read-only. No codebase verification.

---

## 1. Internal consistency (later phases reference earlier-phase outputs)

Mostly consistent. Dependency chain tracks correctly:

- Phase D5 `COOKIE_NAMES` / `buildSetCookie` → consumed by E1/E3/E4 route handlers, D7 api.ts, D8 api-client.ts, G1 middleware, G2 session.ts. OK.
- Phase D6 `CSRF_HEADER` / `isCsrfValid` / `generateCsrfToken` → consumed by D8, E1, E3, E4. OK.
- Phase D4 `getAdminEnv` → consumed by D7, E1–E4, G2. OK.
- Phase B1 `adminLoginRequestSchema` / `adminTotpRequestSchema` → consumed by E1/E2. OK (assumes `@pantry/shared` re-exports resolve in admin via `transpilePackages`).
- Phase C3 `writeAuditLog` → not consumed inside M0d beyond its own test; promised to M3. OK.
- E2 `totp/route.ts` imports `finalizeSession` from `../login/route` (E1). E1 exports `finalizeSession`. OK — but importing a non-`route`-handler export across two route files is unusual; Next.js permits it but it couples two route modules. Low risk, works.
- G2 `(admin)/layout.tsx` calls `requireAdminSession` (session.ts) which uses D7 `apiServerFetch` + `ApiError`. OK.
- H1 deletes temp `app/page.tsx` (D2 step 12) and adds `(admin)/page.tsx`. Route-group `(admin)` does not change URL so `/` still resolves. OK.
- L1 `pantry-admin.service.j2` ExecStart path `.next/standalone/apps/admin/server.js` matches D2 step 15 smoke + package.json `start`. Consistent (good — this is a real monorepo footgun the plan explicitly guards).
- N1 `deploy-remote.sh` flips symlink, runs `prisma migrate deploy`, smoke `/health/ready`, rollback. Cron in L1 references `{{app_root}}/current/infra/scripts/backup.sh` — present after first deploy. OK.

### Inconsistencies / gaps found

- **CI test DB user mismatch (HIGH).** `deploy.yml` test job uses `DATABASE_URL=postgresql://pantry:pantry@localhost:5432/pantry_test` (user `pantry`). E2E `seed-admin.ts` default DSN is also `pantry:pantry@localhost:5432/pantry`. BUT the `postgres` Ansible role (J3) creates roles `pantry_app` and `pantry_readonly` — NOT a role named `pantry`. CI uses a container so it is self-consistent, but the *seed fixture default* (`pantry:pantry`) does not match the provisioned production role names (`pantry_app`). This is only a local/E2E default and overridable via `DATABASE_URL`, so low real impact, but the role-name divergence between infra (`pantry_app`) and every dev/test/seed string (`pantry`) is a latent trap.
- **`requireAdminSession` return type (MEDIUM).** TS: function declared `Promise<AdminMe>` but the catch path ends in `redirect('/login')` which returns `never` — fine for TS only if `redirect` is typed `never`. Next's `redirect` is typed `never`, so compiles. OK, but the trailing `redirect('/login')` after the `if` block is reachable only when refresh fails; acceptable.
- **refresh-in-render cookie persistence (MEDIUM, self-acknowledged).** G2 `tryRefresh` comment admits Server Components cannot persist Set-Cookie reliably; it mutates the in-render cookie store via `cookieStore.set()`. In Next 15 `cookies().set()` inside a Server Component render (not action/route handler) throws or is a no-op depending on version. The plan hand-waves this. Functional risk: refreshed tokens may not persist to the browser, causing a redirect loop or repeated refresh. Needs verification against Next 15 runtime.
- **`pnpm install --prod --frozen-lockfile` at deploy (MEDIUM).** N1 runs prod install on the host AFTER the tarball excludes `node_modules`. But the tarball (build job) excludes `tests` and `node_modules`; the admin Next standalone output bundles its own deps, while `api/dist` needs prod node_modules. Running `pnpm install --prod` on host requires registry access from the VPS at deploy time — couples deploy to npm registry availability. Spec implies build-then-ship; plan re-installs on host. Works but is a deviation worth noting.
- **`prisma migrate deploy` requires Prisma CLI + generated client on host.** N1 `cd $NEW/api && pnpm exec prisma migrate deploy` — needs prisma in the host install. Covered by `pnpm install --prod`? `prisma` (CLI) is typically a devDependency → `--prod` would EXCLUDE it. **Likely BUG: `prisma migrate deploy` will fail on host because the CLI is pruned by `--prod`.** Either prisma must be a regular dependency or migrate must run differently.

---

## 2. Spec coverage

| Spec area | Covered? | Notes |
|---|---|---|
| §4.2 Postgres 16 (apt, localhost, pg_trgm, pgcrypto) | YES | J3. pg_hba scram, listen localhost, both extensions, no-superuser app role + readonly role. |
| §4.2 Redis 7 (apt, localhost) | YES | J4. bind 127.0.0.1, protected-mode. |
| §4.2 Node 20 LTS | YES | J5 NodeSource 20.x + corepack pnpm9. |
| §4.2 nginx + certbot | YES | K1/K2. |
| §4.2 ports 4000/4001 | YES | vhosts proxy 4000/4001; admin dev `-p 4001`. |
| §4.2 ufw (22/80/443) | YES | J2. |
| §4.2 fail2ban on ssh | YES | J2 sshd jail. |
| §4.2 secrets mode 600 owned pantryapp | YES | L2 enforces 0600 + owner. (Note: common role J2 creates `/etc/pantry` mode 0700 — consistent.) |
| §4.2 separate read-only role | YES | J3 pantry_readonly. |
| §4.2 Renovate + weekly npm audit | YES | O1/O2 (uses `pnpm audit`, spec says `npm audit` — equivalent). |
| §10.1 provisioning one-command | YES | site.yml composes all roles. |
| §10.2 deploy steps 1–7 | YES | deploy.yml + deploy-remote.sh map to all 7 steps incl. prisma migrate + rollback. |
| §10.3 secrets EnvironmentFile, mode 600 | YES | systemd units use EnvironmentFile; L2 perms. |
| §11 /health + /health/ready | CONSUMED | Verified in Phase A, not created here (M0a owns them). |
| §11 UptimeRobot ping /health | **GAP** | Plan never configures UptimeRobot, nor documents it as manual external step. Smoke test hits `/health/ready` but no uptime monitor wiring/runbook note. |
| §11 Pino logs → logrotate 7d | PARTIAL | logrotate-pantry rotates `/var/log/pantry/*.log` 7 daily. Pino log emission is API-side (M0a). OK for infra side. |
| §8.2 HTTP-only cookies | YES | access/refresh httpOnly; csrf intentionally not. |
| §8.2 TOTP second factor | YES | login→challenge→totp/challenge-verify flow. |
| §8.2 IP allowlist nginx | YES | admin.vhost.j2 per-CIDR allow + deny all. |
| §8.2 CSRF on cookie mutations | YES | double-submit; enforced on refresh+logout. |
| §8.2 every admin mutation → audit_log | PROVIDED | writeAuditLog helper; actual call sites are M3. |
| §8.3 all admin pages stubbed | YES | All 23 routes stubbed (see PROVIDES). |
| §3 secrets at rest mode-600 | YES | as above. |
| §3 HTTPS-only / HSTS | YES | vhosts redirect 80→443, HSTS header. |

### Spec gaps (actionable)

1. **UptimeRobot (§4.2/§11) not wired or documented** as a manual post-deploy step. Minor but a stated NFR.
2. **CSRF not enforced on login/totp handlers** — by design (no session yet) and acceptable, but worth an explicit note; the double-submit only protects refresh/logout. Login CSRF relies on SameSite=Lax + admin IP allowlist. Acceptable for the threat model; flag for reviewer.
3. **`npm audit` → `pnpm audit`** substitution: equivalent, fine. Note only.
4. **No HSTS/security headers asymmetry**: api vhost lacks `X-Frame-Options` (admin has it). Not spec-required for API. Fine.

---

## 3. CONSUMES list (verbatim upstream assumptions — cross-check vs M0a/M0b)

Quoted from the plan's "Cross-milestone dependencies" + Phase A + route handlers:

> - `GET /health` and `GET /health/ready` from M0a — verified in Task A2 before the deploy smoke test is wired
> - `POST /v1/auth/login` returning either `{user, tokens}` or `{requiresTotp: true, challengeToken}` from M0b
> - `POST /v1/auth/totp/challenge-verify` exchanging `{challengeToken, code}` for `{user, tokens}` from M0b
> - `GET /v1/auth/me` and `POST /v1/auth/refresh` from M0b
> - Shared Zod schemas in `@pantry/shared` from M0a (extended here for admin login forms only)

Exact contract shapes the M0d code hard-depends on:

- **`GET /health`** → expects `{ status: 'ok' }` (Phase A1 step1).
- **`GET /health/ready`** → expects `{ status: 'ready' }` after Prisma+Redis probe.
- **`POST /v1/auth/login`** request body: `{ email, password }` (validated by `adminLoginRequestSchema`). Response either:
  - `{ requiresTotp: true, challengeToken: string }` (admin w/ TOTP), OR
  - `{ user: { role: 'user'|'admin' }, tokens: { accessToken, refreshToken } }`.
  - Code keys on `body.requiresTotp === true && typeof body.challengeToken === 'string'`.
- **`POST /v1/auth/totp/challenge-verify`** request `{ challengeToken, code }` (`code` = `/^\d{6}$/`) → response `{ user: {role}, tokens: { accessToken, refreshToken } }`. **Path is `challenge-verify` NOT `verify`** (plan explicitly warns `/v1/auth/totp/verify` is enrollment-confirm).
- **`POST /v1/auth/refresh`** request body `{ refreshToken: <string> }` → response `{ tokens: { accessToken, refreshToken } }` (rotation). (G2 + E3 both send `{refreshToken}` and read `body.tokens`.)
- **`POST /v1/auth/logout`** request body `{ refreshToken }` → fire-and-forget.
- **`GET /v1/auth/me`** → response shape `AdminMe = { id, email, role: 'user'|'admin', firstName, lastName }`. **NOTE: spec §5 stores `first_name`/`last_name` (snake_case) and §6.1 `/auth/me` body shape is unspecified.** M0d assumes camelCase `firstName/lastName/role`. **Cross-check M0b's actual `/v1/auth/me` serializer for casing — drift risk.**
- **`@pantry/shared`** must export the existing `./schemas/error.js` (B1 appends after it) and accept new `./schemas/admin.js`.
- **`AdminAuditLog` Prisma model** assumed already added in M0a Task D4 with fields `id, adminId, action, targetType, targetId, diff, requestId, ip, createdAt` + indexes `[adminId]`, `[targetType,targetId]`. C1 only verifies; does NOT create. **If M0a did not add it, M0d STOPs.**
- Auth tokens assumed Bearer JWT in `Authorization: Bearer <access>` (D7 forwards access cookie as bearer to API).

**Casing assumptions to flag:** login/me/tokens use camelCase (`accessToken`, `refreshToken`, `requiresTotp`, `challengeToken`, `firstName`). Spec tables use snake_case columns. M0a/M0b API serialization casing is the single biggest contract drift risk — must match exactly or login/me silently break at runtime (types are `unknown`/`Record<string,unknown>` so TS won't catch it).

---

## 4. PROVIDES manifest (for M3 consumption)

### 4a. Audit log
- **Prisma model**: `AdminAuditLog` (verified, not created here) — columns `id, adminId, action, targetType, targetId, diff(jsonb), requestId, ip, createdAt`. Matches spec §5 (admin_id, action, target_type, target_id, diff, request_id, ip, created_at). **Spec §5 `ip` is `inet`; Prisma model casing/type for `ip` is `text`-ish per the input (`ip?: string`).** Functionally fine; note inet vs text if M3/queries assume inet.
- **Helper**: `writeAuditLog(input: AuditLogInput): Promise<void>` at `api/src/services/audit/log.ts`.
  - `AuditLogInput = { adminId: string; action: string; targetType: string; targetId: string; diff?: unknown; requestId?: string|undefined; ip?: string|undefined }`.
  - Throws on missing `adminId/action/targetType/targetId`. `diff` undefined→null. Append-only create.
  - **M3 must call with this exact shape.** All four core fields required (no optional targetId).

### 4b. Admin Next.js app shell (`apps/admin`, `@pantry/admin`)
- Standalone server entry: `apps/admin/.next/standalone/apps/admin/server.js` (port 4001, HOSTNAME 127.0.0.1).
- **API clients (exact names):**
  - Server-side: `apiServerFetch<T>(path, opts)` + `ApiError` class — `apps/admin/src/lib/api.ts`. Reads `pantry_admin_access` cookie, forwards as `Authorization: Bearer`. `cache: 'no-store'`. Throws `ApiError(status, code, detail)` on non-2xx.
  - Browser-side: `apiBrowserFetch<T>(path, opts)` — `apps/admin/src/lib/api-client.ts`. Hits same-origin `/api/...` route handlers, attaches CSRF header on non-GET, `credentials: 'same-origin'`.
  - (Note: file map header calls these "api.ts cookie-based API client"; the two distinct names are `apiServerFetch` and `apiBrowserFetch`. M3 plan referencing a single `lib/api.ts` client should expect BOTH.)
- **Session helper**: `requireAdminSession(): Promise<AdminMe>` — `apps/admin/src/lib/session.ts`. Calls `/v1/auth/me`, one refresh-on-401 retry, enforces `role==='admin'`, redirects `/login` otherwise. `AdminMe = {id,email,role,firstName,lastName}`.
- **Middleware**: `apps/admin/src/middleware.ts` — presence-only check of `pantry_admin_access` cookie; redirects unauth→`/login?next=`, auth→away from `/login`. Does NOT verify JWT. Public prefixes `/_next`, `/api/auth`, `/favicon`.
- **CSRF names (exact):**
  - Cookie: `pantry_admin_csrf` (NOT HttpOnly, JS-readable).
  - Header: `X-CSRF-Token` (constant `CSRF_HEADER = 'x-csrf-token'`).
  - Helpers: `generateCsrfToken()` (32-byte base64url), `isCsrfValid(cookie, header)` (length-check + timingSafeEqual).
- **Cookie names (exact):** `COOKIE_NAMES = { access:'pantry_admin_access', refresh:'pantry_admin_refresh', csrf:'pantry_admin_csrf' }`; builder `buildSetCookie(opts)`. Access maxAge 900s, refresh 30d.
- **Route Handlers (own-origin `/api/auth/*`):** `POST /api/auth/login`, `POST /api/auth/totp`, `POST /api/auth/refresh` (CSRF-checked), `POST /api/auth/logout` (CSRF-checked), `GET /api/auth/me`. Exports `finalizeSession(body, env)` from login/route.
- **shadcn primitives vendored:** `button, input, label, alert` only. M3 adds more.
- **Nav config:** `NAV` in `apps/admin/src/lib/nav.ts` (sections: Overview, Moderation, Catalog, People, Analytics, System, Settings).
- **Env loader:** `getAdminEnv()` / `parseAdminEnv()` → `{apiBaseUrl, cookieSecure, cookieDomain, nodeEnv}`. Env keys: `API_BASE_URL, COOKIE_SECURE, COOKIE_DOMAIN, PORT, NODE_ENV`.

### 4c. Route stubs vs spec §8.3 (all present)
Spec §8.3 routes → plan stubs (Phase H + login + overview):
`/login`(F2), `/`(H1 overview in (admin)), `/users`+`/users/[id]`(H2), `/products`+`/products/[id]`+`/products/pending`(H3), `/reviews`+`/reviews/[id]`(H4), `/reports`+`/reports/[id]`(H5), `/analytics/{overview,scans,reviews,geography}`(H6), `/system/{queue,push,api-errors,external-apis}`(H7), `/settings/{feature-flags,notification-templates,moderation,admins}`(H8). **All 23 §8.3 routes covered. No missing, no extras.**

---

## 5. Top risks & decision points

1. **`prisma migrate deploy` on host likely broken by `pnpm install --prod`** (N1) — Prisma CLI is normally a devDependency and would be pruned by `--prod`, so `pnpm exec prisma migrate deploy` fails at deploy step 5. Either make `prisma` a runtime dep, run migrate in CI against a tunneled DB, or `npx prisma@<ver>`. **Highest-likelihood real deploy failure.**
2. **Contract casing drift on `/v1/auth/me`, `/login`, `/refresh`** — M0d assumes camelCase (`firstName`, `accessToken`, `requiresTotp`, `challengeToken`); spec stores snake_case columns and §6.1 doesn't pin response casing. Bodies typed as `unknown`/`Record<string,unknown>` so TS won't catch a mismatch — failures appear only at runtime (login loop / undefined name). **Must verify against M0b's actual serializers.**
3. **Server-component token refresh persistence (G2 `tryRefresh`)** — Next 15 forbids setting cookies during a Server Component render outside actions/route handlers; the in-render `cookieStore.set` may not persist to the browser, risking a refresh→redirect loop. Self-acknowledged in a rambling comment; needs a real fix (e.g. refresh only via the `/api/auth/refresh` route handler, or middleware-driven refresh).
4. **Single-VPS no-Docker operational fragility + deploy registry coupling** — host-side `pnpm install --prod --frozen-lockfile` at every deploy ties releases to npm registry uptime and host build toolchain; no blue/green beyond symlink; `systemctl reload` for a Node/Next process only works if the unit actually supports reload (Type=simple has no reload semantics → `systemctl reload` is a no-op or error unless `ExecReload` is defined). **Units define no `ExecReload`; `systemctl reload pantry-*` will fail or do nothing — graceful drain claim is unmet.** Should be `restart` (sudoers already allows restart) or add `ExecReload`.
5. **Backup encryption restore drill not exercised + age key custody** — backup uses `age -r <recipient>` (public key) for encryption; restore needs `AGE_IDENTITY_FILE` (private key) on the host. Storing the age private key on the same VPS it backs up defeats offsite-recovery if the box is lost. Spec wants quarterly restore drill (deferred to M4) — acceptable, but flag key-custody. Also `rclone lsf | sort -r` rotation assumes date-sortable filenames (`YYYY-MM-DD.age` — OK) but deletes by lexical order, which equals chronological here; fine.

Secondary: Ansible idempotency — `corepack enable`/`prepare` use `changed_when:false` (always-run, never-changed — fine); `set_fact pantry_app_password` via `lookup('password','/dev/null')` regenerates a *new* password every run when undefined → on re-run the role would reset the DB password to a new random value, breaking the running app's stored DSN. **Idempotency violation: password lookup is non-deterministic across runs.** Should persist to a file (`lookup('password','/path ...')`) not `/dev/null`.

---

## Unresolved questions
- Does M0b's `/v1/auth/me` serialize camelCase (`firstName`, `role`) or snake_case? (drives risk #2)
- Is `prisma` a regular dependency or devDependency in `api/package.json`? (drives risk #1)
- Did M0a actually add the `AdminAuditLog` model (C1 asserts, doesn't create)?
- Is `systemctl reload` intended; do the API/admin processes implement SIGHUP reload, or should units use restart? (risk #4)

Status: DONE_WITH_CONCERNS — Plan is largely faithful and internally consistent with complete §8.3 route coverage and precise CONSUMES/PROVIDES contracts, but has a probable deploy-time bug (`prisma migrate deploy` pruned by `--prod`), a no-op `systemctl reload` (no ExecReload), a non-idempotent DB-password lookup, an unverified camelCase contract assumption on `/v1/auth/me`, and a missing UptimeRobot wiring for §11.
