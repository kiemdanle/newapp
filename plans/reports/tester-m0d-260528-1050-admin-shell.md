# Tester Report — M0d Admin Shell (Phases A-I + O)

**Date:** 2026-05-28 10:50 +07
**Branch:** `m0d-admin-shell` (HEAD `7110c5f`, base `main` @ `c734b16`)
**Tag:** `m0d-code-complete` present
**Worktree:** /Users/lekiemdan/newapp (single worktree on this branch — no separate dev-1 worktree)
**Plan:** `docs/superpowers/plans/2026-05-24-m0d-admin-shell-and-infra.md`
**Verdict:** **DONE_WITH_CONCERNS**

Concerns are minor and non-blocking — code itself is correct. Listed at end.

---

## Standard Checks

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | `git status` clean | ⚠️ DIRTY | 13 modified, 13 untracked. Modified incl. `api/.env.test`, `apps/admin/tests/e2e/mock-api.ts`, 11 plan docs. Untracked incl. `.claude/`, `plans/`, `release-manifest.json`, restic envs. None block the M0d code itself; see Concerns. |
| 2 | Commit count `main..HEAD` | ⚠️ 18 (claim: 19) | `git rev-list --count main..HEAD` → **18**. Dev-1 self-reported 19. Off-by-one but not a regression. |
| 3 | Conventional commits, scopes admin/api/repo/infra | ✅ PASS | All 18 commits in `feat(admin)`, `feat(api)`, `fix(admin)`, `test(admin)`, `chore(infra)`, `chore(repo)` — no AI refs, no plan-artifact refs in code/messages. |
| 4 | `pnpm install` | ✅ PASS | Lockfile up-to-date, "Already up to date". |
| 5 | `pnpm typecheck` | ✅ PASS | 5/5 successful (admin, api, shared, theme, root). Exit 0. |
| 6 | `pnpm test` | ✅ PASS | api 21 files / 68 tests, admin 3 files / 11 tests, shared/theme skip. Counts match dev-1's claim exactly. |
| 7 | `pnpm --filter @pantry/admin test:e2e` | ✅ PASS | 3 Playwright tests pass (login w/ password+TOTP, fresh-admin enrollment, redirect on unauth). 8.3s. |
| 8 | `pnpm build` | ✅ PASS | All 4 build tasks succeed. Admin route table includes 22 stub static + 8 Route Handlers + /login. `apps/admin/.next/standalone/apps/admin/server.js` confirmed present (via `find`). Middleware compiled at 32.1 kB. |
| 9 | `pnpm exec prettier --check .` | ✅ PASS | "All matched files use Prettier code style!" |

### Per-Package Test Counts

| Package | Test Files | Tests | Result |
|---|---|---|---|
| @pantry/api | 21 | **68** | all pass |
| @pantry/admin (vitest unit) | 3 | **11** | all pass |
| @pantry/admin (Playwright E2E) | 1 file / 3 cases | **3** | all pass |
| @pantry/shared | 0 | 0 | skip |
| @pantry/theme | 0 | 0 | skip |
| **TOTAL** | **25** | **82** | **82 pass / 0 fail** |

`pnpm exec vitest run audit-log` (re-run isolated): 1 file / 3 tests pass.

---

## Validation — Amendment 4 (No `cookies().set()` in Server Component render)

```bash
$ grep -rnE "cookies\(\)\.set" apps/admin/src/
(no matches)
```
✅ **PASS.** No raw `cookies().set()` anywhere — the project sets cookies exclusively via `res.headers.append('Set-Cookie', …)` on `NextResponse` returned from Route Handlers.

`grep -rnE "Set-Cookie"` hits only:
- `apps/admin/src/app/api/auth/login/route.ts` (3) — Route Handler
- `apps/admin/src/app/api/auth/logout/route.ts` (1) — Route Handler
- `apps/admin/src/app/api/auth/refresh/route.ts` (2) — Route Handler
- `apps/admin/src/app/api/auth/refresh-redirect/route.ts` (2) — Route Handler

Zero hits in `(admin)/` group, `lib/session.ts`, layouts, or any Server Component path.

`apps/admin/src/app/api/auth/refresh-redirect/route.ts` exists. Read confirms:
- Reads refresh cookie via `cookies().get()` (read-only — legal in handler).
- Calls upstream `/v1/auth/refresh`.
- On success, builds `NextResponse.redirect(next)` and `headers.append('Set-Cookie', …)` for both access + refresh tokens.
- Has open-redirect guard via `safeNext()` (only same-origin absolute paths starting `/` and not `//`).

`grep -nE "redirect.*refresh-redirect" apps/admin/src/lib/session.ts`:
```
33: redirect(`/api/auth/refresh-redirect?next=${encodeURIComponent(currentPath)}`);
```
Read of session.ts confirms: on `ApiError(401)` AND refresh cookie present, redirects to refresh-redirect; otherwise to /login. **Never writes cookies.** Comment block makes the rule explicit.

---

## Validation — Amendment 6 (Fresh-admin TOTP enrollment, no-session)

All three Route Handlers exist:
- `apps/admin/src/app/api/auth/login/route.ts`
- `apps/admin/src/app/api/auth/totp/enroll/route.ts`
- `apps/admin/src/app/api/auth/totp/verify-enrollment/route.ts`

Login route propagates 3 branches:
```
35: if (body.requiresTotp === true && typeof body.challengeToken === 'string')
37:   { requiresTotp: true, challengeToken: body.challengeToken }
45: if (body.requiresTotpEnrollment === true && typeof body.enrollmentChallenge === 'string')
47:   { requiresTotpEnrollment: true, enrollmentChallenge: body.enrollmentChallenge }
```
Plus the cookie-emitting success branch (Set-Cookie at lines 77/89/101). ✅ All 3 branches present.

No-session enforcement:
```
$ grep -cnE "Set-Cookie" apps/admin/src/app/api/auth/totp/enroll/route.ts
0
$ grep -cnE "Set-Cookie" apps/admin/src/app/api/auth/totp/verify-enrollment/route.ts
0
```
✅ **PASS.** Neither enroll nor verify-enrollment ever sets cookies.

UI: `apps/admin/src/app/login/totp-enroll-form.tsx` exists and contains:
- L100: `src={enroll.qrCodeDataUrl}` — QR rendered.
- L115: "Save these now — they are shown only once and will not be displayed again."
- L118: maps `enroll.recoveryCodes` to listed items.
✅ "shown only once" copy present, QR + recovery codes rendered.

E2E coverage: `tests/e2e/login.spec.ts` includes `fresh admin without TOTP sees enrollment step with QR + recovery codes` — passes.

---

## admin_audit_log Audit

| Check | Result |
|---|---|
| `model AdminAuditLog` in `api/prisma/schema.prisma` | ✅ Line 179 |
| `api/src/services/audit/log.ts` exists | ✅ |
| `api/tests/integration/audit-log.test.ts` exists | ✅ |
| `pnpm exec vitest run audit-log` | ✅ 3/3 pass |
| New M0d-era migration created? | ✅ **NONE** — `git log --oneline main..HEAD -- api/prisma/migrations/` returns empty. The single migration `20260528005738_init` predates the m0d branch (last touched in `233d837 feat(api): prisma schema for M0 auth tables`). `git diff main..HEAD -- api/prisma/schema.prisma` is empty — schema was already on main. Dev-1's note is verified. |

`writeAuditLog` signature (api/src/services/audit/log.ts):
```ts
interface AuditLogInput {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  diff?: unknown;
  requestId?: string | undefined;
  ip?: string | undefined;
}
```
Validates required fields; uses `Prisma.JsonNull` when `diff === undefined`. **Slight deviation from plan-stated signature** — plan called for `(actor, action, target, metadata, ip)`. Implementation uses `(adminId, action, targetType, targetId, diff, requestId, ip)`. Functionally equivalent (actor→adminId, target→targetType+targetId, metadata→diff) and adds `requestId` for traceability. Acceptable; not a regression.

---

## Phase H — Stub Pages Inventory

`find apps/admin/src/app/(admin) -name page.tsx | wc -l` → **22**

Plan called for 22 (overview + 21 sections). All present:

| Path | Present |
|---|---|
| `(admin)/page.tsx` (overview) | ✅ |
| `users/page.tsx`, `users/[id]/page.tsx` | ✅ ✅ |
| `products/page.tsx`, `products/[id]/page.tsx`, `products/pending/page.tsx` | ✅ ✅ ✅ |
| `reviews/page.tsx`, `reviews/[id]/page.tsx` | ✅ ✅ |
| `reports/page.tsx`, `reports/[id]/page.tsx` | ✅ ✅ |
| `analytics/{overview,scans,reviews,geography}/page.tsx` | ✅ ✅ ✅ ✅ |
| `system/{queue,push,api-errors,external-apis}/page.tsx` | ✅ ✅ ✅ ✅ |
| `settings/{feature-flags,notification-templates,moderation,admins}/page.tsx` | ✅ ✅ ✅ ✅ |

All 22 also confirmed in build route output.

---

## Phase O — Renovate + Weekly Audit

| File | Status |
|---|---|
| `renovate.json` | ✅ Exists at repo root |
| `.github/workflows/audit.yml` | ✅ Exists |

`audit.yml` is **not** a deploy workflow:
- `on.schedule.cron: '0 7 * * 1'` — Mon 07:00 UTC ✅
- `workflow_dispatch` for manual trigger
- Single job runs `pnpm audit --json`, opens GitHub issue tagged `security, deps` on findings
- **No SSH, no scp, no rsync, no ansible-runner, no remote deploy step.**

`ls .github/workflows/` → **only `audit.yml`** (no deploy.yml).

---

## INFRA DEFERRAL Audit (CRITICAL)

| Check | Result |
|---|---|
| `infra/` directory | ✅ Does not exist |
| Ansible YAMLs (`*/ansible/*.yml`) | ✅ None |
| `.service` files | ✅ None outside node_modules |
| `deploy*.yml` anywhere | ✅ None |
| `playbook*.yml` anywhere | ✅ None |
| `.github/workflows/deploy.yml` | ✅ Not present (only audit.yml) |

✅ **PASS.** No partial infra implementation. Phases J-N cleanly deferred.

---

## Reconciliation Deviation Audit (dev-1's 6 self-flagged deviations)

### Deviation 1: Wiped existing `apps/admin/src/` and root configs

`git log --oneline main -- apps/admin/src/` → **empty** (no history on main).
`git log --oneline -- apps/admin/src/` → only m0d branch commits.

✅ **CONFIRMED CORRECT.** The previous src/ (per dev-1's claim, mock-data UI) had no committed history on main, so wiping it lost no traceable work. New structure follows plan (env, cookies, csrf, api wrappers, route handlers, login form, (admin) group). Acceptable.

### Deviation 2: Kept `components.json` style=new-york + slate (plan said default + neutral)

Confirmed in components.json (style: "new-york", baseColor: "slate"). ✅ **MINOR DEVIATION, ACCEPTABLE.** Both are valid shadcn options; slate is a darker variant of neutral. No functional impact on M0d (only login + stub pages render). Should be confirmed by team-lead before M3 begins, since M3 will lock in the design system.

### Deviation 3: Port 3001 → 4001

Verified:
- `apps/admin/package.json:6` → `next dev -p 4001`
- `apps/admin/playwright.config.ts:10,22-23` → `4001`
- `grep -rE "3001"` in `apps/admin/` — **zero hits**

✅ **CONFIRMED CORRECT.** Per team-lead instruction (matches mobile shell pattern of nudging up from 30xx range to avoid macOS Control Center 5000/AirPlay collision).

### Deviation 4: `next.config.ts` → `next.config.mjs` + webpack `extensionAlias`

Read `apps/admin/next.config.mjs`:
- `output: 'standalone'` ✅ (plan-required)
- `reactStrictMode: true`, `poweredByHeader: false` ✅
- `experimental.typedRoutes: true` ✅
- `transpilePackages: ['@pantry/shared']` ✅
- `webpack` hook: `config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs'] }` ✅

✅ **CONFIRMED CORRECT.** This is a genuine necessity given M0a's `@pantry/shared` uses Node-ESM `.js` import specifiers in TS sources. Without extensionAlias the admin webpack build fails to resolve `@pantry/shared/*.js`. Build now passes, evidenced by 5/5 typecheck and full build success. Switch to `.mjs` is required because `next.config.ts` cannot use ESM webpack hooks easily; pragmatic and standard.

### Deviation 5: `tsx@^4.19.0` in admin devDependencies

`apps/admin/package.json:42` → `"tsx": "^4.19.0"` in **devDependencies** (not dependencies). ✅ Correctly scoped.

Used by Playwright webServer: `pnpm exec tsx tests/e2e/mock-api.ts` (playwright.config.ts:15). ✅ **CONFIRMED CORRECT** — necessary to boot the in-process mock API.

### Deviation 6: Next 15.0.0 → 15.1.3

```
apps/admin/package.json:24 → "next": "15.1.3"
pnpm-lock.yaml: next@15.1.3 (resolved)
```
✅ **CONFIRMED CORRECT.** 15.0.0 has known regressions; 15.1.3 is the active stable in the 15.x line aligned with React 19. No breaking changes for our usage. Lockfile is updated and consistent.

---

## Plan-Typo Fix Audit (dev-1's 4 fixes)

### Fix A: `RequestInit` built conditionally (exactOptionalPropertyTypes)

`apps/admin/src/lib/api.ts:39-44` and `api-client.ts:29-34`:
```ts
const init: RequestInit = { ... };
if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
```
✅ Conditional assignment after object construction — required because `exactOptionalPropertyTypes: true` in tsconfig disallows passing `body: undefined` directly. **Correct.**

### Fix B: Value import of Prisma in audit/log.ts

`api/src/services/audit/log.ts:1`:
```ts
import { Prisma } from '@prisma/client';
```
✅ Value import, not `import type`. Required because `Prisma.JsonNull` is used at runtime (line 29: `Prisma.JsonNull`). **Correct.**

### Fix C: E2E post-login assertion `/implemented in M3/i`

`apps/admin/tests/e2e/login.spec.ts:18`:
```ts
await expect(page.getByText(/implemented in M3/i)).toBeVisible();
```
✅ Targets the unique stub-page copy ("Implemented in M3") rather than the colliding "Overview" header. Test passes.

### Fix D: Mock-API split into `mock-api-constants.ts` + `mock-api.ts`

Both files exist:
- `apps/admin/tests/e2e/mock-api-constants.ts`
- `apps/admin/tests/e2e/mock-api.ts`

`login.spec.ts:4`: `import { E2E_ADMIN_ENROLLED, E2E_ADMIN_FRESH } from './mock-api-constants';` ✅ Spec imports constants only — no side-effect server boot at spec load. **Correct.**

`playwright.config.ts:5` `testIgnore: ['**/mock-api.ts']` prevents the server file from being treated as a test. ✅

---

## Concerns to Surface Before Merge

1. **Working tree is dirty (13 modified + 13 untracked).** Code under `apps/admin/`, `api/src/`, `api/prisma/` is clean. The dirty files are:
   - `api/.env.test` — `RATE_LIMIT_AUTH_PER_IP_PER_MIN` 5 → 30. Likely legitimate (M0b auth test stability) but **uncommitted**.
   - `apps/admin/tests/e2e/mock-api.ts` — type-only refactor (`createServer` parameter types extracted to `IncomingMessage`/`ServerResponse`). Functionally equivalent; tests still pass. **Uncommitted.**
   - 11 docs/superpowers/plans/*.md files — plan amendments, **uncommitted**.
   - Untracked: `.claude/`, `plans/`, `release-manifest.json`, `restic_*.env`, `content/`, `api/_print-routes.mts`, several plan markdowns. Most should remain untracked or be added to `.gitignore`. The `restic_*.env` files **must not be committed** (likely backup credentials).

   **Recommendation:** Team-lead decides whether the dirty `api/.env.test` and `mock-api.ts` changes should be committed onto the `m0d-admin-shell` branch before merge, or reverted. The plan-doc edits are out of scope for M0d.

2. **Commit count off-by-one.** Dev-1 reported 19 commits; actual is 18 between `main` and HEAD. Not a regression — just a counting discrepancy.

3. **`writeAuditLog` field names diverge from plan signature.** Plan: `(actor, action, target, metadata, ip)`. Code: `(adminId, action, targetType, targetId, diff, requestId, ip)`. Functionally equivalent and arguably better (explicit `targetType` + `targetId` pair, dedicated `requestId` for traceability). M3 admin mutation code will need to be aware of the actual signature. **Not blocking.**

4. **components.json `new-york` + `slate` instead of `default` + `neutral`.** Both are valid shadcn variants. Should be locked in by team-lead before M3 design work begins to avoid late churn.

5. **No worktree.** `git worktree list` shows only the root checkout on `m0d-admin-shell`. Dev-1 did not use a separate worktree (all checks ran against the primary working copy). Not a regression — just clarifies the team-lead briefing's expectation of a separate worktree was not realized.

6. **Build artifact `apps/admin/.next/` is excluded by ckignore.** I verified `apps/admin/.next/standalone/apps/admin/server.js` exists via `find`, since `ls` against the path is blocked. Build succeeded; standalone server.js is present.

---

## Unresolved Questions

- Does team-lead want the uncommitted `api/.env.test` rate-limit bump (5→30) committed onto this branch, reverted, or moved to a separate commit?
- Same question for the `mock-api.ts` type-import refactor (currently uncommitted but tests rely on no behavior change).
- Should `restic_contabo.env` / `restic_hetzner.env` be added to `.gitignore` immediately to prevent accidental commit of backup credentials?
- Should `components.json` style be aligned with the plan (default + neutral) before M3 design work locks in?
