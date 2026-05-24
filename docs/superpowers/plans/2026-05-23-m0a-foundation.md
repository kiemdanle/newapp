# M0a — Foundation, Schemas, Themes, API Auth Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the monorepo, the shared Zod schemas, the four theme token files, the Fastify API foundation (config, db, redis, error handling, plugins, health), and all auth service-layer logic (passwords, tokens, sessions, email, country detection, users repo, auth decorator). At the end of M0a, you have a green test suite covering every pure-logic and service-layer auth concern; HTTP routes follow in M0b.

**Architecture:** Monorepo (pnpm + Turborepo). Fastify 4 API with Zod-validated config, RFC 7807 errors, Helmet, CORS, Redis-backed rate limiting, and Prisma against Postgres 16. All M0 tables created via a single initial migration. Tests run against a real local Postgres `pantry_test` database; CI uses a Postgres service.

**Tech Stack:** Node 20 LTS, TypeScript 5, pnpm 9, Turborepo, Fastify 4, Prisma 5, Postgres 16, Redis 7, ioredis, Zod 3, argon2, jose, otplib, nodemailer, pino, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-05-23-pantry-app-design.md`. Read sections 1–4.3, 5, 6.8, 10.3, 11 before starting.

**M0 sub-plans (executed in order):**

1. **M0a (this plan)** — Foundation: monorepo, shared schemas, theme tokens, API skeleton, auth service layer
2. **M0b** — API auth routes (register/login/refresh/me/verify-email/forgot-reset/oauth/passkey/totp)
3. **M0c** — Mobile app shell with full auth flow + theme switcher
4. **M0d** — Admin shell with TOTP login + Ansible/systemd/nginx + deploy pipeline

**Out of scope for M0a:** any HTTP route beyond `/health`. The route layer is M0b.

---

## File map

This plan creates the following files. Files in **bold** carry significant logic; the rest are wiring. Mobile, admin, and infra files are deferred to M0c/M0d.

```
pantry/
├── .gitignore
├── .editorconfig
├── .nvmrc
├── package.json                                      pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── README.md
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/index.ts
│   │   ├── src/schemas/auth.ts                      ← Zod auth schemas
│   │   ├── src/schemas/user.ts
│   │   ├── src/schemas/error.ts
│   │   └── src/types.ts
│   └── theme/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/index.ts
│       ├── src/tokens.ts                            ← Token shape definition
│       ├── src/themes/aurora.ts
│       ├── src/themes/bento.ts
│       ├── src/themes/clay.ts
│       └── src/themes/material.ts
└── api/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.build.json
    ├── prisma/schema.prisma                         ← all M0 tables
    ├── prisma/migrations/                           ← generated
    ├── .env.example
    ├── .env.test.example
    ├── vitest.config.ts
    ├── src/server.ts                                ← Fastify entry (health only in M0a)
    ├── src/config.ts                                ← env loader (Zod-validated)
    ├── src/logger.ts
    ├── src/db.ts                                    ← Prisma client singleton
    ├── src/redis.ts                                 ← ioredis client
    ├── src/errors.ts                                ← AppError + RFC7807 mapper
    ├── src/plugins/auth.ts                          ← Fastify auth decorator
    ├── src/plugins/rate-limit.ts
    ├── src/plugins/cors.ts
    ├── src/plugins/error-handler.ts
    ├── src/routes/health.ts
    ├── **src/services/auth/passwords.ts**           ← argon2
    ├── **src/services/auth/tokens.ts**              ← JWT + refresh
    ├── **src/services/auth/sessions.ts**            ← session CRUD
    ├── **src/services/auth/email.ts**               ← SMTP
    ├── **src/services/users/repository.ts**         ← Prisma helpers
    ├── **src/services/country/detect.ts**           ← ipapi.co + ip-api.com
    ├── src/utils/encryption.ts                      ← AES-GCM
    ├── src/utils/random.ts
    └── tests/
        ├── helpers/setup.ts
        ├── helpers/factories.ts
        ├── unit/config.test.ts
        ├── unit/encryption.test.ts
        ├── unit/passwords.test.ts
        ├── unit/tokens.test.ts
        ├── unit/errors.test.ts
        ├── unit/country-detect.test.ts
        ├── integration/health.test.ts
        └── integration/sessions.test.ts
```

---

## Conventions

- **Always-on TDD where logic exists.** Write the failing test first, run it, watch it fail, implement, run it again, watch it pass, commit. Where there is no testable logic (scaffolding, config files), write a minimal smoke check (e.g., `pnpm build`) and commit.
- **Conventional commits.** `feat(scope): …`, `fix(scope): …`, `chore(scope): …`, `test(scope): …`. Scopes match top-level dirs: `repo`, `shared`, `theme`, `api`, `mobile`, `admin`, `infra`.
- **Commit after every passing task**, not at the end of each phase. Frequent commits make rollback cheap.
- **Test database.** Local: a separate `pantry_test` Postgres database (created in Task D5). CI: GitHub Actions Postgres service. The test setup truncates all tables (in dependency order) before each test.
- **No mocking the DB.** Integration tests run against a real Postgres. Unit tests are reserved for pure functions (hashing, encoding, encryption, etc.).
- **Env vars** loaded via `src/config.ts` and validated with Zod. Missing vars fail fast at boot. Tests use `.env.test`.
- **Type safety end-to-end.** API routes import Zod schemas from `packages/shared`. The mobile app and admin app import the same schemas to derive request/response types. No string-typing across boundaries.
- **No `console.log` in source.** Use the pino logger.

---

## Phase A — Repository foundation

### Task A1: Initialize the monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Verify Node 20 LTS is available**

```bash
node --version
```
Expected: `v20.x.x`. If not, install via `nvm install 20 && nvm use 20`.

- [ ] **Step 2: Verify pnpm 9 is available**

```bash
pnpm --version
```
Expected: `9.x.x`. If not: `corepack enable && corepack prepare pnpm@9 --activate`.

- [ ] **Step 3: Initialize git (if not already)**

```bash
git init -q
git status
```

- [ ] **Step 4: Write `.nvmrc`**

```
20
```

- [ ] **Step 5: Write `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 6: Write `.gitignore`**

```gitignore
# Deps
node_modules/
.pnpm-store/

# Build
dist/
build/
.next/
.expo/
.turbo/
*.tsbuildinfo

# Env
.env
.env.local
.env.*.local
!.env.example
!.env.test.example

# OS
.DS_Store

# Editor
.vscode/
.idea/

# Logs
*.log
pids/

# Test artifacts
coverage/
playwright-report/
test-results/

# Prisma
api/prisma/migrations/dev/

# Brainstorming artifacts
.superpowers/

# Mobile
apps/mobile/ios/
apps/mobile/android/

# Misc
*.pem
.env.production
```

- [ ] **Step 7: Write root `package.json`**

```json
{
  "name": "pantry",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.0.0",
    "prettier": "^3.2.0"
  }
}
```

- [ ] **Step 8: Write `pnpm-workspace.yaml`**

```yaml
packages:
  - "api"
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 9: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", "build", ".next", ".turbo"]
}
```

- [ ] **Step 10: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 11: Write `README.md`**

```markdown
# Pantry

Cross-platform mobile app for tracking product expiry dates with shared product reviews. Self-hosted backend.

## Layout

- `api/` — Fastify backend
- `apps/mobile/` — Expo React Native app
- `apps/admin/` — Next.js admin web UI
- `packages/shared/` — Zod schemas and shared types
- `packages/theme/` — Theme tokens (Aurora, Bento, Clay, Material)
- `infra/` — Ansible provisioning and deploy scripts

## Develop

```sh
pnpm install
pnpm dev
```

## Spec

`docs/superpowers/specs/2026-05-23-pantry-app-design.md`
```

- [ ] **Step 12: Install root deps**

```bash
pnpm install
```
Expected: lockfile generated, `node_modules/` created.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore(repo): initialize pnpm + turbo monorepo"
```

---

### Task A2: Add Prettier config

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 1: Write `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

- [ ] **Step 2: Write `.prettierignore`**

```
node_modules
dist
build
.next
.turbo
.expo
pnpm-lock.yaml
api/prisma/migrations
*.md
```

- [ ] **Step 3: Verify Prettier runs**

```bash
pnpm exec prettier --check .
```
Expected: prints `Checking formatting...` and exits 0 (or lists files; if so, run `pnpm exec prettier --write .` and re-check).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(repo): add prettier config"
```

---

## Phase B — Shared package (Zod schemas)

### Task B1: Scaffold `packages/shared`

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create directory and files**

```bash
mkdir -p packages/shared/src
```

- [ ] **Step 2: Write `packages/shared/package.json`**

```json
{
  "name": "@pantry/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "echo skip",
    "build": "echo skip",
    "test": "echo skip",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Write `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `packages/shared/src/index.ts`**

```ts
export * from './schemas/auth.js';
export * from './schemas/user.js';
export * from './schemas/error.js';
export * from './types.js';
```

- [ ] **Step 5: Install workspace deps**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(shared): scaffold @pantry/shared package"
```

---

### Task B2: Auth schemas

**Files:**
- Create: `packages/shared/src/schemas/auth.ts`
- Create: `packages/shared/src/schemas/user.ts`
- Create: `packages/shared/src/schemas/error.ts`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Write `packages/shared/src/schemas/user.ts`**

```ts
import { z } from 'zod';

export const userRoleSchema = z.enum(['user', 'admin']);
export const userStatusSchema = z.enum(['active', 'suspended', 'deleted']);
export const themePreferenceSchema = z.enum(['aurora', 'bento', 'clay', 'material']);

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  firstName: z.string(),
  lastName: z.string(),
  country: z.string().length(2).nullable(),
  avatarUrl: z.string().url().nullable(),
  role: userRoleSchema,
  status: userStatusSchema,
  themePreference: themePreferenceSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  country: z.string().length(2).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  themePreference: themePreferenceSchema.optional(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
```

- [ ] **Step 2: Write `packages/shared/src/schemas/auth.ts`**

```ts
import { z } from 'zod';
import { userSchema } from './user.js';

const emailField = z.string().trim().toLowerCase().email().max(254);
const passwordField = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters');
const nameField = z.string().trim().min(1).max(80);

export const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type Tokens = z.infer<typeof tokensSchema>;

export const authResultSchema = z.object({
  user: userSchema,
  tokens: tokensSchema,
});
export type AuthResult = z.infer<typeof authResultSchema>;

export const totpChallengeSchema = z.object({
  requiresTotp: z.literal(true),
  challengeToken: z.string(),
});
export type TotpChallenge = z.infer<typeof totpChallengeSchema>;

// --- Email + password ---

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  firstName: nameField,
  lastName: nameField,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailField,
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordField,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// --- OAuth ---

export const oauthGoogleSchema = z.object({
  idToken: z.string().min(1),
});
export const oauthAppleSchema = z.object({
  identityToken: z.string().min(1),
  firstName: nameField.optional(),
  lastName: nameField.optional(),
});

// --- Passkeys ---

export const passkeyRegisterOptionsSchema = z.object({});
export const passkeyRegisterVerifySchema = z.object({
  attestationResponse: z.unknown(),
});
export const passkeyLoginOptionsSchema = z.object({
  email: emailField.optional(),
});
export const passkeyLoginVerifySchema = z.object({
  assertionResponse: z.unknown(),
});

// --- TOTP (admin) ---

export const totpEnrollSchema = z.object({});
export const totpEnrollResponseSchema = z.object({
  secret: z.string(),
  qrCodeDataUrl: z.string(),
  recoveryCodes: z.array(z.string()).length(10),
});
export type TotpEnrollResponse = z.infer<typeof totpEnrollResponseSchema>;

export const totpVerifyEnrollmentSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});
export const totpChallengeVerifySchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});
```

- [ ] **Step 3: Write `packages/shared/src/schemas/error.ts`**

```ts
import { z } from 'zod';

/**
 * RFC 7807 problem+json with a stable `code` for client matching.
 */
export const problemSchema = z.object({
  type: z.string().url().optional(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string(),
  errors: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
});
export type Problem = z.infer<typeof problemSchema>;

export const ERROR_CODES = {
  VALIDATION: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  INTERNAL: 'internal_error',

  // Auth-specific
  INVALID_CREDENTIALS: 'invalid_credentials',
  EMAIL_NOT_VERIFIED: 'email_not_verified',
  EMAIL_ALREADY_REGISTERED: 'email_already_registered',
  INVALID_TOKEN: 'invalid_token',
  TOKEN_EXPIRED: 'token_expired',
  REQUIRES_TOTP: 'requires_totp',
  INVALID_TOTP: 'invalid_totp',
  PASSKEY_VERIFICATION_FAILED: 'passkey_verification_failed',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

- [ ] **Step 4: Write `packages/shared/src/types.ts`**

```ts
export type Paginated<T> = {
  items: T[];
  cursor: string | null;
  total?: number;
};
```

- [ ] **Step 5: Typecheck the package**

```bash
pnpm --filter @pantry/shared typecheck
```
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(shared): add auth, user, and error schemas"
```

---

## Phase C — Theme package (token files only)

### Task C1: Scaffold `packages/theme`

**Files:**
- Create: `packages/theme/package.json`
- Create: `packages/theme/tsconfig.json`
- Create: `packages/theme/src/index.ts`
- Create: `packages/theme/src/tokens.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/theme/src/themes
```

- [ ] **Step 2: Write `packages/theme/package.json`**

```json
{
  "name": "@pantry/theme",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "echo skip",
    "build": "echo skip",
    "test": "echo skip",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Write `packages/theme/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Write `packages/theme/src/tokens.ts`**

```ts
/**
 * Theme token shape. Every theme must implement this exact contract.
 */
export type ThemeId = 'aurora' | 'bento' | 'clay' | 'material';

export interface ColorTokens {
  bg: string;
  bgElevated: string;
  bgGlass: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryFg: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  /** Used by the home expiry hero card */
  hero: string;
  heroFg: string;
}

export interface RadiusTokens {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

export interface ShadowTokens {
  none: string;
  sm: string;
  md: string;
  lg: string;
  glow: string;
}

export interface TypographyTokens {
  fontFamily: string;
  fontFamilyDisplay: string;
  weightRegular: number;
  weightMedium: number;
  weightBold: number;
  letterSpacingTight: number;
}

export interface SpacingTokens {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface AnimationTokens {
  fast: number;
  base: number;
  slow: number;
  themeSwitch: number;
}

export interface Theme {
  id: ThemeId;
  name: string;
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  radii: RadiusTokens;
  shadows: ShadowTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  animation: AnimationTokens;
}
```

- [ ] **Step 5: Write `packages/theme/src/index.ts`**

```ts
export * from './tokens.js';
export { aurora } from './themes/aurora.js';
export { bento } from './themes/bento.js';
export { clay } from './themes/clay.js';
export { material } from './themes/material.js';

import type { Theme, ThemeId } from './tokens.js';
import { aurora } from './themes/aurora.js';
import { bento } from './themes/bento.js';
import { clay } from './themes/clay.js';
import { material } from './themes/material.js';

export const themes: Record<ThemeId, Theme> = {
  aurora,
  bento,
  clay,
  material,
};

export const themeList: Theme[] = [aurora, bento, clay, material];
```

- [ ] **Step 6: Commit (will not typecheck yet — themes are next)**

```bash
git add -A
git commit -m "feat(theme): scaffold @pantry/theme with token contract"
```

---

### Task C2: Aurora Glass theme tokens

**Files:**
- Create: `packages/theme/src/themes/aurora.ts`

- [ ] **Step 1: Write `packages/theme/src/themes/aurora.ts`**

```ts
import type { Theme } from '../tokens.js';

export const aurora: Theme = {
  id: 'aurora',
  name: 'Aurora Glass',
  scheme: 'dark',
  colors: {
    bg: '#0b0a17',
    bgElevated: 'rgba(255,255,255,0.06)',
    bgGlass: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.12)',
    text: '#fafafa',
    textMuted: 'rgba(250,250,250,0.7)',
    textInverse: '#0b0a17',
    primary: '#a855f7',
    primaryFg: '#ffffff',
    accent: '#a5f3fc',
    success: '#86efac',
    warning: '#fbbf24',
    danger: '#fb7185',
    hero: 'rgba(255,255,255,0.08)',
    heroFg: '#ffffff',
  },
  radii: { none: 0, sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  shadows: {
    none: 'none',
    sm: '0 2px 8px rgba(0,0,0,0.25)',
    md: '0 8px 24px -8px rgba(124,58,237,0.45)',
    lg: '0 24px 56px -20px rgba(124,58,237,0.6)',
    glow: '0 0 32px rgba(168,85,247,0.45)',
  },
  typography: {
    fontFamily: 'System',
    fontFamilyDisplay: 'System',
    weightRegular: 400,
    weightMedium: 500,
    weightBold: 700,
    letterSpacingTight: -0.5,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 32 },
  animation: { fast: 120, base: 220, slow: 320, themeSwitch: 200 },
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(theme): add Aurora Glass tokens"
```

---

### Task C3: Bento Grid theme tokens

**Files:**
- Create: `packages/theme/src/themes/bento.ts`

- [ ] **Step 1: Write `packages/theme/src/themes/bento.ts`**

```ts
import type { Theme } from '../tokens.js';

export const bento: Theme = {
  id: 'bento',
  name: 'Bento Grid',
  scheme: 'light',
  colors: {
    bg: '#f4f4f5',
    bgElevated: '#ffffff',
    bgGlass: '#ffffff',
    border: '#e4e4e7',
    text: '#0a0a0a',
    textMuted: '#71717a',
    textInverse: '#fafafa',
    primary: '#0a0a0a',
    primaryFg: '#ffffff',
    accent: '#fbbf24',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#fb7185',
    hero: '#0a0a0a',
    heroFg: '#ffffff',
  },
  radii: { none: 0, sm: 8, md: 14, lg: 18, xl: 22, pill: 999 },
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.04)',
    md: '0 2px 8px rgba(0,0,0,0.06)',
    lg: '0 12px 32px -16px rgba(0,0,0,0.18)',
    glow: '0 0 0 0 transparent',
  },
  typography: {
    fontFamily: 'System',
    fontFamilyDisplay: 'System',
    weightRegular: 400,
    weightMedium: 500,
    weightBold: 700,
    letterSpacingTight: -0.6,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  animation: { fast: 120, base: 200, slow: 300, themeSwitch: 200 },
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(theme): add Bento Grid tokens"
```

---

### Task C4: Soft Clay theme tokens

**Files:**
- Create: `packages/theme/src/themes/clay.ts`

- [ ] **Step 1: Write `packages/theme/src/themes/clay.ts`**

```ts
import type { Theme } from '../tokens.js';

export const clay: Theme = {
  id: 'clay',
  name: 'Soft Clay',
  scheme: 'light',
  colors: {
    bg: '#fff7f0',
    bgElevated: '#ffffff',
    bgGlass: '#ffffff',
    border: '#fde0c2',
    text: '#5b3a1f',
    textMuted: '#a47148',
    textInverse: '#fff7f0',
    primary: '#ea580c',
    primaryFg: '#ffffff',
    accent: '#fbbf24',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#dc2626',
    hero: 'linear-gradient(145deg,#fed7aa,#fdba74)',
    heroFg: '#5b3a1f',
  },
  radii: { none: 0, sm: 10, md: 16, lg: 22, xl: 28, pill: 999 },
  shadows: {
    none: 'none',
    sm: '0 2px 6px rgba(180,83,9,0.06)',
    md: '6px 6px 16px rgba(180,83,9,0.1)',
    lg: '8px 8px 24px rgba(180,83,9,0.15)',
    glow: '0 0 0 0 transparent',
  },
  typography: {
    fontFamily: 'System',
    fontFamilyDisplay: 'System',
    weightRegular: 500,
    weightMedium: 600,
    weightBold: 800,
    letterSpacingTight: -0.5,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 32 },
  animation: { fast: 150, base: 250, slow: 350, themeSwitch: 200 },
};
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat(theme): add Soft Clay tokens"
```

---

### Task C5: Material You theme tokens

**Files:**
- Create: `packages/theme/src/themes/material.ts`

- [ ] **Step 1: Write `packages/theme/src/themes/material.ts`**

```ts
import type { Theme } from '../tokens.js';

export const material: Theme = {
  id: 'material',
  name: 'Material You',
  scheme: 'light',
  colors: {
    bg: '#f0e8ff',
    bgElevated: '#ffffff',
    bgGlass: '#ffffff',
    border: '#e0e0e0',
    text: '#1d1b20',
    textMuted: '#65558f',
    textInverse: '#ffffff',
    primary: '#65558f',
    primaryFg: '#ffffff',
    accent: '#7c4dff',
    success: '#1f5b1f',
    warning: '#7a5b00',
    danger: '#8b1538',
    hero: '#65558f',
    heroFg: '#ffffff',
  },
  radii: { none: 0, sm: 8, md: 16, lg: 24, xl: 28, pill: 999 },
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 12px rgba(101,85,143,0.18)',
    lg: '0 6px 16px rgba(101,85,143,0.35)',
    glow: '0 0 0 0 transparent',
  },
  typography: {
    fontFamily: 'Roboto',
    fontFamilyDisplay: 'Roboto',
    weightRegular: 400,
    weightMedium: 500,
    weightBold: 700,
    letterSpacingTight: -0.2,
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  animation: { fast: 120, base: 200, slow: 300, themeSwitch: 200 },
};
```

- [ ] **Step 2: Typecheck the theme package**

```bash
pnpm --filter @pantry/theme typecheck
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(theme): add Material You tokens"
```

---

## Phase D — API foundation

### Task D1: Scaffold `api/` Fastify project

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/src/server.ts`
- Create: `api/.env.example`
- Create: `api/.env.test.example`

- [ ] **Step 1: Create directories**

```bash
mkdir -p api/src/{plugins,routes,services,utils} api/tests/{helpers,unit,integration}
```

- [ ] **Step 2: Write `api/package.json`**

```json
{
  "name": "@pantry/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "echo skip",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:reset": "prisma migrate reset --force",
    "db:studio": "prisma studio",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@fastify/cookie": "^9.3.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/helmet": "^11.1.0",
    "@fastify/rate-limit": "^9.1.0",
    "@pantry/shared": "workspace:*",
    "@prisma/client": "^5.18.0",
    "@simplewebauthn/server": "^10.0.0",
    "argon2": "^0.40.0",
    "bullmq": "^5.10.0",
    "fastify": "^4.28.0",
    "ioredis": "^5.4.0",
    "jose": "^5.6.0",
    "nodemailer": "^6.9.0",
    "opossum": "^8.1.0",
    "otplib": "^12.0.1",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "qrcode": "^1.5.0",
    "undici": "^6.19.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/nodemailer": "^6.4.0",
    "@types/qrcode": "^1.5.0",
    "@types/supertest": "^6.0.0",
    "prisma": "^5.18.0",
    "supertest": "^7.0.0",
    "tsx": "^4.16.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 3: Write `api/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Write `api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*", "node_modules", "dist"]
}
```

- [ ] **Step 5: Write `api/.env.example`**

```bash
NODE_ENV=development
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=info

# Postgres
DATABASE_URL=postgresql://pantry:pantry@localhost:5432/pantry?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=change-me-32-bytes-minimum-aaaaaaa
JWT_ACCESS_TTL_SECONDS=900
JWT_ISSUER=pantry-api
JWT_AUDIENCE=pantry-app
REFRESH_TOKEN_TTL_DAYS=30
TOTP_ENCRYPTION_KEY=change-me-32-bytes-base64

# OAuth
GOOGLE_CLIENT_ID=
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=

# WebAuthn
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Pantry
WEBAUTHN_ORIGIN=http://localhost:8081

# SMTP (for verification + reset emails)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Pantry <no-reply@pantry.local>"

# Frontend URLs (used in email links)
APP_DEEP_LINK=pantry://
ADMIN_URL=http://localhost:4001

# Country detection
COUNTRY_DETECT_PRIMARY=https://ipapi.co
COUNTRY_DETECT_FALLBACK=http://ip-api.com
```

- [ ] **Step 6: Write `api/.env.test.example`**

```bash
NODE_ENV=test
PORT=4100
HOST=127.0.0.1
LOG_LEVEL=silent
DATABASE_URL=postgresql://pantry:pantry@localhost:5432/pantry_test?schema=public
REDIS_URL=redis://localhost:6379/15
JWT_ACCESS_SECRET=test-secret-32-bytes-aaaaaaaaaaa
JWT_ACCESS_TTL_SECONDS=900
JWT_ISSUER=pantry-api
JWT_AUDIENCE=pantry-app
REFRESH_TOKEN_TTL_DAYS=30
TOTP_ENCRYPTION_KEY=dGVzdC1rZXktMzItYnl0ZXMtZm9yLXRvdHAtYWVzZ2NtMTI=
GOOGLE_CLIENT_ID=test-google-client-id
APPLE_CLIENT_ID=test-apple-client-id
APPLE_TEAM_ID=TESTTEAM
APPLE_KEY_ID=TESTKEY
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=Pantry-Test
WEBAUTHN_ORIGIN=http://localhost
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=test@pantry.local
APP_DEEP_LINK=pantry://
ADMIN_URL=http://localhost:3000
COUNTRY_DETECT_PRIMARY=https://ipapi.co
COUNTRY_DETECT_FALLBACK=http://ip-api.com
```

- [ ] **Step 7: Write minimal `api/src/server.ts` (will grow)**

```ts
import Fastify from 'fastify';

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
}
```

- [ ] **Step 8: Install deps**

```bash
pnpm install
```

- [ ] **Step 9: Verify it boots**

```bash
cp api/.env.example api/.env
pnpm --filter @pantry/api exec tsx --eval "import('./src/server.ts').then(m => m.buildServer().then(a => a.inject({ method: 'GET', url: '/health' })).then(r => { console.log(r.statusCode, r.body); process.exit(0); }))"
```
Expected: prints `200 {"status":"ok"}`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(api): scaffold Fastify project"
```

---

### Task D2: Config loader with Zod validation

**Files:**
- Create: `api/src/config.ts`
- Create: `api/tests/unit/config.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/unit/config.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../../src/config.js';

describe('config', () => {
  const valid = {
    NODE_ENV: 'test',
    PORT: '4000',
    HOST: '127.0.0.1',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://u:p@h:5432/d',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_ISSUER: 'pantry',
    JWT_AUDIENCE: 'pantry-app',
    REFRESH_TOKEN_TTL_DAYS: '30',
    TOTP_ENCRYPTION_KEY: Buffer.from('a'.repeat(32)).toString('base64'),
    GOOGLE_CLIENT_ID: 'g',
    APPLE_CLIENT_ID: 'a',
    APPLE_TEAM_ID: 'T',
    APPLE_KEY_ID: 'K',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_RP_NAME: 'Pantry',
    WEBAUTHN_ORIGIN: 'http://localhost',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '1025',
    SMTP_FROM: 't@e.x',
    APP_DEEP_LINK: 'pantry://',
    ADMIN_URL: 'http://localhost:3000',
    COUNTRY_DETECT_PRIMARY: 'https://ipapi.co',
    COUNTRY_DETECT_FALLBACK: 'http://ip-api.com',
  };

  it('parses a valid env', () => {
    const cfg = parseConfig(valid);
    expect(cfg.port).toBe(4000);
    expect(cfg.jwt.accessSecret).toHaveLength(32);
    expect(cfg.totp.encryptionKey).toBeInstanceOf(Buffer);
    expect(cfg.totp.encryptionKey.length).toBe(32);
  });

  it('rejects a JWT secret shorter than 32 bytes', () => {
    expect(() => parseConfig({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow();
  });

  it('rejects a TOTP key that decodes to less than 32 bytes', () => {
    expect(() =>
      parseConfig({ ...valid, TOTP_ENCRYPTION_KEY: Buffer.from('short').toString('base64') }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/config.test.ts
```
Expected: FAIL — `parseConfig` does not exist.

- [ ] **Step 3: Write `api/src/config.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_ISSUER: z.string().default('pantry-api'),
  JWT_AUDIENCE: z.string().default('pantry-app'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  TOTP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes base64'),

  GOOGLE_CLIENT_ID: z.string().min(1),
  APPLE_CLIENT_ID: z.string().min(1),
  APPLE_TEAM_ID: z.string().min(1),
  APPLE_KEY_ID: z.string().min(1),

  WEBAUTHN_RP_ID: z.string().min(1),
  WEBAUTHN_RP_NAME: z.string().min(1),
  WEBAUTHN_ORIGIN: z.string().url(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1),

  APP_DEEP_LINK: z.string().min(1),
  ADMIN_URL: z.string().url(),

  COUNTRY_DETECT_PRIMARY: z.string().url(),
  COUNTRY_DETECT_FALLBACK: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export interface Config {
  env: 'development' | 'test' | 'production';
  port: number;
  host: string;
  logLevel: Env['LOG_LEVEL'];
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    accessTtlSeconds: number;
    issuer: string;
    audience: string;
    refreshTtlDays: number;
  };
  totp: { encryptionKey: Buffer };
  oauth: {
    googleClientId: string;
    appleClientId: string;
    appleTeamId: string;
    appleKeyId: string;
  };
  webauthn: { rpId: string; rpName: string; origin: string };
  smtp: { host: string; port: number; user?: string; pass?: string; from: string };
  frontend: { appDeepLink: string; adminUrl: string };
  countryDetect: { primary: string; fallback: string };
}

export function parseConfig(source: NodeJS.ProcessEnv | Record<string, unknown>): Config {
  const e = envSchema.parse(source);
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    host: e.HOST,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    jwt: {
      accessSecret: e.JWT_ACCESS_SECRET,
      accessTtlSeconds: e.JWT_ACCESS_TTL_SECONDS,
      issuer: e.JWT_ISSUER,
      audience: e.JWT_AUDIENCE,
      refreshTtlDays: e.REFRESH_TOKEN_TTL_DAYS,
    },
    totp: { encryptionKey: Buffer.from(e.TOTP_ENCRYPTION_KEY, 'base64') },
    oauth: {
      googleClientId: e.GOOGLE_CLIENT_ID,
      appleClientId: e.APPLE_CLIENT_ID,
      appleTeamId: e.APPLE_TEAM_ID,
      appleKeyId: e.APPLE_KEY_ID,
    },
    webauthn: { rpId: e.WEBAUTHN_RP_ID, rpName: e.WEBAUTHN_RP_NAME, origin: e.WEBAUTHN_ORIGIN },
    smtp: {
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      user: e.SMTP_USER,
      pass: e.SMTP_PASS,
      from: e.SMTP_FROM,
    },
    frontend: { appDeepLink: e.APP_DEEP_LINK, adminUrl: e.ADMIN_URL },
    countryDetect: { primary: e.COUNTRY_DETECT_PRIMARY, fallback: e.COUNTRY_DETECT_FALLBACK },
  };
}

let cached: Config | undefined;
export function getConfig(): Config {
  if (!cached) cached = parseConfig(process.env);
  return cached;
}

export function resetConfigForTests() {
  cached = undefined;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/config.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): zod-validated config loader"
```

---

### Task D3: Logger and DB/Redis singletons

**Files:**
- Create: `api/src/logger.ts`
- Create: `api/src/db.ts`
- Create: `api/src/redis.ts`

- [ ] **Step 1: Write `api/src/logger.ts`**

```ts
import pino from 'pino';
import { getConfig } from './config.js';

const cfg = (() => {
  try {
    return getConfig();
  } catch {
    return null;
  }
})();

export const logger = pino({
  level: cfg?.logLevel ?? process.env.LOG_LEVEL ?? 'info',
  transport:
    cfg?.env === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
  redact: {
    paths: ['password', 'passwordHash', 'refreshToken', 'accessToken', 'totpSecret', 'authorization'],
    remove: true,
  },
});
```

- [ ] **Step 2: Write `api/src/db.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    _prisma = new PrismaClient({ log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }] });
    _prisma.$on('warn' as never, (e: unknown) => logger.warn({ prisma: e }, 'prisma warn'));
    _prisma.$on('error' as never, (e: unknown) => logger.error({ prisma: e }, 'prisma error'));
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}
```

- [ ] **Step 3: Write `api/src/redis.ts`**

```ts
import { Redis } from 'ioredis';
import { getConfig } from './config.js';

let _redis: Redis | undefined;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(getConfig().redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  }
  return _redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = undefined;
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```
Note: Prisma client doesn't exist yet — typecheck will FAIL with `Cannot find module '@prisma/client'`. That's expected; Task D4 generates it. Skip ahead.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): logger and db/redis singletons"
```

---

### Task D4: Prisma schema (M0 tables only)

**Files:**
- Create: `api/prisma/schema.prisma`

- [ ] **Step 1: Write `api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  user
  admin
}

enum UserStatus {
  active
  suspended
  deleted
}

enum ThemePreference {
  aurora
  bento
  clay
  material
}

enum AuthCredentialType {
  password
  google
  apple
  passkey
}

model User {
  id              String          @id @default(uuid()) @db.Uuid
  email           String          @unique
  emailVerifiedAt DateTime?
  passwordHash    String?
  firstName       String
  lastName        String
  country         String?         @db.Char(2)
  avatarUrl       String?
  role            UserRole        @default(user)
  status          UserStatus      @default(active)
  themePreference ThemePreference @default(aurora)
  totpSecret      String?
  totpEnabledAt   DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  lastSeenAt      DateTime?

  credentials  AuthCredential[]
  sessions     Session[]
  pushTokens   PushToken[]
  emailTokens  EmailToken[]
  passwordResets PasswordReset[]
  totpChallenges TotpChallenge[]
  auditLogs    AdminAuditLog[]  @relation("AuditAdmin")

  @@map("users")
}

model AuthCredential {
  id              String             @id @default(uuid()) @db.Uuid
  userId          String             @db.Uuid
  type            AuthCredentialType
  providerUserId  String?
  publicKey       Bytes?
  counter         BigInt?            @default(0)
  metadata        Json?
  createdAt       DateTime           @default(now())
  lastUsedAt      DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([type, providerUserId])
  @@index([userId])
  @@map("auth_credentials")
}

model Session {
  id                String    @id @default(uuid()) @db.Uuid
  userId            String    @db.Uuid
  refreshTokenHash  String    @unique
  deviceInfo        Json?
  ip                String?
  expiresAt         DateTime
  revokedAt         DateTime?
  createdAt         DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

model PushToken {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @db.Uuid
  expoPushToken String    @unique
  platform      String
  deviceInfo    Json?
  createdAt     DateTime  @default(now())
  lastUsedAt    DateTime?
  revokedAt     DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("push_tokens")
}

/// Single-use email verification or login token.
model EmailToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  tokenHash String   @unique
  purpose   String   // 'verify_email'
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("email_tokens")
}

model PasswordReset {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_resets")
}

/// Short-lived intermediate token after password login when admin TOTP is required.
model TotpChallenge {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  tokenHash String   @unique
  expiresAt DateTime
  consumedAt DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("totp_challenges")
}

model AdminAuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  adminId    String   @db.Uuid
  action     String
  targetType String
  targetId   String
  diff       Json?
  requestId  String?
  ip         String?
  createdAt  DateTime @default(now())

  admin User @relation("AuditAdmin", fields: [adminId], references: [id])

  @@index([adminId])
  @@index([targetType, targetId])
  @@map("admin_audit_log")
}
```

- [ ] **Step 2: Generate the Prisma client**

```bash
pnpm --filter @pantry/api exec prisma generate
```
Expected: prints `✔ Generated Prisma Client`.

- [ ] **Step 3: Re-typecheck (now should pass)**

```bash
pnpm --filter @pantry/api typecheck
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): prisma schema for M0 auth tables"
```

---

### Task D5: Local Postgres + Redis for development

**Files:**
- (no files; system setup)

- [ ] **Step 1: Verify Postgres 16 is installed locally**

```bash
psql --version
```
If not installed (macOS): `brew install postgresql@16 && brew services start postgresql@16`. On Ubuntu: follow https://www.postgresql.org/download/linux/ubuntu/ for the 16 repo.

- [ ] **Step 2: Verify Redis 7**

```bash
redis-cli --version
```
If not: `brew install redis && brew services start redis` (macOS) or `sudo apt install redis-server` (Ubuntu).

- [ ] **Step 3: Create the `pantry` user and databases**

```bash
psql postgres -c "CREATE ROLE pantry WITH LOGIN PASSWORD 'pantry';"
psql postgres -c "CREATE DATABASE pantry OWNER pantry;"
psql postgres -c "CREATE DATABASE pantry_test OWNER pantry;"
psql postgres -c "ALTER USER pantry CREATEDB;"
```

- [ ] **Step 4: Verify connectivity**

```bash
psql postgresql://pantry:pantry@localhost:5432/pantry -c "SELECT 1;"
psql postgresql://pantry:pantry@localhost:5432/pantry_test -c "SELECT 1;"
redis-cli ping
```
Expected: `1`, `1`, `PONG`.

- [ ] **Step 5: No commit (system setup)**

---

### Task D6: First migration

**Files:**
- (Prisma generates `api/prisma/migrations/<ts>_init/migration.sql`)

- [ ] **Step 1: Apply the migration to dev**

```bash
pnpm --filter @pantry/api exec prisma migrate dev --name init
```
Expected: creates migration directory, applies it, prints `✔ Generated Prisma Client`.

- [ ] **Step 2: Verify tables exist**

```bash
psql postgresql://pantry:pantry@localhost:5432/pantry -c "\dt"
```
Expected: `users`, `auth_credentials`, `sessions`, `push_tokens`, `email_tokens`, `password_resets`, `totp_challenges`, `admin_audit_log`.

- [ ] **Step 3: Commit migration files**

```bash
git add -A
git commit -m "feat(api): initial migration for M0 auth tables"
```

---

### Task D7: Test harness

**Files:**
- Create: `api/vitest.config.ts`
- Create: `api/tests/helpers/setup.ts`
- Create: `api/tests/helpers/factories.ts`
- Create: `api/tests/integration/health.test.ts`

- [ ] **Step 1: Write `api/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    setupFiles: ['./tests/helpers/setup.ts'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15_000,
    env: { NODE_ENV: 'test' },
  },
});
```

- [ ] **Step 2: Write `api/tests/helpers/setup.ts`**

```ts
import { config as dotenv } from 'node:fs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { disconnectPrisma, getPrisma } from '../../src/db.js';
import { disconnectRedis, getRedis } from '../../src/redis.js';

// Load .env.test if present, falling back to .env.test.example
const envPath = existsSync(resolve('api/.env.test'))
  ? 'api/.env.test'
  : 'api/.env.test.example';
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) {
    let val = m[2]!.trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]!] = val;
  }
}

// Truncate all tables in dependency order before each test
const tables = [
  'admin_audit_log',
  'totp_challenges',
  'password_resets',
  'email_tokens',
  'push_tokens',
  'sessions',
  'auth_credentials',
  'users',
];

beforeAll(async () => {
  // Run pending migrations
  const { execSync } = await import('node:child_process');
  execSync('pnpm --filter @pantry/api exec prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env },
  });
});

beforeEach(async () => {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`);
  const redis = getRedis();
  await redis.flushdb();
});

afterAll(async () => {
  await disconnectPrisma();
  await disconnectRedis();
});
```

- [ ] **Step 3: Write `api/tests/helpers/factories.ts`**

```ts
import { randomUUID } from 'node:crypto';
import { getPrisma } from '../../src/db.js';

export async function makeUser(overrides: Partial<{
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  role: 'user' | 'admin';
}> = {}) {
  const prisma = getPrisma();
  return prisma.user.create({
    data: {
      email: overrides.email ?? `u-${randomUUID()}@test.local`,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
      emailVerifiedAt: overrides.emailVerified ? new Date() : null,
      role: overrides.role ?? 'user',
    },
  });
}
```

- [ ] **Step 4: Copy test env**

```bash
cp api/.env.test.example api/.env.test
```

- [ ] **Step 5: Write `api/tests/integration/health.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
```

- [ ] **Step 6: Run the test**

```bash
pnpm --filter @pantry/api test
```
Expected: 1 file, 1 test passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test(api): vitest harness with real Postgres and Redis"
```

---

### Task D8: Error handler + RFC 7807 mapper

**Files:**
- Create: `api/src/errors.ts`
- Create: `api/src/plugins/error-handler.ts`
- Create: `api/tests/unit/errors.test.ts`

- [ ] **Step 1: Write the failing test `api/tests/unit/errors.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { AppError, toProblem } from '../../src/errors.js';

describe('toProblem', () => {
  it('maps AppError', () => {
    const err = new AppError({ status: 404, code: 'not_found', title: 'Not found' });
    const p = toProblem(err);
    expect(p.status).toBe(404);
    expect(p.code).toBe('not_found');
    expect(p.title).toBe('Not found');
  });

  it('maps ZodError to 400 validation_error with field paths', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'nope' });
    if (result.success) throw new Error('expected failure');
    const p = toProblem(result.error);
    expect(p.status).toBe(400);
    expect(p.code).toBe('validation_error');
    expect(p.errors?.[0]?.path).toBe('email');
  });

  it('maps unknown error to 500', () => {
    const p = toProblem(new Error('boom'));
    expect(p.status).toBe(500);
    expect(p.code).toBe('internal_error');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/errors.test.ts
```

- [ ] **Step 3: Write `api/src/errors.ts`**

```ts
import { ZodError } from 'zod';
import type { Problem, ErrorCode } from '@pantry/shared';

export class AppError extends Error {
  status: number;
  code: ErrorCode | string;
  title: string;
  detail?: string | undefined;

  constructor(opts: { status: number; code: ErrorCode | string; title: string; detail?: string }) {
    super(opts.title);
    this.status = opts.status;
    this.code = opts.code;
    this.title = opts.title;
    this.detail = opts.detail;
  }
}

export function toProblem(err: unknown): Problem {
  if (err instanceof AppError) {
    return {
      title: err.title,
      status: err.status,
      code: err.code,
      ...(err.detail !== undefined ? { detail: err.detail } : {}),
    };
  }
  if (err instanceof ZodError) {
    return {
      title: 'Validation failed',
      status: 400,
      code: 'validation_error',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  return {
    title: 'Internal server error',
    status: 500,
    code: 'internal_error',
  };
}
```

- [ ] **Step 4: Run, verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/errors.test.ts
```
Expected: 3 passed.

- [ ] **Step 5: Write `api/src/plugins/error-handler.ts`**

```ts
import type { FastifyInstance, FastifyError } from 'fastify';
import { toProblem } from '../errors.js';

export async function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError, req, reply) => {
    const problem = toProblem(err);
    if (problem.status >= 500) {
      req.log.error({ err }, 'unhandled error');
    } else {
      req.log.warn({ err: { code: problem.code, status: problem.status } }, 'request error');
    }
    void reply.status(problem.status).type('application/problem+json').send(problem);
  });
  app.setNotFoundHandler((req, reply) => {
    void reply.status(404).type('application/problem+json').send({
      title: 'Not found',
      status: 404,
      code: 'not_found',
      instance: req.url,
    });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): RFC 7807 error handler and AppError"
```

---

### Task D9: Server wiring (cors, helmet, error handler, health, routes mount)

**Files:**
- Modify: `api/src/server.ts`
- Create: `api/src/plugins/cors.ts`
- Create: `api/src/plugins/rate-limit.ts`

- [ ] **Step 1: Write `api/src/plugins/cors.ts`**

```ts
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { getConfig } from '../config.js';

export async function registerCors(app: FastifyInstance) {
  const cfg = getConfig();
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow no-origin (mobile native fetch) and the admin URL only
      if (!origin) return cb(null, true);
      if (origin === cfg.frontend.adminUrl) return cb(null, true);
      if (origin.startsWith('exp://') || origin.startsWith('pantry://')) return cb(null, true);
      cb(new Error('CORS: origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Request-Id'],
  });
}
```

- [ ] **Step 2: Write `api/src/plugins/rate-limit.ts`**

```ts
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { getRedis } from '../redis.js';

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 60,
    timeWindow: '1 minute',
    redis: getRedis(),
    nameSpace: 'rl:global:',
    keyGenerator: (req) => `${req.ip}:${(req as any).user?.id ?? 'anon'}`,
    addHeadersOnExceeding: { 'x-ratelimit-limit': true, 'x-ratelimit-remaining': true },
  });
}
```

- [ ] **Step 3: Replace `api/src/server.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import { randomUUID } from 'node:crypto';
import { getConfig } from './config.js';
import { logger } from './logger.js';
import { registerCors } from './plugins/cors.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { healthRoutes } from './routes/health.js';

export async function buildServer(): Promise<FastifyInstance> {
  const cfg = getConfig();
  const app = Fastify({
    logger,
    genReqId: () => randomUUID(),
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    trustProxy: true,
    bodyLimit: 1_000_000, // 1 MB
  });

  await app.register(helmet, { global: true });
  await registerCors(app);
  if (cfg.env !== 'test') await registerRateLimit(app);
  await registerErrorHandler(app);

  app.addHook('onSend', async (req, reply) => {
    void reply.header('x-request-id', req.id);
  });

  await app.register(healthRoutes);

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = getConfig();
  const app = await buildServer();
  await app.listen({ port: cfg.port, host: cfg.host });
}
```

- [ ] **Step 4: Create `api/src/routes/health.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { getPrisma } from '../db.js';
import { getRedis } from '../redis.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_req, reply) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      await getRedis().ping();
      return { status: 'ready' };
    } catch (err) {
      void reply.status(503).type('application/problem+json').send({
        title: 'Not ready',
        status: 503,
        code: 'not_ready',
      });
    }
  });
}
```

- [ ] **Step 5: Add a readiness test `api/tests/integration/health.test.ts` (replace)**

```ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';

describe('health', () => {
  it('GET /health returns ok', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('GET /health/ready confirms DB and Redis', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ready' });
    await app.close();
  });
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @pantry/api test
```
Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): wire cors, helmet, rate-limit, error handler, health"
```

---

## Phase E — Auth services (pure logic, unit-tested)

### Task E1: Crypto utilities (random + AES-GCM)

**Files:**
- Create: `api/src/utils/random.ts`
- Create: `api/src/utils/encryption.ts`
- Create: `api/tests/unit/encryption.test.ts`

- [ ] **Step 1: Write `api/src/utils/random.ts`**

```ts
import { randomBytes, createHash } from 'node:crypto';

/** URL-safe base64 token of N random bytes. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Stable sha256 hex of a token, for storage and lookup. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 2: Write the failing test `api/tests/unit/encryption.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { encrypt, decrypt } from '../../src/utils/encryption.js';

describe('encryption', () => {
  const key = Buffer.from('a'.repeat(32));

  it('round-trips a value', () => {
    const cipher = encrypt('hello world', key);
    expect(cipher).not.toContain('hello');
    expect(decrypt(cipher, key)).toBe('hello world');
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    expect(encrypt('x', key)).not.toBe(encrypt('x', key));
  });

  it('rejects tampered ciphertext', () => {
    const cipher = encrypt('hello', key);
    const parts = cipher.split('.');
    parts[2] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/encryption.test.ts
```

- [ ] **Step 4: Write `api/src/utils/encryption.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM. Output is "<iv>.<authTag>.<ciphertext>" all base64url.
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('key must be 32 bytes');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.');
}

export function decrypt(payload: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('key must be 32 bytes');
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('malformed payload');
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}
```

- [ ] **Step 5: Run, verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/encryption.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): random tokens and AES-GCM encryption"
```

---

### Task E2: Password hashing service

**Files:**
- Create: `api/src/services/auth/passwords.ts`
- Create: `api/tests/unit/passwords.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/passwords.test.ts
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/services/auth/passwords.js';

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('S3cret-passw0rd!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('S3cret-passw0rd!', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('wrong horse battery staple', hash)).toBe(false);
  });

  it('returns false on a malformed hash without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-real-hash')).toBe(false);
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/passwords.test.ts
```

- [ ] **Step 3: Write `api/src/services/auth/passwords.ts`**

```ts
import argon2 from 'argon2';

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19_456, // 19 MB
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/passwords.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): argon2id password hashing service"
```

---

### Task E3: Tokens service (JWT access + opaque refresh)

**Files:**
- Create: `api/src/services/auth/tokens.ts`
- Create: `api/tests/unit/tokens.test.ts`

`issueAccessToken(payload, opts?)` takes an `AccessTokenPayload` (`{ sub, role }`) and an optional `{ expiresIn }` override (seconds). It returns `{ token, expiresIn }`; when `opts.expiresIn` is omitted it falls back to `cfg.jwt.accessTtlSeconds`. M3 uses the override (`{ expiresIn: 15 * 60 }`) for the admin impersonate route; all other call sites in M0/M1/M2 pass no options and inherit the configured TTL.

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/tokens.test.ts
import { describe, expect, it, beforeAll } from 'vitest';
import { decodeJwt } from 'jose';
import { issueAccessToken, verifyAccessToken, issueRefreshToken } from '../../src/services/auth/tokens.js';
import { getConfig, resetConfigForTests } from '../../src/config.js';

beforeAll(() => resetConfigForTests());

describe('tokens', () => {
  it('issues and verifies an access token', async () => {
    const { token, expiresIn } = await issueAccessToken({ sub: 'user-1', role: 'user' });
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe('user');
    expect(expiresIn).toBe(getConfig().jwt.accessTtlSeconds);
  });

  it('rejects a tampered access token', async () => {
    const { token } = await issueAccessToken({ sub: 'user-1', role: 'user' });
    const tampered = token.slice(0, -2) + 'XX';
    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it('honors an explicit expiresIn override', async () => {
    const { token, expiresIn } = await issueAccessToken(
      { sub: 'user-1', role: 'admin' },
      { expiresIn: 60 },
    );
    expect(expiresIn).toBe(60);
    const decoded = decodeJwt(token);
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(60);
  });

  it('issueRefreshToken returns { token, hash, expiresAt }', () => {
    const r = issueRefreshToken();
    expect(r.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(r.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/tokens.test.ts
```

- [ ] **Step 3: Write `api/src/services/auth/tokens.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';
import { getConfig } from '../../config.js';
import { hashToken, randomToken } from '../../utils/random.js';

export interface AccessTokenPayload {
  sub: string;
  role: 'user' | 'admin';
}

/** Backward-compatible alias retained for any callers that still import AccessClaims. */
export type AccessClaims = AccessTokenPayload;

export interface IssueAccessTokenOptions {
  /** Override the default TTL (seconds). Defaults to `cfg.jwt.accessTtlSeconds`. */
  expiresIn?: number;
}

export interface IssuedAccessToken {
  token: string;
  expiresIn: number;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getConfig().jwt.accessSecret);
}

/**
 * Issue a signed JWT access token.
 *
 * When `opts.expiresIn` is supplied, it is used as the token TTL in seconds;
 * otherwise the default `cfg.jwt.accessTtlSeconds` is used. The returned
 * `expiresIn` always reflects the TTL actually applied to the token, so
 * callers can forward it to clients without re-deriving it from config.
 */
export async function issueAccessToken(
  payload: AccessTokenPayload,
  opts?: IssueAccessTokenOptions,
): Promise<IssuedAccessToken> {
  const cfg = getConfig();
  const expiresIn = opts?.expiresIn ?? cfg.jwt.accessTtlSeconds;
  const token = await new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuer(cfg.jwt.issuer)
    .setAudience(cfg.jwt.audience)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secretKey());
  return { token, expiresIn };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const cfg = getConfig();
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: cfg.jwt.issuer,
    audience: cfg.jwt.audience,
  });
  if (typeof payload.sub !== 'string') throw new Error('missing sub');
  const role = payload.role;
  if (role !== 'user' && role !== 'admin') throw new Error('invalid role');
  return { sub: payload.sub, role };
}

export interface RefreshTokenIssue {
  token: string;
  hash: string;
  expiresAt: Date;
}

export function issueRefreshToken(): RefreshTokenIssue {
  const cfg = getConfig();
  const token = randomToken(32);
  const hash = hashToken(token);
  const expiresAt = new Date(Date.now() + cfg.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
  return { token, hash, expiresAt };
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/tokens.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): JWT access + opaque refresh token issuance"
```

---

### Task E4: Sessions service

**Files:**
- Create: `api/src/services/auth/sessions.ts`
- Create: `api/tests/integration/sessions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/sessions.test.ts
import { describe, expect, it } from 'vitest';
import { createSession, rotateSession, revokeSession, findActiveSessionByToken } from '../../src/services/auth/sessions.js';
import { makeUser } from '../helpers/factories.js';

describe('sessions', () => {
  it('creates a session and finds it by token', async () => {
    const user = await makeUser();
    const { refreshToken, session } = await createSession(user.id, { ip: '1.2.3.4' });
    expect(session.userId).toBe(user.id);
    const found = await findActiveSessionByToken(refreshToken);
    expect(found?.id).toBe(session.id);
  });

  it('rotates a session: returns new token, marks old hash unusable', async () => {
    const user = await makeUser();
    const { refreshToken } = await createSession(user.id);
    const next = await rotateSession(refreshToken);
    expect(next.refreshToken).not.toBe(refreshToken);
    expect(await findActiveSessionByToken(refreshToken)).toBeNull();
    expect((await findActiveSessionByToken(next.refreshToken))?.id).toBe(next.session.id);
  });

  it('revoke makes the token no longer findable', async () => {
    const user = await makeUser();
    const { refreshToken, session } = await createSession(user.id);
    await revokeSession(session.id);
    expect(await findActiveSessionByToken(refreshToken)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/sessions.test.ts
```

- [ ] **Step 3: Write `api/src/services/auth/sessions.ts`**

```ts
import type { Session } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';
import { issueRefreshToken } from './tokens.js';

export interface SessionContext {
  ip?: string;
  deviceInfo?: Record<string, unknown>;
}

export async function createSession(
  userId: string,
  ctx: SessionContext = {},
): Promise<{ session: Session; refreshToken: string }> {
  const prisma = getPrisma();
  const issued = issueRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      refreshTokenHash: issued.hash,
      expiresAt: issued.expiresAt,
      ip: ctx.ip ?? null,
      deviceInfo: ctx.deviceInfo ?? null,
    },
  });
  return { session, refreshToken: issued.token };
}

export async function findActiveSessionByToken(token: string): Promise<Session | null> {
  const prisma = getPrisma();
  const hash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { refreshTokenHash: hash } });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

export async function rotateSession(
  oldToken: string,
): Promise<{ session: Session; refreshToken: string }> {
  const prisma = getPrisma();
  const current = await findActiveSessionByToken(oldToken);
  if (!current) throw new Error('session not found');
  const issued = issueRefreshToken();
  const [, session] = await prisma.$transaction([
    prisma.session.update({
      where: { id: current.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: current.userId,
        refreshTokenHash: issued.hash,
        expiresAt: issued.expiresAt,
        ip: current.ip,
        deviceInfo: current.deviceInfo ?? undefined,
      },
    }),
  ]);
  return { session, refreshToken: issued.token };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/integration/sessions.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): sessions service with rotate and revoke"
```

---

### Task E5: Email service (verification + reset)

**Files:**
- Create: `api/src/services/auth/email.ts`

- [ ] **Step 1: Write `api/src/services/auth/email.ts`**

```ts
import { createTransport, type Transporter } from 'nodemailer';
import { getConfig } from '../../config.js';
import { logger } from '../../logger.js';

let _transport: Transporter | null = null;

function getTransport(): Transporter {
  if (_transport) return _transport;
  const cfg = getConfig();
  _transport = createTransport({
    host: cfg.smtp.host,
    port: cfg.smtp.port,
    secure: cfg.smtp.port === 465,
    auth: cfg.smtp.user ? { user: cfg.smtp.user, pass: cfg.smtp.pass } : undefined,
  });
  return _transport;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const cfg = getConfig();
  const link = `${cfg.frontend.adminUrl.replace('admin.', 'app.')}/verify-email?token=${encodeURIComponent(token)}`;
  const fallbackDeepLink = `${cfg.frontend.appDeepLink}verify-email?token=${encodeURIComponent(token)}`;
  if (cfg.env === 'test') {
    logger.info({ to, link }, 'TEST: would send verification email');
    return;
  }
  await getTransport().sendMail({
    from: cfg.smtp.from,
    to,
    subject: 'Verify your Pantry email',
    text: `Verify your email by opening this link: ${link}\n\nOr in the app: ${fallbackDeepLink}`,
    html: `<p>Verify your email by clicking <a href="${link}">this link</a>.</p><p>Or open in the app: <a href="${fallbackDeepLink}">${fallbackDeepLink}</a></p>`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const cfg = getConfig();
  const link = `${cfg.frontend.appDeepLink}reset-password?token=${encodeURIComponent(token)}`;
  if (cfg.env === 'test') {
    logger.info({ to, link }, 'TEST: would send password reset email');
    return;
  }
  await getTransport().sendMail({
    from: cfg.smtp.from,
    to,
    subject: 'Reset your Pantry password',
    text: `Reset your password: ${link}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Reset your password: <a href="${link}">${link}</a></p>`,
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): SMTP email service for verification and reset"
```

---

### Task E6: Country detection service

**Files:**
- Create: `api/src/services/country/detect.ts`
- Create: `api/tests/unit/country-detect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/unit/country-detect.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { detectCountryFromIp } from '../../src/services/country/detect.js';

describe('detectCountryFromIp', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns ISO-2 from primary on success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ country_code: 'GB' }),
    });
    const cc = await detectCountryFromIp('1.2.3.4', { fetch: fetchMock as never });
    expect(cc).toBe('GB');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to secondary on primary failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ countryCode: 'US' }) });
    const cc = await detectCountryFromIp('1.2.3.4', { fetch: fetchMock as never });
    expect(cc).toBe('US');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null on both failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
    const cc = await detectCountryFromIp('1.2.3.4', { fetch: fetchMock as never });
    expect(cc).toBeNull();
  });

  it('returns null for invalid/private IPs', async () => {
    const fetchMock = vi.fn();
    expect(await detectCountryFromIp('127.0.0.1', { fetch: fetchMock as never })).toBeNull();
    expect(await detectCountryFromIp('10.0.0.1', { fetch: fetchMock as never })).toBeNull();
    expect(await detectCountryFromIp('::1', { fetch: fetchMock as never })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/services/country/detect.ts`**

```ts
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { logger } from '../../logger.js';

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivate(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip));
}

interface Deps {
  fetch?: typeof fetch;
}

export async function detectCountryFromIp(ip: string, deps: Deps = {}): Promise<string | null> {
  const f = deps.fetch ?? globalThis.fetch;
  if (!ip || isPrivate(ip)) return null;

  // Cache (skipped if Redis is not available, e.g., in unit tests with injected fetch)
  let redis;
  try { redis = getRedis(); } catch { redis = null; }
  const cacheKey = `country:${ip}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached === '__null__' ? null : cached;
  }

  const cfg = getConfig();

  // Primary: ipapi.co (returns country_code)
  try {
    const res = await f(`${cfg.countryDetect.primary}/${encodeURIComponent(ip)}/json/`);
    if (res.ok) {
      const data = (await res.json()) as { country_code?: string };
      if (data.country_code && /^[A-Z]{2}$/.test(data.country_code)) {
        if (redis) await redis.set(cacheKey, data.country_code, 'EX', 86_400);
        return data.country_code;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'country detect primary failed');
  }

  // Fallback: ip-api.com (returns countryCode)
  try {
    const res = await f(`${cfg.countryDetect.fallback}/json/${encodeURIComponent(ip)}?fields=countryCode`);
    if (res.ok) {
      const data = (await res.json()) as { countryCode?: string };
      if (data.countryCode && /^[A-Z]{2}$/.test(data.countryCode)) {
        if (redis) await redis.set(cacheKey, data.countryCode, 'EX', 86_400);
        return data.countryCode;
      }
    }
  } catch (err) {
    logger.warn({ err }, 'country detect fallback failed');
  }

  if (redis) await redis.set(cacheKey, '__null__', 'EX', 3600);
  return null;
}
```

- [ ] **Step 4: Verify pass**

```bash
pnpm --filter @pantry/api exec vitest run tests/unit/country-detect.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): country detection with primary + fallback"
```

---

### Task E7: Users repository helpers

**Files:**
- Create: `api/src/services/users/repository.ts`

- [ ] **Step 1: Write `api/src/services/users/repository.ts`**

```ts
import type { User } from '@prisma/client';
import type { User as ApiUser } from '@pantry/shared';
import { getPrisma } from '../../db.js';

export function toApiUser(u: User): ApiUser {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.emailVerifiedAt !== null,
    firstName: u.firstName,
    lastName: u.lastName,
    country: u.country,
    avatarUrl: u.avatarUrl,
    role: u.role,
    status: u.status,
    themePreference: u.themePreference,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export async function findUserByEmail(email: string) {
  return getPrisma().user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function findUserById(id: string) {
  return getPrisma().user.findUnique({ where: { id } });
}

export async function touchLastSeen(id: string): Promise<void> {
  await getPrisma().user.update({ where: { id }, data: { lastSeenAt: new Date() } });
}
```

- [ ] **Step 2: Typecheck**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(api): users repository helpers"
```

---

### Task E8: Auth Fastify decorator

**Files:**
- Create: `api/src/plugins/auth.ts`

- [ ] **Step 1: Write `api/src/plugins/auth.ts`**

```ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '../errors.js';
import { ERROR_CODES } from '@pantry/shared';
import { verifyAccessToken } from '../services/auth/tokens.js';
import { findUserById } from '../services/users/repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; role: 'user' | 'admin' };
  }
  interface FastifyInstance {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function attachUser(req: FastifyRequest): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return;
  const token = auth.slice('Bearer '.length);
  try {
    const claims = await verifyAccessToken(token);
    req.user = { id: claims.sub, role: claims.role };
  } catch {
    // ignore — handler decides whether auth was required
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', attachUser);

  app.decorate('requireAuth', async (req: FastifyRequest) => {
    if (!req.user) throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    const user = await findUserById(req.user.id);
    if (!user || user.status !== 'active') {
      throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    }
  });

  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    await app.requireAuth(req, undefined as never);
    if (req.user?.role !== 'admin') {
      throw new AppError({ status: 403, code: ERROR_CODES.FORBIDDEN, title: 'Forbidden' });
    }
  });
});
```

- [ ] **Step 2: Register the plugin in `api/src/server.ts`**

Find:
```ts
await registerErrorHandler(app);
```
Add immediately after:
```ts
await app.register(authPlugin);
```
And at the top:
```ts
import { authPlugin } from './plugins/auth.js';
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @pantry/api typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(api): auth decorator (requireAuth, requireAdmin)"
```

---


## Phase Z — Final verification

### Task Z1: Run the full test suite

- [ ] **Step 1: Generate Prisma client (just in case)**

```bash
pnpm --filter @pantry/api exec prisma generate
```

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @pantry/api test
```
Expected: every test in `tests/unit/` and `tests/integration/` passes. As of M0a:

- `unit/config.test.ts` — 3 tests
- `unit/encryption.test.ts` — 3 tests
- `unit/passwords.test.ts` — 3 tests
- `unit/tokens.test.ts` — 3 tests
- `unit/errors.test.ts` — 3 tests
- `unit/country-detect.test.ts` — 4 tests
- `integration/health.test.ts` — 2 tests
- `integration/sessions.test.ts` — 3 tests

- [ ] **Step 3: Typecheck the whole repo**

```bash
pnpm typecheck
```
Expected: every workspace package exits 0.

- [ ] **Step 4: Verify the API boots and `/health/ready` returns 200**

In one terminal:
```bash
pnpm --filter @pantry/api dev
```
In another:
```bash
curl -i http://localhost:4000/health/ready
```
Expected: HTTP 200 with body `{"status":"ready"}`. Stop the dev server with Ctrl-C.

- [ ] **Step 5: Run prettier on the whole repo**

```bash
pnpm exec prettier --check .
```
Expected: exit 0. If not, run `pnpm exec prettier --write .` and re-check.

- [ ] **Step 6: Confirm git history is clean**

```bash
git status
git log --oneline -30
```
Expected: working tree clean. Commits follow the conventional format and look chronologically sensible.

- [ ] **Step 7: Tag the milestone**

```bash
git tag m0a-complete
```

---

## Self-review checklist (run before declaring M0a done)

- [ ] All 8 test files above pass.
- [ ] `pnpm typecheck` passes for every workspace package.
- [ ] `prisma migrate status` reports up-to-date.
- [ ] `psql ... -c '\dt'` lists all M0 tables: `users`, `auth_credentials`, `sessions`, `push_tokens`, `email_tokens`, `password_resets`, `totp_challenges`, `admin_audit_log`.
- [ ] `.env.test.example` and `.env.example` are committed; no real secrets are committed.
- [ ] No `console.log` calls anywhere in `api/src/**` (use `logger`).
- [ ] All four theme files implement the `Theme` contract from `packages/theme/src/tokens.ts`.

---

## Handoff to M0b

M0b will:

1. Add Phase F: HTTP routes for register, login, refresh, logout, me, verify-email, resend-verification, forgot-password, reset-password.
2. Add Phase G: OAuth (Google + Apple) with `id_token` verification services and routes.
3. Add Phase H: passkey (WebAuthn) services and routes (register options/verify, login options/verify) using `@simplewebauthn/server`.
4. Add Phase I: TOTP enrollment and challenge-verify routes (admin-only) using `otplib` and the AES-GCM utility from this plan.

Every M0b route gets a Vitest integration test using the harness built in M0a (Task D7). When M0b is complete, the API exposes the full auth surface from spec section 6.1.

