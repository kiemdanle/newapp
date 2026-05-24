# M0d — Admin Shell + Infra + Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 15 admin app shell (login + TOTP + session middleware + CSRF + stub pages for every M3 route), add the `admin_audit_log` Prisma table + audit helper, provision the single VPS end-to-end with Ansible (Postgres, Redis, Node, nginx, certbot, systemd, secrets, ufw, fail2ban), wire a `main`-branch deploy pipeline (test → build → atomic symlink flip with rollback), and automate encrypted offsite backups with a 7/4/3 daily/weekly/monthly rotation.

**Architecture:** Admin runs as a separate Next.js 15 standalone server on `127.0.0.1:4001` behind an nginx vhost (`admin.<domain>`) with TLS + IP allowlist. Tokens live in HTTP-only cookies set by Next.js Route Handlers that proxy `/v1/auth/*` from the Fastify API. CSRF uses a double-submit cookie pattern (`pantry_admin_csrf` cookie + matching `X-CSRF-Token` header). The host is a non-Dockerized Ubuntu 22.04/24.04 LTS VPS provisioned by an idempotent Ansible playbook. GitHub Actions builds artifacts and rsyncs them to `/opt/pantry/releases/<sha>/`; an atomic `ln -sfn` flip + `systemctl reload` swap traffic, with smoke tests against `/health/ready` and automatic symlink rollback on failure. Backups are `pg_dump | age | rclone` with a local rotation script.

**Tech Stack:** Next.js 15 (App Router, standalone output), TypeScript 5 strict, Tailwind CSS 3, shadcn/ui, TanStack Query 5, TanStack Table 8, Zod 3, Playwright 1.45+, Vitest 2, Ansible 2.15+, Ubuntu 22.04/24.04 LTS, PostgreSQL 16, Redis 7, Node 20 LTS, nginx, certbot, systemd, ufw, fail2ban, age, rclone, GitHub Actions, Renovate.

**Spec reference:** `docs/superpowers/specs/2026-05-23-pantry-app-design.md`. Read sections 3 (non-functional), 4.2 (runtime topology), 5 (`admin_audit_log` row), 6.7 (admin endpoint list — referenced only; bodies are M3), 8 (admin dashboard), 10 (deployment), 11 (observability) before starting.

**Sister plans (executed in parallel during M0):**

1. **M0a** — Foundation: monorepo, shared schemas, theme tokens, API skeleton, auth services (already merged)
2. **M0b** — API auth routes including `POST /v1/auth/login` + TOTP enroll/verify (already merged)
3. **M0c** — Mobile app shell (parallel; this plan does not touch `apps/mobile/`)
4. **M0d (this plan)** — Admin shell + VPS infra + deploy pipeline + backups

**Cross-milestone dependencies this plan relies on:**

- `GET /health` and `GET /health/ready` from M0a — verified in Task A2 before the deploy smoke test is wired
- `POST /v1/auth/login` returning either `{user, tokens}` or `{requiresTotp: true, challengeToken}` from M0b
- `POST /v1/auth/totp/challenge-verify` exchanging `{challengeToken, code}` for `{user, tokens}` from M0b
- `GET /v1/auth/me` and `POST /v1/auth/refresh` from M0b
- Shared Zod schemas in `@pantry/shared` from M0a (extended here for admin login forms only)

**Out of scope (other milestones):**

- Mobile shell, theme switcher, mobile auth flow — M0c
- All feature work (records, products, reviews) — M1/M2
- The bodies of admin pages and the `/v1/admin/*` routes themselves — M3 (this plan only ships stubbed pages and the audit-log helper they will call)
- Theme polish, store submission, restore-drill checklist, full runbooks — M4

---

## File map

Files in **bold** carry significant logic; the rest are config, wiring, or stubs.

```
pantry/
├── api/
│   ├── prisma/schema.prisma                              ← extended (admin_audit_log)
│   ├── prisma/migrations/<ts>_admin_audit_log/           ← generated
│   ├── src/services/audit/
│   │   └── **log.ts**                                    ← writeAuditLog()
│   └── tests/integration/audit-log.test.ts
├── apps/
│   └── admin/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.mjs
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       ├── components.json                               ← shadcn/ui config
│       ├── .env.example
│       ├── .env.test.example
│       ├── playwright.config.ts
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── globals.css
│       │   │   ├── page.tsx                              ← / overview stub
│       │   │   ├── login/page.tsx
│       │   │   ├── login/totp-form.tsx
│       │   │   ├── (admin)/layout.tsx                    ← header + sidebar
│       │   │   ├── (admin)/users/page.tsx
│       │   │   ├── (admin)/users/[id]/page.tsx
│       │   │   ├── (admin)/products/page.tsx
│       │   │   ├── (admin)/products/[id]/page.tsx
│       │   │   ├── (admin)/products/pending/page.tsx
│       │   │   ├── (admin)/reviews/page.tsx
│       │   │   ├── (admin)/reviews/[id]/page.tsx
│       │   │   ├── (admin)/reports/page.tsx
│       │   │   ├── (admin)/reports/[id]/page.tsx
│       │   │   ├── (admin)/analytics/overview/page.tsx
│       │   │   ├── (admin)/analytics/scans/page.tsx
│       │   │   ├── (admin)/analytics/reviews/page.tsx
│       │   │   ├── (admin)/analytics/geography/page.tsx
│       │   │   ├── (admin)/system/queue/page.tsx
│       │   │   ├── (admin)/system/push/page.tsx
│       │   │   ├── (admin)/system/api-errors/page.tsx
│       │   │   ├── (admin)/system/external-apis/page.tsx
│       │   │   ├── (admin)/settings/feature-flags/page.tsx
│       │   │   ├── (admin)/settings/notification-templates/page.tsx
│       │   │   ├── (admin)/settings/moderation/page.tsx
│       │   │   ├── (admin)/settings/admins/page.tsx
│       │   │   └── api/
│       │   │       ├── auth/login/route.ts               ← Route Handler proxy → cookies
│       │   │       ├── auth/totp/route.ts                ← Route Handler proxy → cookies
│       │   │       ├── auth/logout/route.ts
│       │   │       ├── auth/refresh/route.ts
│       │   │       └── auth/me/route.ts
│       │   ├── components/
│       │   │   ├── header.tsx
│       │   │   ├── sidebar.tsx
│       │   │   ├── nav-link.tsx
│       │   │   ├── providers.tsx                         ← QueryClientProvider
│       │   │   └── ui/                                   ← shadcn primitives (button, input, label, alert)
│       │   ├── lib/
│       │   │   ├── api.ts                                ← server-side fetch wrapper
│       │   │   ├── api-client.ts                         ← browser fetch wrapper w/ CSRF
│       │   │   ├── cookies.ts                            ← cookie names + helpers
│       │   │   ├── csrf.ts                               ← double-submit token helpers
│       │   │   ├── env.ts                                ← Zod-validated env
│       │   │   ├── nav.ts                                ← sidebar nav config
│       │   │   └── utils.ts                              ← cn()
│       │   └── middleware.ts                             ← session gate + role check
│       └── tests/
│           ├── unit/csrf.test.ts
│           ├── unit/cookies.test.ts
│           ├── unit/env.test.ts
│           └── e2e/login.spec.ts
├── infra/
│   ├── README.md
│   ├── ansible.cfg
│   ├── inventory.example.ini
│   ├── site.yml
│   ├── group_vars/
│   │   └── all.example.yml
│   ├── roles/
│   │   ├── common/
│   │   │   ├── tasks/main.yml
│   │   │   ├── handlers/main.yml
│   │   │   └── files/logrotate-pantry
│   │   ├── postgres/
│   │   │   ├── tasks/main.yml
│   │   │   ├── handlers/main.yml
│   │   │   └── templates/pg_hba.conf.j2
│   │   ├── redis/
│   │   │   ├── tasks/main.yml
│   │   │   ├── handlers/main.yml
│   │   │   └── templates/redis.conf.j2
│   │   ├── nodejs/
│   │   │   └── tasks/main.yml
│   │   ├── nginx/
│   │   │   ├── tasks/main.yml
│   │   │   ├── handlers/main.yml
│   │   │   ├── templates/api.vhost.j2
│   │   │   ├── templates/admin.vhost.j2
│   │   │   └── files/allowlist.conf
│   │   ├── certbot/
│   │   │   ├── tasks/main.yml
│   │   │   └── files/reload-nginx.sh
│   │   ├── app/
│   │   │   ├── tasks/main.yml
│   │   │   ├── handlers/main.yml
│   │   │   ├── templates/pantry-api.service.j2
│   │   │   ├── templates/pantry-admin.service.j2
│   │   │   └── templates/sudoers-pantry.j2
│   │   └── secrets/
│   │       └── tasks/main.yml
│   └── scripts/
│       ├── backup.sh
│       ├── restore.sh
│       └── deploy-remote.sh                              ← invoked by GitHub Actions over SSH
├── .github/
│   └── workflows/
│       ├── deploy.yml
│       └── audit.yml
└── renovate.json
```

---

## Conventions

- **Always-on TDD where logic exists.** Write the failing test first, watch it fail, implement, watch it pass, commit. Where there is no testable logic (a stub page, a vhost template, a systemd unit), write a structural assertion (the file exists and contains expected literal markers) or run an idempotency check (re-running the role makes no changes).
- **Conventional commits.** Two scopes only in this plan:
  - `admin` — anything under `apps/admin/` and the `admin_audit_log` schema + service that the admin will call
  - `infra` — anything under `infra/`, `.github/workflows/`, `renovate.json`
- **Commit after every passing task**, never accumulate.
- **No `console.log` in admin source.** Use `console.error` only inside catch blocks in Route Handlers — surfaced through Next.js server logs.
- **No localStorage for tokens.** Tokens always travel through HTTP-only cookies set by the Next.js Route Handlers in `src/app/api/auth/*`.
- **Type safety end-to-end.** Admin imports Zod schemas from `@pantry/shared`. New admin-only schemas live in `packages/shared/src/schemas/admin.ts`.
- **Idempotent Ansible.** Every role MUST be safely re-runnable; verification step `ansible-playbook --check` reports zero changes after a fresh apply.
- **No Docker anywhere.** All services run as native systemd units.
- **Ubuntu 22.04 and 24.04 LTS both supported.** When a task differs by version, use `ansible_distribution_version` gates.

---

## Phase A — Pre-flight: confirm upstream dependencies

### Task A1: Confirm M0a/M0b health endpoints exist

**Files:** none modified

- [ ] **Step 1: Read `api/src/routes/health.ts`**

Run:
```bash
cat api/src/routes/health.ts
```
Expected: the file defines `GET /health` returning `{ status: 'ok' }` and `GET /health/ready` returning `{ status: 'ready' }` after probing Prisma and Redis. If either route is missing, STOP — M0a is not green and this plan cannot start.

- [ ] **Step 2: Verify both endpoints respond locally**

```bash
pnpm --filter @pantry/api dev &
sleep 3
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/health/ready
kill %1
```
Expected: both print `{"status":"ok"}` and `{"status":"ready"}` respectively.

- [ ] **Step 3: Verify M0b login response shape**

```bash
grep -n "requiresTotp\|challengeToken\|challenge-verify" api/src/routes/auth/login.ts api/src/routes/auth/totp.ts
```
Expected: `login.ts` returns `{ requiresTotp: true, challengeToken }` when the user is an admin with TOTP enabled; `totp.ts` registers `POST /v1/auth/totp/challenge-verify`, accepts `{ challengeToken, code }`, and returns `{ user, tokens }`. If any of these are missing, STOP — M0b is incomplete. (Note: the path is `challenge-verify`, NOT `verify` — `/v1/auth/totp/verify` is the enrollment confirm endpoint, not the login challenge endpoint.)

- [ ] **Step 4: No commit (verification only)**

---

## Phase B — Shared admin schemas

### Task B1: Add admin-form schemas to `@pantry/shared`

**Files:**
- Create: `packages/shared/src/schemas/admin.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/admin.ts`**

```ts
import { z } from 'zod';

export const adminLoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});
export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;

export const adminTotpRequestSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});
export type AdminTotpRequest = z.infer<typeof adminTotpRequestSchema>;
```

- [ ] **Step 2: Append export in `packages/shared/src/index.ts`**

Add the new line after the existing `export * from './schemas/error.js';`:

```ts
export * from './schemas/admin.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @pantry/shared typecheck
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared
git commit -m "feat(admin): add admin login + TOTP request schemas to @pantry/shared"
```

---

## Phase C — `admin_audit_log` schema + writer service

### Task C1: Confirm Prisma model already exists, add unique index for idempotency

**Files:**
- Read: `api/prisma/schema.prisma`

- [ ] **Step 1: Confirm `AdminAuditLog` model is present**

```bash
grep -A 14 "^model AdminAuditLog" api/prisma/schema.prisma
```
Expected: the model exists with fields `id, adminId, action, targetType, targetId, diff, requestId, ip, createdAt` and indexes `[adminId]` + `[targetType, targetId]` (added in M0a, Task D4). If missing, STOP and revisit M0a.

- [ ] **Step 2: No commit (verification only)**

---

### Task C2: Write the failing test for `writeAuditLog`

**Files:**
- Create: `api/tests/integration/audit-log.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/audit-log.test.ts
import { describe, expect, it } from 'vitest';
import { writeAuditLog } from '../../src/services/audit/log.js';
import { getPrisma } from '../../src/db.js';
import { makeUser } from '../helpers/factories.js';

describe('writeAuditLog', () => {
  it('inserts a row with all provided fields', async () => {
    const admin = await makeUser({ role: 'admin' });

    await writeAuditLog({
      adminId: admin.id,
      action: 'user.suspend',
      targetType: 'user',
      targetId: 'target-uuid',
      diff: { before: { status: 'active' }, after: { status: 'suspended' } },
      requestId: 'req-123',
      ip: '203.0.113.7',
    });

    const rows = await getPrisma().adminAuditLog.findMany({ where: { adminId: admin.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe('user.suspend');
    expect(rows[0]?.targetType).toBe('user');
    expect(rows[0]?.targetId).toBe('target-uuid');
    expect(rows[0]?.requestId).toBe('req-123');
    expect(rows[0]?.ip).toBe('203.0.113.7');
    expect(rows[0]?.diff).toEqual({
      before: { status: 'active' },
      after: { status: 'suspended' },
    });
  });

  it('accepts an optional diff and null-ish request metadata', async () => {
    const admin = await makeUser({ role: 'admin' });

    await writeAuditLog({
      adminId: admin.id,
      action: 'product.merge',
      targetType: 'product',
      targetId: 'p-1',
    });

    const row = await getPrisma().adminAuditLog.findFirstOrThrow({ where: { adminId: admin.id } });
    expect(row.diff).toBeNull();
    expect(row.requestId).toBeNull();
    expect(row.ip).toBeNull();
  });

  it('throws if adminId is missing', async () => {
    await expect(
      writeAuditLog({
        adminId: '',
        action: 'noop',
        targetType: 'user',
        targetId: 'x',
      }),
    ).rejects.toThrow(/adminId/);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/audit-log.test.ts
```
Expected: FAIL — `Cannot find module '../../src/services/audit/log.js'`.

- [ ] **Step 3: No commit yet (red phase).**

---

### Task C3: Implement `writeAuditLog`

**Files:**
- Create: `api/src/services/audit/log.ts`

- [ ] **Step 1: Write `api/src/services/audit/log.ts`**

```ts
import { getPrisma } from '../../db.js';

export interface AuditLogInput {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  diff?: unknown;
  requestId?: string | undefined;
  ip?: string | undefined;
}

/**
 * Append-only writer for admin_audit_log. Called from every admin mutation in M3.
 */
export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  if (!input.adminId) throw new Error('adminId is required');
  if (!input.action) throw new Error('action is required');
  if (!input.targetType) throw new Error('targetType is required');
  if (!input.targetId) throw new Error('targetId is required');

  await getPrisma().adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      diff: input.diff === undefined ? null : (input.diff as object),
      requestId: input.requestId ?? null,
      ip: input.ip ?? null,
    },
  });
}
```

- [ ] **Step 2: Create the directory if it does not exist**

```bash
mkdir -p api/src/services/audit
```

- [ ] **Step 3: Run the test, verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/audit-log.test.ts
```
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add api/src/services/audit/log.ts api/tests/integration/audit-log.test.ts
git commit -m "feat(admin): add writeAuditLog service for admin_audit_log table"
```

---

## Phase D — Admin app scaffold

### Task D1: Verify Node + pnpm versions

**Files:** none

- [ ] **Step 1: Check Node**

```bash
node --version
```
Expected: `v20.x.x`. If not, `nvm install 20 && nvm use 20`.

- [ ] **Step 2: Check pnpm**

```bash
pnpm --version
```
Expected: `9.x.x`.

- [ ] **Step 3: No commit (system check)**

---

### Task D2: Scaffold `apps/admin` Next.js 15 + TS

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/next.config.mjs`
- Create: `apps/admin/next-env.d.ts`
- Create: `apps/admin/.gitignore`
- Create: `apps/admin/postcss.config.mjs`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/src/app/globals.css`
- Create: `apps/admin/src/app/layout.tsx`
- Create: `apps/admin/src/app/page.tsx`
- Create: `apps/admin/src/lib/utils.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p apps/admin/src/{app,components,lib} apps/admin/tests/{unit,e2e}
```

- [ ] **Step 2: Write `apps/admin/package.json`**

```json
{
  "name": "@pantry/admin",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 4001",
    "build": "next build",
    "start": "node .next/standalone/apps/admin/server.js",
    "lint": "next lint --dir src --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "clean": "rm -rf .next .turbo node_modules/.cache"
  },
  "dependencies": {
    "@pantry/shared": "workspace:*",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@tanstack/react-query": "^5.51.0",
    "@tanstack/react-table": "^8.20.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.408.0",
    "next": "15.0.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "tailwind-merge": "^2.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.45.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "15.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Write `apps/admin/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "allowJs": false,
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*", "tests/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

- [ ] **Step 4: Write `apps/admin/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ['@pantry/shared'],
};

export default nextConfig;
```

- [ ] **Step 5: Write `apps/admin/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 6: Write `apps/admin/.gitignore`**

```
.next/
out/
.turbo/
playwright-report/
test-results/
*.tsbuildinfo
```

- [ ] **Step 7: Write `apps/admin/postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 8: Write `apps/admin/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 9: Write `apps/admin/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 4%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 4%;
    --primary: 240 6% 10%;
    --primary-foreground: 0 0% 98%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 6% 90%;
    --radius: 0.5rem;
  }

  * {
    border-color: hsl(var(--border));
  }

  body {
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family:
      system-ui,
      -apple-system,
      Segoe UI,
      Roboto,
      sans-serif;
  }
}
```

- [ ] **Step 10: Write `apps/admin/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 11: Write `apps/admin/src/app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Pantry Admin',
  description: 'Pantry administration dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 12: Write `apps/admin/src/app/page.tsx` (temporary, replaced when (admin) group lands)**

```tsx
export default function HomePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Pantry Admin</h1>
      <p className="mt-2 text-muted-foreground">
        Overview dashboard. This page is implemented in M3.
      </p>
    </main>
  );
}
```

- [ ] **Step 13: Install workspace deps**

```bash
pnpm install
```
Expected: lockfile updated, no errors.

- [ ] **Step 14: Build to verify the scaffold compiles**

```bash
pnpm --filter @pantry/admin build
```
Expected: prints `Compiled successfully`, produces `apps/admin/.next/standalone/`.

- [ ] **Step 15: Smoke-test the `start` script's standalone path**

This catches mis-specified `standalone` output paths (Next.js writes the server to `.next/standalone/apps/admin/server.js` in a monorepo, NOT `.next/standalone/server.js`) BEFORE we wire systemd + nginx and discover the path is wrong in production. We curl `/` (the temporary page) since `/login` doesn't exist yet — a richer login smoke runs in Task F2 / Task I3.

```bash
pnpm --filter @pantry/admin build && \
  node apps/admin/.next/standalone/apps/admin/server.js -p 4001 &
SMOKE_PID=$!
sleep 2
curl -fsS http://localhost:4001/ | grep -q "Pantry Admin"
SMOKE_RC=$?
kill $SMOKE_PID 2>/dev/null || true
wait $SMOKE_PID 2>/dev/null || true
test $SMOKE_RC -eq 0 || { echo "Standalone smoke failed — check next.config.mjs output path"; exit 1; }
```
Expected: exits 0. If the `node` invocation errors with `Cannot find module`, the standalone path in the `start` script of `package.json` is wrong for this monorepo layout — fix it before continuing.

- [ ] **Step 16: Commit**

```bash
git add apps/admin pnpm-lock.yaml
git commit -m "feat(admin): scaffold Next.js 15 app with Tailwind + standalone output"
```

---

### Task D3: Install shadcn/ui primitives manually (button, input, label, alert)

**Files:**
- Create: `apps/admin/components.json`
- Create: `apps/admin/src/components/ui/button.tsx`
- Create: `apps/admin/src/components/ui/input.tsx`
- Create: `apps/admin/src/components/ui/label.tsx`
- Create: `apps/admin/src/components/ui/alert.tsx`

We vendor only the four primitives needed for the login flow and sidebar shell. M3 will add more as it implements pages.

- [ ] **Step 1: Write `apps/admin/components.json`** (records the shadcn config for future tasks)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

- [ ] **Step 2: Write `apps/admin/src/components/ui/button.tsx`**

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border bg-background hover:bg-muted',
        ghost: 'hover:bg-muted',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';
```

- [ ] **Step 3: Write `apps/admin/src/components/ui/input.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

- [ ] **Step 4: Write `apps/admin/src/components/ui/label.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';
```

- [ ] **Step 5: Write `apps/admin/src/components/ui/alert.tsx`**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const alertVariants = cva('relative w-full rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      default: 'bg-background text-foreground',
      destructive: 'border-destructive/50 text-destructive bg-destructive/5',
    },
  },
  defaultVariants: { variant: 'default' },
});

export const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/components.json apps/admin/src/components/ui
git commit -m "feat(admin): vendor shadcn/ui primitives (button, input, label, alert)"
```

---

### Task D4: Env loader for admin

**Files:**
- Create: `apps/admin/src/lib/env.ts`
- Create: `apps/admin/.env.example`
- Create: `apps/admin/.env.test.example`
- Create: `apps/admin/vitest.config.ts`
- Create: `apps/admin/tests/unit/env.test.ts`

- [ ] **Step 1: Write `apps/admin/.env.example`**

```bash
# Server-only — never exposed to the browser
API_BASE_URL=http://localhost:4000
COOKIE_SECURE=false
COOKIE_DOMAIN=
PORT=4001
NODE_ENV=development
```

- [ ] **Step 2: Write `apps/admin/.env.test.example`**

```bash
API_BASE_URL=http://localhost:4000
COOKIE_SECURE=false
COOKIE_DOMAIN=
PORT=4001
NODE_ENV=test
```

- [ ] **Step 3: Write `apps/admin/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 4: Write the failing test `apps/admin/tests/unit/env.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseAdminEnv } from '@/lib/env';

describe('parseAdminEnv', () => {
  const base = {
    API_BASE_URL: 'http://localhost:4000',
    COOKIE_SECURE: 'false',
    COOKIE_DOMAIN: '',
    NODE_ENV: 'development',
  };

  it('parses a valid env', () => {
    const cfg = parseAdminEnv(base);
    expect(cfg.apiBaseUrl).toBe('http://localhost:4000');
    expect(cfg.cookieSecure).toBe(false);
    expect(cfg.cookieDomain).toBeUndefined();
  });

  it('coerces COOKIE_SECURE=true', () => {
    expect(parseAdminEnv({ ...base, COOKIE_SECURE: 'true' }).cookieSecure).toBe(true);
  });

  it('rejects a non-URL API_BASE_URL', () => {
    expect(() => parseAdminEnv({ ...base, API_BASE_URL: 'not-a-url' })).toThrow();
  });
});
```

- [ ] **Step 5: Run the test, verify FAIL**

```bash
pnpm --filter @pantry/admin exec vitest run tests/unit/env.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/env'`.

- [ ] **Step 6: Write `apps/admin/src/lib/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  API_BASE_URL: z.string().url(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export interface AdminEnv {
  apiBaseUrl: string;
  cookieSecure: boolean;
  cookieDomain: string | undefined;
  nodeEnv: 'development' | 'test' | 'production';
}

export function parseAdminEnv(source: Record<string, string | undefined>): AdminEnv {
  const e = envSchema.parse(source);
  return {
    apiBaseUrl: e.API_BASE_URL,
    cookieSecure: e.COOKIE_SECURE,
    cookieDomain: e.COOKIE_DOMAIN === '' ? undefined : e.COOKIE_DOMAIN,
    nodeEnv: e.NODE_ENV,
  };
}

let cached: AdminEnv | undefined;
export function getAdminEnv(): AdminEnv {
  if (!cached) cached = parseAdminEnv(process.env as Record<string, string | undefined>);
  return cached;
}
```

- [ ] **Step 7: Run the test, verify pass**

```bash
pnpm --filter @pantry/admin exec vitest run tests/unit/env.test.ts
```
Expected: 3 passed.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/.env.example apps/admin/.env.test.example apps/admin/vitest.config.ts apps/admin/src/lib/env.ts apps/admin/tests/unit/env.test.ts
git commit -m "feat(admin): zod-validated env loader"
```

---

### Task D5: Cookie helpers

**Files:**
- Create: `apps/admin/src/lib/cookies.ts`
- Create: `apps/admin/tests/unit/cookies.test.ts`

- [ ] **Step 1: Write the failing test `apps/admin/tests/unit/cookies.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';

describe('cookies', () => {
  it('exposes stable cookie names', () => {
    expect(COOKIE_NAMES.access).toBe('pantry_admin_access');
    expect(COOKIE_NAMES.refresh).toBe('pantry_admin_refresh');
    expect(COOKIE_NAMES.csrf).toBe('pantry_admin_csrf');
  });

  it('builds an HTTP-only access cookie with a TTL', () => {
    const c = buildSetCookie({
      name: COOKIE_NAMES.access,
      value: 'a.b.c',
      maxAgeSec: 900,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    expect(c).toContain('pantry_admin_access=a.b.c');
    expect(c).toContain('Path=/');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Secure');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Max-Age=900');
  });

  it('builds a non-HTTP-only CSRF cookie (readable by JS)', () => {
    const c = buildSetCookie({
      name: COOKIE_NAMES.csrf,
      value: 'csrf-token-value',
      maxAgeSec: 900,
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
    });
    expect(c).not.toContain('HttpOnly');
    expect(c).not.toContain('Secure');
  });

  it('builds an expiring delete cookie', () => {
    const c = buildSetCookie({
      name: COOKIE_NAMES.access,
      value: '',
      maxAgeSec: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    expect(c).toContain('Max-Age=0');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/admin exec vitest run tests/unit/cookies.test.ts
```

- [ ] **Step 3: Write `apps/admin/src/lib/cookies.ts`**

```ts
export const COOKIE_NAMES = {
  access: 'pantry_admin_access',
  refresh: 'pantry_admin_refresh',
  csrf: 'pantry_admin_csrf',
} as const;

export interface SetCookieOptions {
  name: string;
  value: string;
  maxAgeSec: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  domain?: string | undefined;
  path?: string | undefined;
}

export function buildSetCookie(opts: SetCookieOptions): string {
  const parts: string[] = [`${opts.name}=${opts.value}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  parts.push(`Max-Age=${opts.maxAgeSec}`);
  parts.push(`SameSite=${opts.sameSite.charAt(0).toUpperCase()}${opts.sameSite.slice(1)}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join('; ');
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @pantry/admin exec vitest run tests/unit/cookies.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/cookies.ts apps/admin/tests/unit/cookies.test.ts
git commit -m "feat(admin): cookie name constants and Set-Cookie builder"
```

---

### Task D6: CSRF token helpers (double-submit pattern)

**Files:**
- Create: `apps/admin/src/lib/csrf.ts`
- Create: `apps/admin/tests/unit/csrf.test.ts`

- [ ] **Step 1: Write the failing test `apps/admin/tests/unit/csrf.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { generateCsrfToken, isCsrfValid } from '@/lib/csrf';

describe('csrf', () => {
  it('generateCsrfToken returns a 43+ char url-safe string', () => {
    const t = generateCsrfToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(generateCsrfToken()).not.toBe(t);
  });

  it('isCsrfValid returns true when cookie equals header (constant-time)', () => {
    const t = generateCsrfToken();
    expect(isCsrfValid(t, t)).toBe(true);
  });

  it('isCsrfValid returns false on mismatch', () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(isCsrfValid(a, b)).toBe(false);
  });

  it('isCsrfValid returns false on missing values', () => {
    expect(isCsrfValid(undefined, 'x')).toBe(false);
    expect(isCsrfValid('x', undefined)).toBe(false);
    expect(isCsrfValid('', '')).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/admin exec vitest run tests/unit/csrf.test.ts
```

- [ ] **Step 3: Write `apps/admin/src/lib/csrf.ts`**

```ts
import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_HEADER = 'x-csrf-token';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isCsrfValid(
  cookieValue: string | undefined,
  headerValue: string | undefined,
): boolean {
  if (!cookieValue || !headerValue) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @pantry/admin exec vitest run tests/unit/csrf.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/csrf.ts apps/admin/tests/unit/csrf.test.ts
git commit -m "feat(admin): CSRF double-submit token helpers"
```

---

### Task D7: Server-side API client

**Files:**
- Create: `apps/admin/src/lib/api.ts`

- [ ] **Step 1: Write `apps/admin/src/lib/api.ts`**

```ts
import { cookies } from 'next/headers';
import { COOKIE_NAMES } from './cookies';
import { getAdminEnv } from './env';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string | undefined,
  ) {
    super(`API ${status} ${code}`);
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Override or extend headers; Authorization is set automatically when an access cookie exists. */
  headers?: Record<string, string>;
}

/**
 * Server-side fetch wrapper for the admin app. Reads the access-token cookie
 * and forwards it as a Bearer token to the Fastify API. Throws ApiError on
 * non-2xx responses.
 */
export async function apiServerFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  const access = cookieStore.get(COOKIE_NAMES.access)?.value;

  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
    ...(opts.headers ?? {}),
  };
  if (access && !headers.authorization) headers.authorization = `Bearer ${access}`;

  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
  });

  if (!res.ok) {
    let code = 'unknown_error';
    let detail: string | undefined;
    try {
      const problem = (await res.json()) as { code?: string; detail?: string };
      code = problem.code ?? code;
      detail = problem.detail;
    } catch {
      // body wasn't problem+json
    }
    throw new ApiError(res.status, code, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/api.ts
git commit -m "feat(admin): server-side API fetch wrapper with cookie-derived bearer"
```

---

### Task D8: Browser-side API client (calls Route Handlers with CSRF)

**Files:**
- Create: `apps/admin/src/lib/api-client.ts`

- [ ] **Step 1: Write `apps/admin/src/lib/api-client.ts`**

```ts
import { COOKIE_NAMES } from './cookies';
import { CSRF_HEADER } from './csrf';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

export interface BrowserApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/**
 * Browser fetch wrapper. All requests hit the admin app's own Route Handlers
 * under `/api/...` (same origin); the handlers proxy to the Fastify API and
 * re-issue cookies as needed. Mutating methods carry the CSRF header.
 */
export async function apiBrowserFetch<T>(path: string, opts: BrowserApiOptions = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  if (method !== 'GET') {
    const csrf = readCookie(COOKIE_NAMES.csrf);
    if (csrf) headers[CSRF_HEADER] = csrf;
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  if (!res.ok) {
    let code = 'unknown_error';
    try {
      const problem = (await res.json()) as { code?: string };
      code = problem.code ?? code;
    } catch {
      // ignore
    }
    throw new Error(`API ${res.status} ${code}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/api-client.ts
git commit -m "feat(admin): browser API client with CSRF header forwarding"
```

---

## Phase E — Route Handlers (login, TOTP, refresh, logout, me)

### Task E1: `POST /api/auth/login` Route Handler

**Files:**
- Create: `apps/admin/src/app/api/auth/login/route.ts`

- [ ] **Step 1: Write the Route Handler**

```ts
// apps/admin/src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { adminLoginRequestSchema } from '@pantry/shared';
import { getAdminEnv } from '@/lib/env';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';
import { generateCsrfToken } from '@/lib/csrf';

const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;
const ACCESS_MAX_AGE_SEC = 60 * 15;

export async function POST(req: Request) {
  const env = getAdminEnv();
  let parsed;
  try {
    parsed = adminLoginRequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { code: 'validation_error', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  const body = (await upstream.json()) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  // Case 1: admin needs TOTP — propagate challengeToken to the client (no cookies yet)
  if (body.requiresTotp === true && typeof body.challengeToken === 'string') {
    return NextResponse.json(
      { requiresTotp: true, challengeToken: body.challengeToken },
      { status: 200 },
    );
  }

  // Case 2: full login (shouldn't happen for admin role; defensive)
  return finalizeSession(body, env);
}

interface UpstreamAuth {
  user: { role: 'user' | 'admin' };
  tokens: { accessToken: string; refreshToken: string };
}

export function finalizeSession(
  body: Record<string, unknown>,
  env: ReturnType<typeof getAdminEnv>,
) {
  const auth = body as unknown as UpstreamAuth;

  if (auth.user?.role !== 'admin') {
    return NextResponse.json(
      { code: 'forbidden', detail: 'Admin role required' },
      { status: 403 },
    );
  }

  const csrf = generateCsrfToken();
  const res = NextResponse.json({ user: auth.user }, { status: 200 });
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.access,
      value: auth.tokens.accessToken,
      maxAgeSec: ACCESS_MAX_AGE_SEC,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.refresh,
      value: auth.tokens.refreshToken,
      maxAgeSec: REFRESH_MAX_AGE_SEC,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.csrf,
      value: csrf,
      maxAgeSec: REFRESH_MAX_AGE_SEC,
      httpOnly: false,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  return res;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/api/auth/login/route.ts
git commit -m "feat(admin): POST /api/auth/login proxy that emits cookies on success"
```

---

### Task E2: `POST /api/auth/totp` Route Handler

**Files:**
- Create: `apps/admin/src/app/api/auth/totp/route.ts`

- [ ] **Step 1: Write the Route Handler**

```ts
// apps/admin/src/app/api/auth/totp/route.ts
import { NextResponse } from 'next/server';
import { adminTotpRequestSchema } from '@pantry/shared';
import { getAdminEnv } from '@/lib/env';
import { finalizeSession } from '../login/route';

export async function POST(req: Request) {
  const env = getAdminEnv();
  let parsed;
  try {
    parsed = adminTotpRequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { code: 'validation_error', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/totp/challenge-verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  const body = (await upstream.json()) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  return finalizeSession(body, env);
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/api/auth/totp/route.ts
git commit -m "feat(admin): POST /api/auth/totp exchanges challenge+code for cookies"
```

---

### Task E3: `POST /api/auth/refresh` Route Handler

**Files:**
- Create: `apps/admin/src/app/api/auth/refresh/route.ts`

- [ ] **Step 1: Write the Route Handler**

```ts
// apps/admin/src/app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminEnv } from '@/lib/env';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';
import { CSRF_HEADER, isCsrfValid } from '@/lib/csrf';

const ACCESS_MAX_AGE_SEC = 60 * 15;
const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  const refresh = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  const csrfCookie = cookieStore.get(COOKIE_NAMES.csrf)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER) ?? undefined;

  if (!isCsrfValid(csrfCookie, csrfHeader)) {
    return NextResponse.json({ code: 'forbidden', detail: 'CSRF token mismatch' }, { status: 403 });
  }
  if (!refresh) {
    return NextResponse.json({ code: 'unauthorized' }, { status: 401 });
  }

  const upstream = await fetch(`${env.apiBaseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  const body = (await upstream.json()) as Record<string, unknown>;

  if (!upstream.ok) {
    return NextResponse.json(body, { status: upstream.status });
  }

  const tokens = body.tokens as { accessToken: string; refreshToken: string };
  const res = NextResponse.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.access,
      value: tokens.accessToken,
      maxAgeSec: ACCESS_MAX_AGE_SEC,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  res.headers.append(
    'Set-Cookie',
    buildSetCookie({
      name: COOKIE_NAMES.refresh,
      value: tokens.refreshToken,
      maxAgeSec: REFRESH_MAX_AGE_SEC,
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      domain: env.cookieDomain,
    }),
  );
  return res;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/api/auth/refresh/route.ts
git commit -m "feat(admin): POST /api/auth/refresh rotates tokens via cookies"
```

---

### Task E4: `POST /api/auth/logout` Route Handler

**Files:**
- Create: `apps/admin/src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Write the Route Handler**

```ts
// apps/admin/src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminEnv } from '@/lib/env';
import { buildSetCookie, COOKIE_NAMES } from '@/lib/cookies';
import { CSRF_HEADER, isCsrfValid } from '@/lib/csrf';

export async function POST(req: Request) {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get(COOKIE_NAMES.csrf)?.value;
  const csrfHeader = req.headers.get(CSRF_HEADER) ?? undefined;
  if (!isCsrfValid(csrfCookie, csrfHeader)) {
    return NextResponse.json({ code: 'forbidden' }, { status: 403 });
  }

  const refresh = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  if (refresh) {
    await fetch(`${env.apiBaseUrl}/v1/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ ok: true });
  for (const name of [COOKIE_NAMES.access, COOKIE_NAMES.refresh, COOKIE_NAMES.csrf]) {
    res.headers.append(
      'Set-Cookie',
      buildSetCookie({
        name,
        value: '',
        maxAgeSec: 0,
        httpOnly: name !== COOKIE_NAMES.csrf,
        secure: env.cookieSecure,
        sameSite: 'lax',
        domain: env.cookieDomain,
      }),
    );
  }
  return res;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/api/auth/logout/route.ts
git commit -m "feat(admin): POST /api/auth/logout clears cookies and revokes refresh"
```

---

### Task E5: `GET /api/auth/me` Route Handler

**Files:**
- Create: `apps/admin/src/app/api/auth/me/route.ts`

- [ ] **Step 1: Write the Route Handler**

```ts
// apps/admin/src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { apiServerFetch, ApiError } from '@/lib/api';

export async function GET() {
  try {
    const me = await apiServerFetch<unknown>('/v1/auth/me');
    return NextResponse.json(me);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { code: err.code, detail: err.detail },
        { status: err.status },
      );
    }
    return NextResponse.json({ code: 'internal_error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/api/auth/me/route.ts
git commit -m "feat(admin): GET /api/auth/me proxies to upstream /v1/auth/me"
```

---

## Phase F — Login page (server-rendered shell + client form)

### Task F1: TOTP client form component

**Files:**
- Create: `apps/admin/src/app/login/totp-form.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/admin/src/app/login/totp-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

export function TotpForm({ challengeToken }: { challengeToken: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/totp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeToken, code }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        throw new Error(body.code ?? 'totp_failed');
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Button type="submit" disabled={busy || code.length !== 6} className="w-full">
        {busy ? 'Verifying…' : 'Verify'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/login/totp-form.tsx
git commit -m "feat(admin): TOTP code entry form (client component)"
```

---

### Task F2: Login page (email + password + TOTP step)

**Files:**
- Create: `apps/admin/src/app/login/page.tsx`
- Create: `apps/admin/src/app/login/login-form.tsx`

- [ ] **Step 1: Write `apps/admin/src/app/login/login-form.tsx`**

```tsx
// apps/admin/src/app/login/login-form.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { TotpForm } from './totp-form';

type Step = 'credentials' | 'totp';

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as {
        requiresTotp?: boolean;
        challengeToken?: string;
        code?: string;
      };
      if (!res.ok) {
        throw new Error(body.code ?? 'login_failed');
      }
      if (body.requiresTotp && body.challengeToken) {
        setChallengeToken(body.challengeToken);
        setStep('totp');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'totp' && challengeToken) {
    return <TotpForm challengeToken={challengeToken} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Write `apps/admin/src/app/login/page.tsx`**

```tsx
// apps/admin/src/app/login/page.tsx
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Pantry Admin</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build the app to confirm both files compile**

```bash
pnpm --filter @pantry/admin build
```
Expected: exit 0, no warnings, includes the `/login` route in the build summary.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/login
git commit -m "feat(admin): login page with email/password and TOTP step"
```

---

## Phase G — Session middleware

### Task G1: `middleware.ts` enforcing access cookie + admin role

**Files:**
- Create: `apps/admin/src/middleware.ts`

The middleware does the lightest possible check it can: it requires the presence of the access cookie. Page-level Server Components call `GET /v1/auth/me` via `apiServerFetch` (Task D7) and redirect to `/login` if the call returns 401, after attempting one refresh via the Route Handler.

We do NOT verify the JWT inside middleware (no secret on the edge runtime); we trust nginx + the upstream API to reject forged or expired tokens. The middleware's job is purely to bounce unauthenticated requests away from protected paths and to bounce authenticated requests away from `/login`.

- [ ] **Step 1: Write `apps/admin/src/middleware.ts`**

```ts
// apps/admin/src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAMES } from './lib/cookies';

const PUBLIC_PATHS = ['/login'];
const PUBLIC_PREFIXES = ['/_next', '/api/auth', '/favicon'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasAccess = req.cookies.has(COOKIE_NAMES.access);
  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  if (!hasAccess && !isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (hasAccess && isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/admin typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/middleware.ts
git commit -m "feat(admin): middleware redirects unauthenticated requests to /login"
```

---

### Task G2: Server-side session enforcement + refresh-on-401 in the admin layout

**Files:**
- Create: `apps/admin/src/app/(admin)/layout.tsx`
- Create: `apps/admin/src/lib/session.ts`

The layout calls `/v1/auth/me`. On 401, it attempts a single refresh via the API, and if that also fails it redirects to `/login`. It also enforces `role === 'admin'`.

- [ ] **Step 1: Write `apps/admin/src/lib/session.ts`**

```ts
// apps/admin/src/lib/session.ts
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, apiServerFetch } from './api';
import { buildSetCookie, COOKIE_NAMES } from './cookies';
import { getAdminEnv } from './env';

export interface AdminMe {
  id: string;
  email: string;
  role: 'user' | 'admin';
  firstName: string;
  lastName: string;
}

/**
 * Server-side helper used by admin pages. Fetches /v1/auth/me; on 401 it
 * attempts one refresh and retries; on second failure it redirects to /login.
 * It also enforces role === 'admin'.
 */
export async function requireAdminSession(): Promise<AdminMe> {
  try {
    const me = await apiServerFetch<AdminMe>('/v1/auth/me');
    if (me.role !== 'admin') redirect('/login');
    return me;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        const me = await apiServerFetch<AdminMe>('/v1/auth/me');
        if (me.role !== 'admin') redirect('/login');
        return me;
      }
    }
    redirect('/login');
  }
}

async function tryRefresh(): Promise<boolean> {
  const env = getAdminEnv();
  const cookieStore = await cookies();
  const refresh = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  if (!refresh) return false;

  const res = await fetch(`${env.apiBaseUrl}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return false;

  const body = (await res.json()) as { tokens?: { accessToken: string; refreshToken: string } };
  const tokens = body.tokens;
  if (!tokens) return false;

  // Next.js Server Components cannot set cookies outside Route Handlers/Server Actions.
  // We mutate the request's own cookie store so the subsequent /v1/auth/me call in
  // the same render uses the new access token, and we set the persistent cookies
  // via a header on the eventual response by stashing them on `headers()` won't work
  // here either — so we rely on the next user-triggered Route Handler call to persist
  // them. For the immediate retry within this render we update the in-memory store.
  cookieStore.set(COOKIE_NAMES.access, tokens.accessToken, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
    domain: env.cookieDomain,
  });
  cookieStore.set(COOKIE_NAMES.refresh, tokens.refreshToken, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    domain: env.cookieDomain,
  });
  return true;
}

// Re-export buildSetCookie for callers that need the raw header form.
export { buildSetCookie };
```

- [ ] **Step 2: Write a temporary header/sidebar skeleton (replaced richer in Task H1)**

Create `apps/admin/src/components/header.tsx`:

```tsx
// apps/admin/src/components/header.tsx
export function Header({ email }: { email: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="text-sm font-semibold">Pantry Admin</div>
      <div className="text-sm text-muted-foreground">{email}</div>
    </header>
  );
}
```

Create `apps/admin/src/components/sidebar.tsx`:

```tsx
// apps/admin/src/components/sidebar.tsx
import Link from 'next/link';
import { NAV } from '@/lib/nav';

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r bg-card">
      <nav className="flex flex-col gap-1 p-3 text-sm">
        {NAV.map((section) => (
          <div key={section.title} className="mb-3">
            <div className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">
              {section.title}
            </div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded px-2 py-1.5 hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Write `apps/admin/src/lib/nav.ts`**

```ts
// apps/admin/src/lib/nav.ts
export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/' }],
  },
  {
    title: 'Moderation',
    items: [
      { label: 'Reports', href: '/reports' },
      { label: 'Reviews', href: '/reviews' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Products', href: '/products' },
      { label: 'Pending edits', href: '/products/pending' },
    ],
  },
  {
    title: 'People',
    items: [{ label: 'Users', href: '/users' }],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Overview', href: '/analytics/overview' },
      { label: 'Scans', href: '/analytics/scans' },
      { label: 'Reviews', href: '/analytics/reviews' },
      { label: 'Geography', href: '/analytics/geography' },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Queue', href: '/system/queue' },
      { label: 'Push logs', href: '/system/push' },
      { label: 'API errors', href: '/system/api-errors' },
      { label: 'External APIs', href: '/system/external-apis' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Feature flags', href: '/settings/feature-flags' },
      { label: 'Notification templates', href: '/settings/notification-templates' },
      { label: 'Moderation', href: '/settings/moderation' },
      { label: 'Admins', href: '/settings/admins' },
    ],
  },
];
```

- [ ] **Step 4: Write the `(admin)` group layout**

```tsx
// apps/admin/src/app/(admin)/layout.tsx
import type { ReactNode } from 'react';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { requireAdminSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireAdminSession();
  return (
    <div className="flex min-h-screen flex-col">
      <Header email={me.email} />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + build**

```bash
pnpm --filter @pantry/admin typecheck
pnpm --filter @pantry/admin build
```
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/lib/session.ts apps/admin/src/lib/nav.ts apps/admin/src/components/header.tsx apps/admin/src/components/sidebar.tsx apps/admin/src/app/\(admin\)/layout.tsx
git commit -m "feat(admin): admin layout with header/sidebar and session enforcement"
```

---

## Phase H — Stub pages for every M3 route

### Task H1: Replace the temporary `/` with an (admin)-grouped overview stub

**Files:**
- Modify: `apps/admin/src/app/page.tsx`  (delete)
- Create: `apps/admin/src/app/(admin)/page.tsx`

- [ ] **Step 1: Delete the temporary root page**

```bash
rm apps/admin/src/app/page.tsx
```

- [ ] **Step 2: Create the overview stub at `apps/admin/src/app/(admin)/page.tsx`**

```tsx
export default function OverviewPage() {
  return <p className="text-sm text-muted-foreground">Overview — implemented in M3.</p>;
}
```

- [ ] **Step 3: Build to confirm route map is correct**

```bash
pnpm --filter @pantry/admin build
```
Expected: build summary shows `/` and no longer warns about duplicate roots.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app
git commit -m "feat(admin): move overview into (admin) route group"
```

---

### Task H2: Stub `/users` and `/users/[id]`

**Files:**
- Create: `apps/admin/src/app/(admin)/users/page.tsx`
- Create: `apps/admin/src/app/(admin)/users/[id]/page.tsx`

- [ ] **Step 1: Write `apps/admin/src/app/(admin)/users/page.tsx`**

```tsx
export default function UsersPage() {
  return <p className="text-sm text-muted-foreground">Users list — implemented in M3.</p>;
}
```

- [ ] **Step 2: Write `apps/admin/src/app/(admin)/users/[id]/page.tsx`**

```tsx
export default function UserDetailPage() {
  return <p className="text-sm text-muted-foreground">User detail — implemented in M3.</p>;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(admin\)/users
git commit -m "feat(admin): stub /users and /users/[id]"
```

---

### Task H3: Stub `/products`, `/products/[id]`, `/products/pending`

**Files:**
- Create: `apps/admin/src/app/(admin)/products/page.tsx`
- Create: `apps/admin/src/app/(admin)/products/[id]/page.tsx`
- Create: `apps/admin/src/app/(admin)/products/pending/page.tsx`

- [ ] **Step 1: Write all three files**

`apps/admin/src/app/(admin)/products/page.tsx`:
```tsx
export default function ProductsPage() {
  return <p className="text-sm text-muted-foreground">Products list — implemented in M3.</p>;
}
```

`apps/admin/src/app/(admin)/products/[id]/page.tsx`:
```tsx
export default function ProductDetailPage() {
  return <p className="text-sm text-muted-foreground">Product detail — implemented in M3.</p>;
}
```

`apps/admin/src/app/(admin)/products/pending/page.tsx`:
```tsx
export default function ProductsPendingPage() {
  return (
    <p className="text-sm text-muted-foreground">Pending product edits — implemented in M3.</p>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/products
git commit -m "feat(admin): stub /products, /products/[id], /products/pending"
```

---

### Task H4: Stub `/reviews` and `/reviews/[id]`

**Files:**
- Create: `apps/admin/src/app/(admin)/reviews/page.tsx`
- Create: `apps/admin/src/app/(admin)/reviews/[id]/page.tsx`

- [ ] **Step 1: Write both files**

`apps/admin/src/app/(admin)/reviews/page.tsx`:
```tsx
export default function ReviewsPage() {
  return <p className="text-sm text-muted-foreground">Reviews list — implemented in M3.</p>;
}
```

`apps/admin/src/app/(admin)/reviews/[id]/page.tsx`:
```tsx
export default function ReviewDetailPage() {
  return <p className="text-sm text-muted-foreground">Review detail — implemented in M3.</p>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/reviews
git commit -m "feat(admin): stub /reviews and /reviews/[id]"
```

---

### Task H5: Stub `/reports` and `/reports/[id]`

**Files:**
- Create: `apps/admin/src/app/(admin)/reports/page.tsx`
- Create: `apps/admin/src/app/(admin)/reports/[id]/page.tsx`

- [ ] **Step 1: Write both files**

`apps/admin/src/app/(admin)/reports/page.tsx`:
```tsx
export default function ReportsPage() {
  return <p className="text-sm text-muted-foreground">Open reports queue — implemented in M3.</p>;
}
```

`apps/admin/src/app/(admin)/reports/[id]/page.tsx`:
```tsx
export default function ReportDetailPage() {
  return <p className="text-sm text-muted-foreground">Report detail — implemented in M3.</p>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/reports
git commit -m "feat(admin): stub /reports and /reports/[id]"
```

---

### Task H6: Stub `/analytics/*`

**Files:**
- Create: `apps/admin/src/app/(admin)/analytics/overview/page.tsx`
- Create: `apps/admin/src/app/(admin)/analytics/scans/page.tsx`
- Create: `apps/admin/src/app/(admin)/analytics/reviews/page.tsx`
- Create: `apps/admin/src/app/(admin)/analytics/geography/page.tsx`

- [ ] **Step 1: Write all four files**

`overview/page.tsx`:
```tsx
export default function AnalyticsOverviewPage() {
  return <p className="text-sm text-muted-foreground">Analytics overview — implemented in M3.</p>;
}
```

`scans/page.tsx`:
```tsx
export default function AnalyticsScansPage() {
  return <p className="text-sm text-muted-foreground">Scans analytics — implemented in M3.</p>;
}
```

`reviews/page.tsx`:
```tsx
export default function AnalyticsReviewsPage() {
  return <p className="text-sm text-muted-foreground">Reviews analytics — implemented in M3.</p>;
}
```

`geography/page.tsx`:
```tsx
export default function AnalyticsGeographyPage() {
  return <p className="text-sm text-muted-foreground">Geography analytics — implemented in M3.</p>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/analytics
git commit -m "feat(admin): stub /analytics/{overview,scans,reviews,geography}"
```

---

### Task H7: Stub `/system/*`

**Files:**
- Create: `apps/admin/src/app/(admin)/system/queue/page.tsx`
- Create: `apps/admin/src/app/(admin)/system/push/page.tsx`
- Create: `apps/admin/src/app/(admin)/system/api-errors/page.tsx`
- Create: `apps/admin/src/app/(admin)/system/external-apis/page.tsx`

- [ ] **Step 1: Write all four files**

`queue/page.tsx`:
```tsx
export default function SystemQueuePage() {
  return <p className="text-sm text-muted-foreground">Queue health — implemented in M3.</p>;
}
```

`push/page.tsx`:
```tsx
export default function SystemPushPage() {
  return <p className="text-sm text-muted-foreground">Push logs — implemented in M3.</p>;
}
```

`api-errors/page.tsx`:
```tsx
export default function SystemApiErrorsPage() {
  return <p className="text-sm text-muted-foreground">API errors — implemented in M3.</p>;
}
```

`external-apis/page.tsx`:
```tsx
export default function SystemExternalApisPage() {
  return <p className="text-sm text-muted-foreground">External APIs — implemented in M3.</p>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/\(admin\)/system
git commit -m "feat(admin): stub /system/{queue,push,api-errors,external-apis}"
```

---

### Task H8: Stub `/settings/*`

**Files:**
- Create: `apps/admin/src/app/(admin)/settings/feature-flags/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/notification-templates/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/moderation/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/admins/page.tsx`

- [ ] **Step 1: Write all four files**

`feature-flags/page.tsx`:
```tsx
export default function SettingsFeatureFlagsPage() {
  return <p className="text-sm text-muted-foreground">Feature flags — implemented in M3.</p>;
}
```

`notification-templates/page.tsx`:
```tsx
export default function SettingsNotificationTemplatesPage() {
  return (
    <p className="text-sm text-muted-foreground">Notification templates — implemented in M3.</p>
  );
}
```

`moderation/page.tsx`:
```tsx
export default function SettingsModerationPage() {
  return <p className="text-sm text-muted-foreground">Moderation settings — implemented in M3.</p>;
}
```

`admins/page.tsx`:
```tsx
export default function SettingsAdminsPage() {
  return <p className="text-sm text-muted-foreground">Admins — implemented in M3.</p>;
}
```

- [ ] **Step 2: Build to confirm every route is wired**

```bash
pnpm --filter @pantry/admin build
```
Expected: build summary lists all of: `/`, `/login`, `/users`, `/users/[id]`, `/products`, `/products/[id]`, `/products/pending`, `/reviews`, `/reviews/[id]`, `/reports`, `/reports/[id]`, `/analytics/overview`, `/analytics/scans`, `/analytics/reviews`, `/analytics/geography`, `/system/queue`, `/system/push`, `/system/api-errors`, `/system/external-apis`, `/settings/feature-flags`, `/settings/notification-templates`, `/settings/moderation`, `/settings/admins`, and the API routes under `/api/auth/*`.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(admin\)/settings
git commit -m "feat(admin): stub /settings/{feature-flags,notification-templates,moderation,admins}"
```

---

## Phase I — Playwright E2E for login

### Task I1: Playwright config and seeded-admin fixture

**Files:**
- Create: `apps/admin/playwright.config.ts`
- Create: `apps/admin/tests/e2e/fixtures/seed-admin.ts`

- [ ] **Step 1: Write `apps/admin/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4001',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @pantry/api dev',
      port: 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @pantry/admin dev',
      port: 4001,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
```

- [ ] **Step 2: Write `apps/admin/tests/e2e/fixtures/seed-admin.ts`**

This script connects directly to the `pantry` database via `psql` to seed a fully-enrolled admin (password + TOTP secret). It is intentionally idempotent.

```ts
// apps/admin/tests/e2e/fixtures/seed-admin.ts
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import argon2 from 'argon2';

export const SEEDED_ADMIN_EMAIL = 'e2e-admin@pantry.local';
export const SEEDED_ADMIN_PASSWORD = 'e2e-admin-pw-1234';
export const SEEDED_TOTP_SECRET = 'JBSWY3DPEHPK3PXP'; // RFC 4226 test vector

export async function seedAdmin(): Promise<void> {
  const id = randomUUID();
  const credId = randomUUID();
  const hash = await argon2.hash(SEEDED_ADMIN_PASSWORD, { type: argon2.argon2id });
  const escaped = hash.replace(/'/g, "''");

  const sql = `
    DELETE FROM auth_credentials WHERE user_id IN (SELECT id FROM users WHERE email = '${SEEDED_ADMIN_EMAIL}');
    DELETE FROM users WHERE email = '${SEEDED_ADMIN_EMAIL}';
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, theme_preference,
                       totp_secret, totp_enabled_at, email_verified_at, created_at, updated_at)
    VALUES ('${id}', '${SEEDED_ADMIN_EMAIL}', '${escaped}', 'E2E', 'Admin', 'admin', 'active', 'aurora',
            '${SEEDED_TOTP_SECRET}', NOW(), NOW(), NOW(), NOW());
    INSERT INTO auth_credentials (id, user_id, type, created_at)
    VALUES ('${credId}', '${id}', 'password', NOW());
  `;

  execSync(`psql "${process.env.DATABASE_URL ?? 'postgresql://pantry:pantry@localhost:5432/pantry'}" -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
    stdio: 'pipe',
  });
}

export function currentTotpCode(): string {
  return authenticator.generate(SEEDED_TOTP_SECRET);
}
```

- [ ] **Step 3: Add `otplib` and `argon2` to admin devDependencies**

Modify `apps/admin/package.json`'s `devDependencies` to add:

```json
    "argon2": "^0.40.0",
    "otplib": "^12.0.1",
```

Then:

```bash
pnpm install
```

- [ ] **Step 4: Install Playwright browsers (one-time per machine)**

```bash
pnpm --filter @pantry/admin exec playwright install --with-deps chromium
```
Expected: prints `chromium 1.xxx is already installed.` or a download summary.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/playwright.config.ts apps/admin/tests/e2e/fixtures pnpm-lock.yaml apps/admin/package.json
git commit -m "test(admin): playwright config and seeded-admin fixture"
```

---

### Task I2: Login E2E spec

**Files:**
- Create: `apps/admin/tests/e2e/login.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/admin/tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';
import {
  seedAdmin,
  SEEDED_ADMIN_EMAIL,
  SEEDED_ADMIN_PASSWORD,
  currentTotpCode,
} from './fixtures/seed-admin';

test.beforeAll(async () => {
  await seedAdmin();
});

test('admin can sign in with password + TOTP and lands on /', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(SEEDED_ADMIN_EMAIL);
  await page.getByLabel('Password').fill(SEEDED_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByLabel('Authenticator code')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Authenticator code').fill(currentTotpCode());
  await page.getByRole('button', { name: 'Verify' }).click();

  await page.waitForURL('**/', { timeout: 10_000 });
  await expect(page.getByText(/Overview/i)).toBeVisible();
});

test('unauthenticated visit to / is redirected to /login', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/');
  await page.waitForURL('**/login?next=%2F', { timeout: 10_000 });
});
```

- [ ] **Step 2: Run the E2E suite**

```bash
pnpm --filter @pantry/admin test:e2e
```
Expected: 2 tests passed. (Playwright will boot both `api` and `admin` automatically via the webServer block.)

- [ ] **Step 3: Commit**

```bash
git add apps/admin/tests/e2e/login.spec.ts
git commit -m "test(admin): e2e login flow with TOTP"
```

---

### Task I3: Run the full admin unit + E2E suite end-to-end

- [ ] **Step 1: Unit tests**

```bash
pnpm --filter @pantry/admin test
```
Expected: 3 files (`env.test.ts`, `cookies.test.ts`, `csrf.test.ts`) pass.

- [ ] **Step 2: E2E tests**

```bash
pnpm --filter @pantry/admin test:e2e
```
Expected: 2 tests pass.

- [ ] **Step 3: Typecheck the whole repo**

```bash
pnpm typecheck
```
Expected: every workspace package exits 0.

- [ ] **Step 4: No commit (verification gate)**

---

## Phase J — Ansible foundation

### Task J1: Ansible scaffolding

**Files:**
- Create: `infra/README.md`
- Create: `infra/ansible.cfg`
- Create: `infra/inventory.example.ini`
- Create: `infra/group_vars/all.example.yml`
- Create: `infra/site.yml`

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/group_vars infra/roles infra/scripts
```

- [ ] **Step 2: Write `infra/ansible.cfg`**

```ini
[defaults]
inventory = inventory.ini
host_key_checking = False
retry_files_enabled = False
stdout_callback = yaml
gathering = smart
forks = 5
roles_path = roles

[ssh_connection]
pipelining = True
```

- [ ] **Step 3: Write `infra/inventory.example.ini`**

```ini
[pantry]
pantry-prod ansible_host=203.0.113.10 ansible_user=root ansible_port=22

[pantry:vars]
ansible_python_interpreter=/usr/bin/python3
```

- [ ] **Step 4: Write `infra/group_vars/all.example.yml`**

```yaml
---
# Customize and rename to all.yml before running the playbook.
domain_root: example.com
api_domain: "api.{{ domain_root }}"
admin_domain: "admin.{{ domain_root }}"

# Email used for Let's Encrypt registration
letsencrypt_email: ops@example.com

# nginx admin IP allowlist (CIDR list). Empty list means deny everyone.
admin_allowlist:
  - 198.51.100.0/24
  - 203.0.113.42/32

# Backup destination
backup_bucket: pantry-backups
backup_age_recipient: "age1exampleexampleexampleexampleexampleexampleexampleexampleexampleex"

# Postgres tuning targets for an 8 GB box
postgres_shared_buffers: 2GB
postgres_effective_cache_size: 6GB

# Application paths
app_root: /opt/pantry
app_user: pantryapp
app_group: pantryapp
config_dir: /etc/pantry

# rclone remote name (configured manually with `rclone config` on the box)
rclone_remote: b2:pantry-backups
```

- [ ] **Step 5: Write `infra/site.yml`** (composed; the roles themselves are added in later tasks)

```yaml
---
- name: Provision Pantry VPS
  hosts: pantry
  become: true
  pre_tasks:
    - name: Assert supported Ubuntu version
      ansible.builtin.assert:
        that:
          - ansible_distribution == 'Ubuntu'
          - ansible_distribution_version in ['22.04', '24.04']
        fail_msg: "Only Ubuntu 22.04 and 24.04 LTS are supported."
  roles:
    - common
    - postgres
    - redis
    - nodejs
    - nginx
    - certbot
    - app
    - secrets
```

- [ ] **Step 6: Write `infra/README.md`**

```markdown
# Pantry infra

Ansible playbook that takes a fresh Ubuntu 22.04 or 24.04 LTS VPS and produces a
running Pantry stack: Postgres 16, Redis 7, Node 20 LTS, nginx, certbot,
systemd-managed `pantry-api` and `pantry-admin` services, ufw, fail2ban,
encrypted nightly backups.

## One-shot provision

```bash
cp inventory.example.ini inventory.ini
cp group_vars/all.example.yml group_vars/all.yml
# Edit both files: set the host IP, domain, allowlist, age recipient, backup remote.
ansible-playbook -i inventory.ini site.yml
```

The play is idempotent; re-running on a healthy host should report `changed=0`.

## Secrets

Before first deploy, place `/etc/pantry/.env.production` on the host (mode 600,
owned by `pantryapp:pantryapp`). Use the same env vars as `api/.env.example` and
`apps/admin/.env.example`. The `secrets` role asserts the file exists; it does
not generate secrets for you.

## Deploy pipeline

GitHub Actions runs on every push to `main` (see `.github/workflows/deploy.yml`).
It:

1. Runs all unit + integration tests in CI (Postgres + Redis service containers).
2. Builds api and admin, prunes dev deps, packages a tarball.
3. SSHes to the host as the `deploy` user.
4. Extracts to `/opt/pantry/releases/<sha>/`.
5. Runs `prisma migrate deploy`.
6. Flips `/opt/pantry/current` atomically (`ln -sfn`).
7. `sudo systemctl reload pantry-api pantry-admin`.
8. Smokes `https://api.<domain>/health/ready` 5× with exponential backoff.
9. On failure: re-flips the symlink to the previous release and reloads.

### SSH setup

Create a dedicated `deploy` SSH key pair locally. Add the public key to
`/home/pantryapp/.ssh/authorized_keys` on the host with a `from=` restriction:

```
from="<github-actions-egress-cidr>",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA... deploy@github
```

Store the private key in the repo's GitHub Actions secret `DEPLOY_SSH_KEY`.

### sudoers

The `app` role installs `/etc/sudoers.d/pantry` allowing `pantryapp` to reload
exactly two units and nothing else:

```
pantryapp ALL=(root) NOPASSWD: /bin/systemctl reload pantry-api, /bin/systemctl reload pantry-admin
```

## Backups

`infra/scripts/backup.sh` runs nightly via cron (installed by the `app` role).
Restore with `infra/scripts/restore.sh <YYYY-MM-DD>`.
```

- [ ] **Step 7: Verify YAML parses**

```bash
test -x "$(command -v ansible-playbook)" && ansible-playbook --syntax-check infra/site.yml -i infra/inventory.example.ini || echo "ansible-playbook not installed locally; skip"
```
Expected: prints `playbook: infra/site.yml` if Ansible is installed, else the skip message. (CI does not need Ansible — the syntax check runs locally before commits.)

- [ ] **Step 8: Commit**

```bash
git add infra/README.md infra/ansible.cfg infra/inventory.example.ini infra/group_vars infra/site.yml
git commit -m "feat(infra): ansible scaffolding (inventory, group_vars, site.yml)"
```

---

### Task J2: `common` role (user, dirs, ufw, fail2ban, logrotate)

**Files:**
- Create: `infra/roles/common/tasks/main.yml`
- Create: `infra/roles/common/handlers/main.yml`
- Create: `infra/roles/common/files/logrotate-pantry`

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/roles/common/{tasks,handlers,files}
```

- [ ] **Step 2: Write `infra/roles/common/tasks/main.yml`**

```yaml
---
- name: Set timezone to UTC
  community.general.timezone:
    name: UTC

- name: Update apt cache (daily)
  ansible.builtin.apt:
    update_cache: true
    cache_valid_time: 86400

- name: Install baseline packages
  ansible.builtin.apt:
    name:
      - ca-certificates
      - curl
      - gnupg
      - lsb-release
      - ufw
      - fail2ban
      - logrotate
      - rsync
      - unattended-upgrades
      - age
      - rclone
      - python3-psycopg2
    state: present

- name: Create app group
  ansible.builtin.group:
    name: "{{ app_group }}"
    system: true
    state: present

- name: Create app user
  ansible.builtin.user:
    name: "{{ app_user }}"
    group: "{{ app_group }}"
    system: true
    shell: /bin/bash
    home: "/home/{{ app_user }}"
    create_home: true
    state: present

- name: Ensure app directory tree exists
  ansible.builtin.file:
    path: "{{ item }}"
    state: directory
    owner: "{{ app_user }}"
    group: "{{ app_group }}"
    mode: "0755"
  loop:
    - "{{ app_root }}"
    - "{{ app_root }}/releases"
    - "{{ app_root }}/shared"
    - "/var/log/pantry"
    - "/var/backups/pantry"

- name: Ensure /etc/pantry exists with strict perms
  ansible.builtin.file:
    path: "{{ config_dir }}"
    state: directory
    owner: "{{ app_user }}"
    group: "{{ app_group }}"
    mode: "0700"

- name: Configure ufw default policies
  community.general.ufw:
    direction: "{{ item.direction }}"
    policy: "{{ item.policy }}"
  loop:
    - { direction: incoming, policy: deny }
    - { direction: outgoing, policy: allow }

- name: Allow required incoming ports
  community.general.ufw:
    rule: allow
    port: "{{ item }}"
    proto: tcp
  loop: [22, 80, 443]

- name: Enable ufw
  community.general.ufw:
    state: enabled
    logging: low

- name: Configure fail2ban ssh jail
  ansible.builtin.copy:
    dest: /etc/fail2ban/jail.d/sshd.local
    mode: "0644"
    content: |
      [sshd]
      enabled = true
      port = ssh
      filter = sshd
      logpath = %(sshd_log)s
      maxretry = 5
      findtime = 600
      bantime = 3600
  notify: restart fail2ban

- name: Install logrotate config for pantry
  ansible.builtin.copy:
    src: logrotate-pantry
    dest: /etc/logrotate.d/pantry
    mode: "0644"
```

- [ ] **Step 3: Write `infra/roles/common/handlers/main.yml`**

```yaml
---
- name: restart fail2ban
  ansible.builtin.service:
    name: fail2ban
    state: restarted
```

- [ ] **Step 4: Write `infra/roles/common/files/logrotate-pantry`**

```
/var/log/pantry/*.log {
    daily
    rotate 7
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
    su pantryapp pantryapp
}
```

- [ ] **Step 5: Commit**

```bash
git add infra/roles/common
git commit -m "feat(infra): common role (user, dirs, ufw, fail2ban, logrotate)"
```

---

### Task J3: `postgres` role (PGDG repo, db, roles, extensions, tuning)

**Files:**
- Create: `infra/roles/postgres/tasks/main.yml`
- Create: `infra/roles/postgres/handlers/main.yml`
- Create: `infra/roles/postgres/templates/pg_hba.conf.j2`

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/roles/postgres/{tasks,handlers,templates}
```

- [ ] **Step 2: Write `infra/roles/postgres/tasks/main.yml`**

```yaml
---
- name: Add PGDG apt key
  ansible.builtin.get_url:
    url: https://www.postgresql.org/media/keys/ACCC4CF8.asc
    dest: /etc/apt/trusted.gpg.d/postgresql.asc
    mode: "0644"

- name: Add PGDG apt repo
  ansible.builtin.apt_repository:
    repo: "deb http://apt.postgresql.org/pub/repos/apt {{ ansible_distribution_release }}-pgdg main"
    state: present
    filename: pgdg

- name: Install Postgres 16
  ansible.builtin.apt:
    name:
      - postgresql-16
      - postgresql-client-16
    state: present
    update_cache: true

- name: Ensure postgres service running and enabled
  ansible.builtin.service:
    name: postgresql
    state: started
    enabled: true

- name: Listen on localhost only
  ansible.builtin.lineinfile:
    path: /etc/postgresql/16/main/postgresql.conf
    regexp: "^#?listen_addresses"
    line: "listen_addresses = 'localhost'"
  notify: restart postgresql

- name: Tune shared_buffers
  ansible.builtin.lineinfile:
    path: /etc/postgresql/16/main/postgresql.conf
    regexp: "^#?shared_buffers"
    line: "shared_buffers = {{ postgres_shared_buffers }}"
  notify: restart postgresql

- name: Tune effective_cache_size
  ansible.builtin.lineinfile:
    path: /etc/postgresql/16/main/postgresql.conf
    regexp: "^#?effective_cache_size"
    line: "effective_cache_size = {{ postgres_effective_cache_size }}"
  notify: restart postgresql

- name: Install pg_hba.conf (scram, local only)
  ansible.builtin.template:
    src: pg_hba.conf.j2
    dest: /etc/postgresql/16/main/pg_hba.conf
    owner: postgres
    group: postgres
    mode: "0640"
  notify: restart postgresql

- name: Generate pantry_app DB password if not present
  ansible.builtin.set_fact:
    pantry_app_password: "{{ lookup('password', '/dev/null length=32 chars=ascii_letters,digits') }}"
  when: pantry_app_password is not defined

- name: Create pantry database
  community.postgresql.postgresql_db:
    name: pantry
    encoding: UTF8
    lc_collate: en_US.UTF-8
    lc_ctype: en_US.UTF-8
    template: template0
    state: present
  become_user: postgres

- name: Create pantry_app role (no superuser)
  community.postgresql.postgresql_user:
    db: pantry
    name: pantry_app
    password: "{{ pantry_app_password }}"
    role_attr_flags: NOSUPERUSER,NOCREATEDB,NOCREATEROLE
    state: present
  become_user: postgres

- name: Grant all on pantry to pantry_app
  community.postgresql.postgresql_privs:
    db: pantry
    role: pantry_app
    type: database
    privs: ALL
  become_user: postgres

- name: Create pantry_readonly role
  community.postgresql.postgresql_user:
    db: pantry
    name: pantry_readonly
    password: "{{ pantry_app_password }}_ro"
    role_attr_flags: NOSUPERUSER,NOCREATEDB,NOCREATEROLE
    state: present
  become_user: postgres

- name: Grant connect + select on pantry to pantry_readonly
  community.postgresql.postgresql_privs:
    db: pantry
    role: pantry_readonly
    type: database
    privs: CONNECT
  become_user: postgres

- name: Enable pg_trgm extension
  community.postgresql.postgresql_ext:
    db: pantry
    name: pg_trgm
    state: present
  become_user: postgres

- name: Enable pgcrypto extension
  community.postgresql.postgresql_ext:
    db: pantry
    name: pgcrypto
    state: present
  become_user: postgres
```

- [ ] **Step 3: Write `infra/roles/postgres/handlers/main.yml`**

```yaml
---
- name: restart postgresql
  ansible.builtin.service:
    name: postgresql
    state: restarted
```

- [ ] **Step 4: Write `infra/roles/postgres/templates/pg_hba.conf.j2`**

```
# Generated by Ansible. Do not edit by hand.
local   all             postgres                                peer
local   all             all                                     scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

- [ ] **Step 5: Commit**

```bash
git add infra/roles/postgres
git commit -m "feat(infra): postgres 16 role (PGDG, scram, pg_trgm, pgcrypto, tuned)"
```

---

### Task J4: `redis` role (apt repo, rdb-only, localhost)

**Files:**
- Create: `infra/roles/redis/tasks/main.yml`
- Create: `infra/roles/redis/handlers/main.yml`
- Create: `infra/roles/redis/templates/redis.conf.j2`

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/roles/redis/{tasks,handlers,templates}
```

- [ ] **Step 2: Write `infra/roles/redis/tasks/main.yml`**

```yaml
---
- name: Add redis.io apt key
  ansible.builtin.get_url:
    url: https://packages.redis.io/gpg
    dest: /etc/apt/trusted.gpg.d/redis.asc
    mode: "0644"

- name: Add redis.io apt repo
  ansible.builtin.apt_repository:
    repo: "deb https://packages.redis.io/deb {{ ansible_distribution_release }} main"
    state: present
    filename: redis

- name: Install Redis 7
  ansible.builtin.apt:
    name: redis
    state: present
    update_cache: true

- name: Install redis.conf
  ansible.builtin.template:
    src: redis.conf.j2
    dest: /etc/redis/redis.conf
    owner: redis
    group: redis
    mode: "0640"
  notify: restart redis

- name: Ensure redis enabled and running
  ansible.builtin.service:
    name: redis-server
    state: started
    enabled: true
```

- [ ] **Step 3: Write `infra/roles/redis/handlers/main.yml`**

```yaml
---
- name: restart redis
  ansible.builtin.service:
    name: redis-server
    state: restarted
```

- [ ] **Step 4: Write `infra/roles/redis/templates/redis.conf.j2`**

```
# Managed by Ansible. Do not edit.
bind 127.0.0.1 -::1
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Persistence: RDB only, no AOF
save 900 1
save 300 10
save 60 10000
appendonly no
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Memory
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log
```

- [ ] **Step 5: Commit**

```bash
git add infra/roles/redis
git commit -m "feat(infra): redis 7 role (localhost, rdb-only, allkeys-lru)"
```

---

### Task J5: `nodejs` role (Node 20 LTS via NodeSource + corepack)

**Files:**
- Create: `infra/roles/nodejs/tasks/main.yml`

- [ ] **Step 1: Create directory**

```bash
mkdir -p infra/roles/nodejs/tasks
```

- [ ] **Step 2: Write `infra/roles/nodejs/tasks/main.yml`**

```yaml
---
- name: Add NodeSource apt key
  ansible.builtin.get_url:
    url: https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key
    dest: /etc/apt/trusted.gpg.d/nodesource.asc
    mode: "0644"

- name: Add NodeSource 20.x apt repo
  ansible.builtin.apt_repository:
    repo: "deb https://deb.nodesource.com/node_20.x nodistro main"
    state: present
    filename: nodesource

- name: Install Node.js 20
  ansible.builtin.apt:
    name: nodejs
    state: present
    update_cache: true

- name: Enable corepack
  ansible.builtin.command: corepack enable
  changed_when: false

- name: Activate pnpm 9 via corepack
  ansible.builtin.command: corepack prepare pnpm@9 --activate
  changed_when: false
```

- [ ] **Step 3: Commit**

```bash
git add infra/roles/nodejs
git commit -m "feat(infra): nodejs role (Node 20 LTS + corepack pnpm 9)"
```

---

## Phase K — nginx + TLS

### Task K1: `nginx` role with API and admin vhosts + IP allowlist

**Files:**
- Create: `infra/roles/nginx/tasks/main.yml`
- Create: `infra/roles/nginx/handlers/main.yml`
- Create: `infra/roles/nginx/templates/api.vhost.j2`
- Create: `infra/roles/nginx/templates/admin.vhost.j2`

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/roles/nginx/{tasks,handlers,templates,files}
```

- [ ] **Step 2: Write `infra/roles/nginx/tasks/main.yml`**

```yaml
---
- name: Install nginx
  ansible.builtin.apt:
    name: nginx
    state: present

- name: Remove default vhost
  ansible.builtin.file:
    path: "/etc/nginx/sites-enabled/default"
    state: absent
  notify: reload nginx

- name: Ensure shared rate-limit zones include
  ansible.builtin.copy:
    dest: /etc/nginx/conf.d/pantry-shared.conf
    mode: "0644"
    content: |
      # Global rate-limit zones consumed by both vhosts.
      limit_req_zone $binary_remote_addr zone=pantry_global:10m rate=30r/m;
      limit_req_zone $binary_remote_addr zone=pantry_auth:10m rate=10r/m;
      proxy_buffering on;
      proxy_read_timeout 30s;
  notify: reload nginx

- name: Install api vhost
  ansible.builtin.template:
    src: api.vhost.j2
    dest: /etc/nginx/sites-available/api.conf
    mode: "0644"
  notify: reload nginx

- name: Enable api vhost
  ansible.builtin.file:
    src: /etc/nginx/sites-available/api.conf
    dest: /etc/nginx/sites-enabled/api.conf
    state: link
  notify: reload nginx

- name: Install admin vhost
  ansible.builtin.template:
    src: admin.vhost.j2
    dest: /etc/nginx/sites-available/admin.conf
    mode: "0644"
  notify: reload nginx

- name: Enable admin vhost
  ansible.builtin.file:
    src: /etc/nginx/sites-available/admin.conf
    dest: /etc/nginx/sites-enabled/admin.conf
    state: link
  notify: reload nginx

- name: Ensure nginx running and enabled
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true
```

- [ ] **Step 3: Write `infra/roles/nginx/handlers/main.yml`**

```yaml
---
- name: reload nginx
  ansible.builtin.service:
    name: nginx
    state: reloaded
```

- [ ] **Step 4: Write `infra/roles/nginx/templates/api.vhost.j2`**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name {{ api_domain }};

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name {{ api_domain }};

    ssl_certificate     /etc/letsencrypt/live/{{ api_domain }}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{ api_domain }}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;

    client_max_body_size 10m;

    location /v1/auth/ {
        limit_req zone=pantry_auth burst=5 nodelay;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://127.0.0.1:4000;
    }

    location / {
        limit_req zone=pantry_global burst=20 nodelay;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://127.0.0.1:4000;
    }
}
```

- [ ] **Step 5: Write `infra/roles/nginx/templates/admin.vhost.j2`**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name {{ admin_domain }};

    location /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
    }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name {{ admin_domain }};

    ssl_certificate     /etc/letsencrypt/live/{{ admin_domain }}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{ admin_domain }}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header X-Frame-Options "DENY" always;

    # IP allowlist
{% for cidr in admin_allowlist %}
    allow {{ cidr }};
{% endfor %}
    deny all;

    client_max_body_size 10m;

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        # Cookies for the admin app are SameSite=Lax + Secure; pass them through unchanged
        proxy_pass http://127.0.0.1:4001;
    }
}
```

- [ ] **Step 6: Commit**

```bash
git add infra/roles/nginx
git commit -m "feat(infra): nginx role with api + admin vhosts and IP allowlist"
```

---

### Task K2: `certbot` role

**Files:**
- Create: `infra/roles/certbot/tasks/main.yml`
- Create: `infra/roles/certbot/files/reload-nginx.sh`

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/roles/certbot/{tasks,files}
```

- [ ] **Step 2: Write `infra/roles/certbot/tasks/main.yml`**

```yaml
---
- name: Install certbot
  ansible.builtin.apt:
    name:
      - certbot
      - python3-certbot-nginx
    state: present

- name: Ensure ACME webroot exists
  ansible.builtin.file:
    path: /var/www/letsencrypt
    state: directory
    owner: www-data
    group: www-data
    mode: "0755"

- name: Obtain TLS cert for api domain
  ansible.builtin.command: >-
    certbot certonly --non-interactive --agree-tos
    --email {{ letsencrypt_email }}
    --webroot -w /var/www/letsencrypt
    -d {{ api_domain }}
  args:
    creates: "/etc/letsencrypt/live/{{ api_domain }}/fullchain.pem"

- name: Obtain TLS cert for admin domain
  ansible.builtin.command: >-
    certbot certonly --non-interactive --agree-tos
    --email {{ letsencrypt_email }}
    --webroot -w /var/www/letsencrypt
    -d {{ admin_domain }}
  args:
    creates: "/etc/letsencrypt/live/{{ admin_domain }}/fullchain.pem"

- name: Install deploy hook to reload nginx on renew
  ansible.builtin.copy:
    src: reload-nginx.sh
    dest: /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
    mode: "0755"

- name: Ensure certbot renew timer is enabled
  ansible.builtin.service:
    name: certbot.timer
    state: started
    enabled: true
```

- [ ] **Step 3: Write `infra/roles/certbot/files/reload-nginx.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail
systemctl reload nginx
```

- [ ] **Step 4: Commit**

```bash
git add infra/roles/certbot
git commit -m "feat(infra): certbot role with renew-hook nginx reload"
```

---

## Phase L — App systemd units, sudoers, secrets

### Task L1: `app` role — systemd units + sudoers

**Files:**
- Create: `infra/roles/app/tasks/main.yml`
- Create: `infra/roles/app/handlers/main.yml`
- Create: `infra/roles/app/templates/pantry-api.service.j2`
- Create: `infra/roles/app/templates/pantry-admin.service.j2`
- Create: `infra/roles/app/templates/sudoers-pantry.j2`

- [ ] **Step 1: Create directories**

```bash
mkdir -p infra/roles/app/{tasks,handlers,templates}
```

- [ ] **Step 2: Write `infra/roles/app/tasks/main.yml`**

```yaml
---
- name: Install pantry-api systemd unit
  ansible.builtin.template:
    src: pantry-api.service.j2
    dest: /etc/systemd/system/pantry-api.service
    mode: "0644"
  notify:
    - reload systemd
    - restart pantry-api

- name: Install pantry-admin systemd unit
  ansible.builtin.template:
    src: pantry-admin.service.j2
    dest: /etc/systemd/system/pantry-admin.service
    mode: "0644"
  notify:
    - reload systemd
    - restart pantry-admin

- name: Install pantry sudoers fragment
  ansible.builtin.template:
    src: sudoers-pantry.j2
    dest: /etc/sudoers.d/pantry
    mode: "0440"
    owner: root
    group: root
    validate: visudo -cf %s

- name: Ensure pantry-api enabled
  ansible.builtin.service:
    name: pantry-api
    enabled: true

- name: Ensure pantry-admin enabled
  ansible.builtin.service:
    name: pantry-admin
    enabled: true

- name: Install nightly backup cron
  ansible.builtin.cron:
    name: pantry-backup
    user: root
    hour: "3"
    minute: "0"
    job: "{{ app_root }}/current/infra/scripts/backup.sh >> /var/log/pantry/backup.log 2>&1"
```

- [ ] **Step 3: Write `infra/roles/app/handlers/main.yml`**

```yaml
---
- name: reload systemd
  ansible.builtin.systemd:
    daemon_reload: true

- name: restart pantry-api
  ansible.builtin.service:
    name: pantry-api
    state: restarted

- name: restart pantry-admin
  ansible.builtin.service:
    name: pantry-admin
    state: restarted
```

- [ ] **Step 4: Write `infra/roles/app/templates/pantry-api.service.j2`**

```ini
[Unit]
Description=Pantry API (Fastify)
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User={{ app_user }}
Group={{ app_group }}
WorkingDirectory={{ app_root }}/current/api
EnvironmentFile={{ config_dir }}/.env.production
ExecStart=/usr/bin/node {{ app_root }}/current/api/dist/server.js
Restart=always
RestartSec=2
KillSignal=SIGTERM
TimeoutStopSec=30
StandardOutput=append:/var/log/pantry/api.log
StandardError=append:/var/log/pantry/api.log

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/pantry
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 5: Write `infra/roles/app/templates/pantry-admin.service.j2`**

```ini
[Unit]
Description=Pantry Admin (Next.js)
After=network.target pantry-api.service
Wants=pantry-api.service

[Service]
Type=simple
User={{ app_user }}
Group={{ app_group }}
WorkingDirectory={{ app_root }}/current/apps/admin
EnvironmentFile={{ config_dir }}/.env.production
Environment=PORT=4001
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node {{ app_root }}/current/apps/admin/.next/standalone/apps/admin/server.js
Restart=always
RestartSec=2
KillSignal=SIGTERM
TimeoutStopSec=30
StandardOutput=append:/var/log/pantry/admin.log
StandardError=append:/var/log/pantry/admin.log

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/pantry
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 6: Write `infra/roles/app/templates/sudoers-pantry.j2`**

```
# Managed by Ansible — do not edit.
{{ app_user }} ALL=(root) NOPASSWD: /bin/systemctl reload pantry-api, /bin/systemctl reload pantry-admin, /bin/systemctl restart pantry-api, /bin/systemctl restart pantry-admin
Defaults!/bin/systemctl !requiretty
```

- [ ] **Step 7: Commit**

```bash
git add infra/roles/app
git commit -m "feat(infra): app role (systemd units, sudoers, backup cron)"
```

---

### Task L2: `secrets` role

**Files:**
- Create: `infra/roles/secrets/tasks/main.yml`

The role does NOT generate or push secrets; it asserts the operator has placed `/etc/pantry/.env.production` on the host with mode 600 owned by `pantryapp:pantryapp`. This keeps secrets out of git and out of Ansible's logs.

- [ ] **Step 1: Create directory**

```bash
mkdir -p infra/roles/secrets/tasks
```

- [ ] **Step 2: Write `infra/roles/secrets/tasks/main.yml`**

```yaml
---
- name: Check /etc/pantry/.env.production exists
  ansible.builtin.stat:
    path: "{{ config_dir }}/.env.production"
  register: env_prod

- name: Fail with instructions if env file is missing
  ansible.builtin.fail:
    msg: |
      {{ config_dir }}/.env.production is missing on the host.
      Create it manually with mode 600 owned by {{ app_user }}:{{ app_group }}.
      Required keys are documented in api/.env.example and apps/admin/.env.example.
  when: not env_prod.stat.exists

- name: Enforce permissions on env file
  ansible.builtin.file:
    path: "{{ config_dir }}/.env.production"
    owner: "{{ app_user }}"
    group: "{{ app_group }}"
    mode: "0600"
```

- [ ] **Step 3: Commit**

```bash
git add infra/roles/secrets
git commit -m "feat(infra): secrets role asserts env file presence and perms"
```

---

## Phase M — Backup automation

### Task M1: `backup.sh` with age + rclone + 7/4/3 rotation

**Files:**
- Create: `infra/scripts/backup.sh`

- [ ] **Step 1: Write `infra/scripts/backup.sh`**

```bash
#!/usr/bin/env bash
#
# Nightly Pantry backup. Run as root via cron from /etc/pantry/.env.production-aware path.
#
#   pg_dump --format=custom pantry  →  age -r <recipient>  →  /var/backups/pantry/YYYY-MM-DD.age
#   rclone copy to <remote>:<bucket>/daily/
#   Rotation: keep 7 daily, 4 weekly (Sundays), 3 monthly (1st of month)
#
# Environment (sourced from /etc/pantry/.env.production):
#   DATABASE_URL                 — Postgres connection string for pg_dump
#   BACKUP_AGE_RECIPIENT         — age public key
#   BACKUP_RCLONE_REMOTE         — e.g., b2:pantry-backups
#   BACKUP_LOCAL_DIR             — default /var/backups/pantry

set -euo pipefail

ENV_FILE=/etc/pantry/.env.production
if [[ ! -r "$ENV_FILE" ]]; then
    echo "Cannot read $ENV_FILE" >&2
    exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"
: "${BACKUP_RCLONE_REMOTE:?BACKUP_RCLONE_REMOTE is required}"

LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pantry}"
mkdir -p "$LOCAL_DIR"/{daily,weekly,monthly}

TODAY=$(date -u +%F)        # YYYY-MM-DD
DOW=$(date -u +%u)          # 1..7 (Monday=1, Sunday=7)
DOM=$(date -u +%d)          # 01..31

OUT="$LOCAL_DIR/daily/${TODAY}.age"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

log "starting backup → $OUT"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
    | age -r "$BACKUP_AGE_RECIPIENT" \
    > "$OUT"

# Local copies for weekly/monthly retention
if [[ "$DOW" == "7" ]]; then
    cp -f "$OUT" "$LOCAL_DIR/weekly/${TODAY}.age"
fi
if [[ "$DOM" == "01" ]]; then
    cp -f "$OUT" "$LOCAL_DIR/monthly/${TODAY}.age"
fi

# Push to remote
log "uploading daily to ${BACKUP_RCLONE_REMOTE}/daily/"
rclone copy "$OUT" "${BACKUP_RCLONE_REMOTE}/daily/" --config /root/.config/rclone/rclone.conf

if [[ "$DOW" == "7" ]]; then
    log "uploading weekly"
    rclone copy "$LOCAL_DIR/weekly/${TODAY}.age" "${BACKUP_RCLONE_REMOTE}/weekly/" --config /root/.config/rclone/rclone.conf
fi
if [[ "$DOM" == "01" ]]; then
    log "uploading monthly"
    rclone copy "$LOCAL_DIR/monthly/${TODAY}.age" "${BACKUP_RCLONE_REMOTE}/monthly/" --config /root/.config/rclone/rclone.conf
fi

# Rotation (local + remote): 7 daily, 4 weekly, 3 monthly
prune_local_and_remote() {
    local subdir="$1" keep="$2"
    # local
    mapfile -t files < <(ls -1t "$LOCAL_DIR/$subdir"/*.age 2>/dev/null || true)
    if (( ${#files[@]} > keep )); then
        for f in "${files[@]:keep}"; do
            log "deleting local $f"
            rm -f "$f"
        done
    fi
    # remote
    mapfile -t rfiles < <(rclone lsf "${BACKUP_RCLONE_REMOTE}/${subdir}/" --files-only --config /root/.config/rclone/rclone.conf | sort -r)
    if (( ${#rfiles[@]} > keep )); then
        for f in "${rfiles[@]:keep}"; do
            log "deleting remote ${BACKUP_RCLONE_REMOTE}/${subdir}/${f}"
            rclone deletefile "${BACKUP_RCLONE_REMOTE}/${subdir}/${f}" --config /root/.config/rclone/rclone.conf
        done
    fi
}

prune_local_and_remote daily 7
prune_local_and_remote weekly 4
prune_local_and_remote monthly 3

log "backup complete"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x infra/scripts/backup.sh
```

- [ ] **Step 3: Static-check with shellcheck if available**

```bash
test -x "$(command -v shellcheck)" && shellcheck infra/scripts/backup.sh || echo "shellcheck not installed; skip"
```
Expected: no output (clean) if shellcheck is installed, else the skip message.

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/backup.sh
git commit -m "feat(infra): nightly backup script (pg_dump | age | rclone, 7/4/3 rotation)"
```

---

### Task M2: `restore.sh` stub

**Files:**
- Create: `infra/scripts/restore.sh`

- [ ] **Step 1: Write `infra/scripts/restore.sh`**

```bash
#!/usr/bin/env bash
#
# Restore the encrypted Pantry backup for a given date into the configured DB.
#
# Usage:
#   ./restore.sh <YYYY-MM-DD> [daily|weekly|monthly]
#
# Requires AGE_IDENTITY_FILE in /etc/pantry/.env.production pointing to the
# age private key file (mode 600). Will pg_restore into DATABASE_URL,
# overwriting existing data — caller is responsible for confirming target.

set -euo pipefail

ENV_FILE=/etc/pantry/.env.production
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${AGE_IDENTITY_FILE:?AGE_IDENTITY_FILE is required (path to age private key)}"
: "${BACKUP_RCLONE_REMOTE:?BACKUP_RCLONE_REMOTE is required}"

DATE="${1:?date YYYY-MM-DD is required}"
TIER="${2:-daily}"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pantry}"

case "$TIER" in
    daily|weekly|monthly) ;;
    *) echo "tier must be daily|weekly|monthly" >&2; exit 2 ;;
esac

SRC_LOCAL="$LOCAL_DIR/$TIER/${DATE}.age"
SRC_REMOTE="${BACKUP_RCLONE_REMOTE}/${TIER}/${DATE}.age"
TMP_DUMP=$(mktemp --suffix=.dump)
trap 'rm -f "$TMP_DUMP"' EXIT

if [[ -f "$SRC_LOCAL" ]]; then
    echo "decrypting local $SRC_LOCAL"
    age -d -i "$AGE_IDENTITY_FILE" -o "$TMP_DUMP" "$SRC_LOCAL"
else
    echo "fetching $SRC_REMOTE"
    TMP_ENC=$(mktemp --suffix=.age)
    trap 'rm -f "$TMP_DUMP" "$TMP_ENC"' EXIT
    rclone copyto "$SRC_REMOTE" "$TMP_ENC" --config /root/.config/rclone/rclone.conf
    echo "decrypting"
    age -d -i "$AGE_IDENTITY_FILE" -o "$TMP_DUMP" "$TMP_ENC"
fi

echo "restoring into $DATABASE_URL"
pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" "$TMP_DUMP"
echo "restore complete"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x infra/scripts/restore.sh
```

- [ ] **Step 3: Static-check with shellcheck if available**

```bash
test -x "$(command -v shellcheck)" && shellcheck infra/scripts/restore.sh || echo "shellcheck not installed; skip"
```
Expected: clean or skip.

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/restore.sh
git commit -m "feat(infra): restore.sh decrypts age + pg_restore from local or remote"
```

---

## Phase N — Deploy pipeline

### Task N1: Remote deploy script run via SSH

**Files:**
- Create: `infra/scripts/deploy-remote.sh`

This script lives in the repo and is rsynced to the host as part of each release, but the GitHub Actions job invokes the copy already on disk (`/opt/pantry/releases/<sha>/infra/scripts/deploy-remote.sh`). Atomic symlink flip with health-check rollback.

- [ ] **Step 1: Write `infra/scripts/deploy-remote.sh`**

```bash
#!/usr/bin/env bash
#
# Run on the VPS as the `pantryapp` user. Assumes a freshly-rsynced release
# directory at /opt/pantry/releases/<SHA>/ that contains the full repo with
# api/dist and apps/admin/.next/standalone already built.
#
# Usage: ./deploy-remote.sh <SHA> <API_DOMAIN>

set -euo pipefail

SHA="${1:?sha required}"
API_DOMAIN="${2:?api domain required}"
APP_ROOT=/opt/pantry
NEW="$APP_ROOT/releases/$SHA"
CURRENT="$APP_ROOT/current"

if [[ ! -d "$NEW" ]]; then
    echo "release dir $NEW not found" >&2
    exit 1
fi

# Remember the previous release for rollback
PREV=""
if [[ -L "$CURRENT" ]]; then
    PREV=$(readlink "$CURRENT")
fi

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }

# 1. Install prod deps in the release (deterministic; same lockfile)
log "installing prod deps"
cd "$NEW"
pnpm install --prod --frozen-lockfile

# 2. Run migrations
log "running prisma migrate deploy"
cd "$NEW/api"
pnpm exec prisma migrate deploy
cd "$NEW"

# 3. Atomic symlink flip
log "flipping symlink"
ln -sfn "$NEW" "$CURRENT"

# 4. Graceful reload
log "reloading services"
sudo /bin/systemctl reload pantry-api
sudo /bin/systemctl reload pantry-admin

# 5. Smoke test with backoff
smoke() {
    local i delay url="https://${API_DOMAIN}/health/ready"
    for i in 1 2 3 4 5; do
        delay=$(( i * 2 ))
        if curl -fsS "$url" >/dev/null; then
            log "smoke ok (attempt $i)"
            return 0
        fi
        log "smoke attempt $i failed; sleeping ${delay}s"
        sleep "$delay"
    done
    return 1
}

if ! smoke; then
    log "SMOKE FAILED — rolling back"
    if [[ -n "$PREV" ]]; then
        ln -sfn "$PREV" "$CURRENT"
        sudo /bin/systemctl reload pantry-api
        sudo /bin/systemctl reload pantry-admin
        log "rolled back to $PREV"
    else
        log "no previous release to roll back to"
    fi
    exit 1
fi

# 6. Prune old releases (keep last 5)
cd "$APP_ROOT/releases"
ls -1t | tail -n +6 | xargs -r rm -rf
log "deploy complete: $SHA"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x infra/scripts/deploy-remote.sh
```

- [ ] **Step 3: shellcheck**

```bash
test -x "$(command -v shellcheck)" && shellcheck infra/scripts/deploy-remote.sh || echo "shellcheck not installed; skip"
```

- [ ] **Step 4: Commit**

```bash
git add infra/scripts/deploy-remote.sh
git commit -m "feat(infra): deploy-remote.sh with atomic symlink flip + smoke rollback"
```

---

### Task N2: GitHub Actions `deploy.yml`

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

```yaml
name: deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: pantry
          POSTGRES_PASSWORD: pantry
          POSTGRES_DB: pantry_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U pantry -d pantry_test"
          --health-interval 5s --health-timeout 5s --health-retries 10
      redis:
        image: redis:7
        ports: ['6379:6379']
        options: --health-cmd "redis-cli ping" --health-interval 5s
    env:
      DATABASE_URL: postgresql://pantry:pantry@localhost:5432/pantry_test
      REDIS_URL: redis://localhost:6379/15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: cp api/.env.test.example api/.env.test
      - run: pnpm --filter @pantry/api exec prisma generate
      - run: pnpm --filter @pantry/api exec prisma migrate deploy
      - run: pnpm -r typecheck
      - run: pnpm -r test

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      sha: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @pantry/api exec prisma generate
      - run: pnpm -r build
      - name: Package release tarball
        run: |
          set -euo pipefail
          mkdir -p out
          tar --exclude='node_modules' --exclude='.next/cache' --exclude='.turbo' \
              --exclude='.git' --exclude='tests' --exclude='**/playwright-report' \
              -czf out/pantry-${{ github.sha }}.tar.gz \
              api apps/admin packages infra package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json
      - uses: actions/upload-artifact@v4
        with:
          name: pantry-release
          path: out/pantry-${{ github.sha }}.tar.gz
          retention-days: 14

  deploy:
    needs: [test, build]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with: { name: pantry-release, path: out }

      - name: Configure SSH
        run: |
          set -euo pipefail
          mkdir -p ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.DEPLOY_HOST }}" >> ~/.ssh/known_hosts

      - name: Upload release tarball
        run: |
          set -euo pipefail
          scp -i ~/.ssh/id_ed25519 out/pantry-${{ github.sha }}.tar.gz \
              pantryapp@${{ secrets.DEPLOY_HOST }}:/tmp/

      - name: Extract on host and run deploy
        run: |
          set -euo pipefail
          SHA=${{ github.sha }}
          ssh -i ~/.ssh/id_ed25519 pantryapp@${{ secrets.DEPLOY_HOST }} bash <<EOF
          set -euo pipefail
          mkdir -p /opt/pantry/releases/$SHA
          tar -xzf /tmp/pantry-$SHA.tar.gz -C /opt/pantry/releases/$SHA
          rm -f /tmp/pantry-$SHA.tar.gz
          chmod +x /opt/pantry/releases/$SHA/infra/scripts/deploy-remote.sh
          /opt/pantry/releases/$SHA/infra/scripts/deploy-remote.sh $SHA ${{ secrets.API_DOMAIN }}
          EOF
```

- [ ] **Step 3: Lint the workflow with `actionlint` if available**

```bash
test -x "$(command -v actionlint)" && actionlint .github/workflows/deploy.yml || echo "actionlint not installed; skip"
```
Expected: clean or skip.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(infra): GitHub Actions deploy pipeline (test → build → ssh-rsync → flip)"
```

---

## Phase O — Renovate + weekly audit

### Task O1: Renovate config

**Files:**
- Create: `renovate.json`

- [ ] **Step 1: Write `renovate.json`**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":semanticCommits", ":dependencyDashboard"],
  "timezone": "Etc/UTC",
  "schedule": ["before 6am on monday"],
  "labels": ["deps"],
  "rangeStrategy": "bump",
  "automergeType": "pr",
  "platformAutomerge": true,
  "packageRules": [
    {
      "matchDepTypes": ["devDependencies"],
      "groupName": "dev dependencies",
      "schedule": ["before 6am on monday"],
      "matchUpdateTypes": ["minor", "patch"]
    },
    {
      "matchDepTypes": ["dependencies"],
      "matchUpdateTypes": ["patch"],
      "automerge": true
    },
    {
      "matchDepTypes": ["dependencies"],
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true
    },
    {
      "matchManagers": ["github-actions"],
      "groupName": "github actions"
    }
  ],
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"]
  }
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -c "import json,sys; json.load(open('renovate.json'))"
```
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add renovate.json
git commit -m "chore(infra): renovate config (group dev, automerge patch)"
```

---

### Task O2: Weekly `pnpm audit` workflow

**Files:**
- Create: `.github/workflows/audit.yml`

- [ ] **Step 1: Write `.github/workflows/audit.yml`**

```yaml
name: audit

on:
  schedule:
    - cron: "0 7 * * 1"
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Run pnpm audit
        id: audit
        run: |
          set +e
          pnpm audit --json > audit.json
          STATUS=$?
          echo "status=$STATUS" >> "$GITHUB_OUTPUT"
          exit 0

      - name: Open issue on vulnerabilities
        if: steps.audit.outputs.status != '0'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const body = '```\n' + fs.readFileSync('audit.json', 'utf8').slice(0, 60000) + '\n```';
            const title = `pnpm audit found vulnerabilities (${new Date().toISOString().slice(0,10)})`;
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title,
              labels: ['security', 'deps'],
              body,
            });
```

- [ ] **Step 2: actionlint (if available)**

```bash
test -x "$(command -v actionlint)" && actionlint .github/workflows/audit.yml || echo "actionlint not installed; skip"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/audit.yml
git commit -m "chore(infra): weekly pnpm audit workflow that files an issue on vulns"
```

---

## Phase Z — Final verification

### Task Z1: Run every test and check every artifact

- [ ] **Step 1: Generate Prisma client**

```bash
pnpm --filter @pantry/api exec prisma generate
```

- [ ] **Step 2: Typecheck the whole repo**

```bash
pnpm typecheck
```
Expected: every workspace package exits 0 — including `@pantry/admin`.

- [ ] **Step 3: Run API tests**

```bash
pnpm --filter @pantry/api test
```
Expected: every M0a/M0b test plus the new `tests/integration/audit-log.test.ts` (3 tests) passes.

- [ ] **Step 4: Run admin unit tests**

```bash
pnpm --filter @pantry/admin test
```
Expected: `env.test.ts` (3), `cookies.test.ts` (4), `csrf.test.ts` (4) — 11 tests total pass.

- [ ] **Step 5: Run admin E2E**

```bash
pnpm --filter @pantry/admin test:e2e
```
Expected: 2 tests pass (login flow + unauthenticated redirect).

- [ ] **Step 6: Build everything**

```bash
pnpm -r build
```
Expected: `@pantry/api` produces `api/dist/`; `@pantry/admin` produces `apps/admin/.next/standalone/`.

- [ ] **Step 7: Ansible syntax check (if installed)**

```bash
test -x "$(command -v ansible-playbook)" \
    && ansible-playbook --syntax-check infra/site.yml -i infra/inventory.example.ini \
    || echo "ansible-playbook not installed; skip"
```
Expected: clean parse or skip.

- [ ] **Step 8: shellcheck all scripts (if installed)**

```bash
test -x "$(command -v shellcheck)" \
    && shellcheck infra/scripts/*.sh \
    || echo "shellcheck not installed; skip"
```
Expected: clean or skip.

- [ ] **Step 9: actionlint workflows (if installed)**

```bash
test -x "$(command -v actionlint)" \
    && actionlint .github/workflows/*.yml \
    || echo "actionlint not installed; skip"
```
Expected: clean or skip.

- [ ] **Step 10: Verify git history is clean**

```bash
git status
git log --oneline -50
```
Expected: working tree clean; commits all conventional with `admin` or `infra` scopes; chronologically sensible.

- [ ] **Step 11: Tag the milestone**

```bash
git tag m0d-complete
```

---

## Self-review checklist (run before declaring M0d done)

- [ ] `pnpm typecheck` is green for every workspace package, including `@pantry/admin`.
- [ ] `pnpm --filter @pantry/api test` runs the M0a/M0b tests + 3 new `audit-log.test.ts` tests, all passing.
- [ ] `pnpm --filter @pantry/admin test` runs 11 unit tests, all passing.
- [ ] `pnpm --filter @pantry/admin test:e2e` runs 2 Playwright tests, both passing against a real seeded admin user with TOTP enrolled.
- [ ] `pnpm --filter @pantry/admin build` emits `apps/admin/.next/standalone/apps/admin/server.js` (the path referenced by `pantry-admin.service.j2`).
- [ ] Every spec §8.3 route is stubbed: `/`, `/users`, `/users/[id]`, `/products`, `/products/[id]`, `/products/pending`, `/reviews`, `/reviews/[id]`, `/reports`, `/reports/[id]`, `/analytics/{overview,scans,reviews,geography}`, `/system/{queue,push,api-errors,external-apis}`, `/settings/{feature-flags,notification-templates,moderation,admins}`.
- [ ] `apps/admin/src/middleware.ts` redirects unauthenticated requests to `/login` and authenticated requests away from `/login`.
- [ ] `apps/admin/src/lib/session.ts` enforces `role === 'admin'` and performs one refresh-on-401 retry before redirecting.
- [ ] Tokens are stored ONLY in HTTP-only cookies (`pantry_admin_access`, `pantry_admin_refresh`); the CSRF cookie (`pantry_admin_csrf`) is intentionally NOT HTTP-only.
- [ ] All mutating Route Handlers (`/api/auth/refresh`, `/api/auth/logout`) verify the double-submit CSRF token via `isCsrfValid`.
- [ ] `admin_audit_log` table exists in the Prisma schema and the `writeAuditLog` service inserts into it (verified by integration tests).
- [ ] Ansible roles `common`, `postgres`, `redis`, `nodejs`, `nginx`, `certbot`, `app`, `secrets` exist and `site.yml` composes them in dependency order.
- [ ] `infra/inventory.example.ini` and `infra/group_vars/all.example.yml` carry only placeholder values; no real domains, IPs, or secrets are committed.
- [ ] nginx vhost `admin.<domain>` enforces the IP allowlist via per-CIDR `allow` lines followed by `deny all`.
- [ ] nginx vhost `api.<domain>` applies stricter rate-limit zone `pantry_auth` to `/v1/auth/`.
- [ ] systemd units use `EnvironmentFile=/etc/pantry/.env.production`, run as `pantryapp`, set `TimeoutStopSec=30`, and enable systemd hardening flags.
- [ ] `/etc/sudoers.d/pantry` allows `pantryapp` to reload/restart ONLY `pantry-api` and `pantry-admin` and is validated by `visudo -cf`.
- [ ] `.github/workflows/deploy.yml` runs tests with real Postgres + Redis service containers, builds, ships a tarball, and invokes `deploy-remote.sh`.
- [ ] `deploy-remote.sh` does atomic `ln -sfn`, smoke-tests `/health/ready` with backoff, and flips back to the previous release on failure.
- [ ] `infra/scripts/backup.sh` pipes `pg_dump | age | rclone` and applies the 7/4/3 daily/weekly/monthly rotation locally AND remotely.
- [ ] `infra/scripts/restore.sh` decrypts (local-or-remote) and runs `pg_restore`.
- [ ] `renovate.json` validates as JSON, groups dev deps, and automerges patches.
- [ ] `.github/workflows/audit.yml` runs weekly and opens an issue when `pnpm audit` reports vulnerabilities.

---
