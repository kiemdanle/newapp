# M0b — API Auth Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every HTTP auth route from spec section 6.1, plus `PATCH /v1/me` from 6.6. By the end of M0b, the API supports email/password sign-up + sign-in (with email verification + forgot-password), token refresh, sign-out, the `me` endpoint, Google + Apple OAuth, passkeys (WebAuthn), and TOTP enrollment + challenge-verify for admins.

**Architecture:** All routes are Fastify handlers under `/v1/auth/*` and `/v1/me`. Each route validates input with the Zod schemas from `@expyrico/shared` (built in M0a) and uses the service layer (passwords, tokens, sessions, email, country-detect, users repository) also built in M0a. Every route gets a failing Vitest integration test against the real Postgres test database before implementation.

**Tech Stack:** Fastify 4, Prisma 5, jose, argon2, `@simplewebauthn/server`, `otplib`, `qrcode`, `undici` (for Google JWKS fetch), Zod 3.

**Spec reference:** `docs/superpowers/specs/2026-05-23-expyrico-app-design.md` sections 2.1, 6.1, 6.6, 6.8.

**Prerequisite:** M0a complete (`git tag m0a-complete` exists). This plan picks up from there.

**Out of scope for M0b:** the mobile and admin clients (M0c, M0d). The admin endpoints from 6.7 (separate milestone, M3).

---

## Execution order — backend-first (2026-05-26)

The project is re-sequenced to build **backend + admin first (Track A)**, then **mobile (Track B)**. This file is **Track A, step 2 (auth routes — entire plan).** Track A order: M0a → M0b → M0d → M1 (backend phases) → M2 (backend phases) → M3 → M5–M8 (backend + admin phases). All backend/admin (Track A) plans are built and deployed before ANY mobile (Track B) work begins.

---

## Validation amendments — 2026-05-26

A review pass tightened this plan in five places; the route code and tests below already
reflect them:

1. **Access token is a plain string.** `issueAccessToken({...})` (from M0a) returns the
   JWT as a `string`. Every route assembles `tokens = { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds }` — no `.token` unwrapping and no hardcoded `expiresIn: 900`. The `authResultSchema` token shape stays `{ accessToken, refreshToken, expiresIn }` (camelCase).
2. **Email verification gate on login (§2.1).** After the password check, login rejects
   an unverified email (`emailVerifiedAt == null`) with 403 `email_not_verified`. A failing
   test is added first (TDD).
3. **Admins always require TOTP (§8.2).** A freshly-promoted admin with no TOTP gets
   `{ requiresTotpEnrollment: true, enrollmentChallenge }` and **no** session at the
   password step. The enrollment challenge (single-use, stored in `totp_challenges` with
   purpose `enroll`) authorizes the enroll + verify-enrollment routes; a full session is
   only granted after a later TOTP (or recovery-code) challenge succeeds.
4. **Persisted, redeemable recovery codes.** Recovery codes generated at enrollment are
   stored hashed in `totp_recovery_codes` (M0a) and consumed one-time via a new
   `POST /v1/auth/totp/recovery-verify` route.
5. **Enforced auth rate limits (§6.8).** The `/v1/auth/*` scope carries a tighter per-IP
   budget (config: `RATE_LIMIT_AUTH_PER_IP_PER_MIN`) layered on the global limiter. The
   limiter stays enabled in tests (numbers tuned via `.env.test`), and `rate-limit.test.ts`
   asserts the auth limiter trips with a 429.

---

## File map

This plan adds these files to `api/`:

```
api/
├── src/
│   ├── routes/auth/
│   │   ├── index.ts                     ← updated to mount every route below
│   │   ├── register.ts
│   │   ├── login.ts
│   │   ├── refresh.ts
│   │   ├── logout.ts
│   │   ├── me.ts
│   │   ├── verify-email.ts
│   │   ├── resend-verification.ts
│   │   ├── forgot-password.ts
│   │   ├── reset-password.ts
│   │   ├── oauth-google.ts
│   │   ├── oauth-apple.ts
│   │   ├── passkey-register.ts
│   │   ├── passkey-login.ts
│   │   └── totp.ts
│   ├── routes/me/
│   │   ├── index.ts
│   │   └── profile.ts                   ← PATCH /v1/me
│   └── services/auth/
│       ├── google.ts                    ← verify Google id_token via JWKS
│       ├── apple.ts                     ← verify Apple identity_token
│       ├── passkey.ts                   ← @simplewebauthn/server wrappers
│       └── totp.ts                      ← otplib + AES-GCM secret storage
└── tests/integration/
    ├── register.test.ts
    ├── login.test.ts
    ├── refresh.test.ts
    ├── logout.test.ts
    ├── me.test.ts
    ├── verify-email.test.ts
    ├── forgot-reset.test.ts
    ├── rate-limit.test.ts
    ├── oauth-google.test.ts
    ├── oauth-apple.test.ts
    ├── passkey.test.ts
    └── totp.test.ts
```

---

## Conventions (carried over from M0a)

- TDD: write the failing integration test, watch it fail, implement, watch it pass, commit.
- Conventional commits, scope `api`.
- Every route imports its Zod schema from `@expyrico/shared`.
- Every route handler uses `req.user`, `req.ip`, and `app.requireAuth` / `app.requireAdmin` from the M0a auth plugin.
- No `console.log`. Use `req.log`.

---
## Phase F — Auth routes (TDD)

Each route gets a failing integration test first.

### Task F1: POST /v1/auth/register

**Files:**
- Create: `api/src/routes/auth/index.ts`
- Create: `api/src/routes/auth/register.ts`
- Create: `api/tests/integration/register.test.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/register.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('POST /v1/auth/register', () => {
  it('creates a user, returns auth result, sends verification email', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'NewUser@Example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
      headers: { 'x-forwarded-for': '8.8.8.8' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe('newuser@example.com');
    expect(body.user.emailVerified).toBe(false);
    expect(body.tokens.accessToken).toBeTruthy();
    expect(body.tokens.refreshToken).toBeTruthy();

    const stored = await getPrisma().user.findUnique({ where: { email: 'newuser@example.com' } });
    expect(stored?.passwordHash).toMatch(/^\$argon2id/);
    const tokens = await getPrisma().emailToken.findMany({ where: { userId: stored!.id } });
    expect(tokens).toHaveLength(1);
    await app.close();
  });

  it('rejects a duplicate email with 409', async () => {
    const app = await buildServer();
    const payload = {
      email: 'dupe@example.com',
      password: 'correct-horse-battery-staple',
      firstName: 'A',
      lastName: 'B',
    };
    await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
    const res = await app.inject({ method: 'POST', url: '/v1/auth/register', payload });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('email_already_registered');
    await app.close();
  });

  it('rejects bad input with 400', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'nope', password: 'short', firstName: '', lastName: '' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('validation_error');
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/register.test.ts
```

- [ ] **Step 3: Write `api/src/routes/auth/register.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import {
  registerSchema,
  authResultSchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { hashPassword } from '../../services/auth/passwords.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { sendVerificationEmail } from '../../services/auth/email.js';
import { detectCountryFromIp } from '../../services/country/detect.js';
import { toApiUser } from '../../services/users/repository.js';
import { hashToken, randomToken } from '../../utils/random.js';

export async function registerRoute(app: FastifyInstance) {
  app.post('/register', async (req, reply) => {
    const input = registerSchema.parse(req.body);
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError({
        status: 409,
        code: ERROR_CODES.EMAIL_ALREADY_REGISTERED,
        title: 'Email already registered',
      });
    }

    const passwordHash = await hashPassword(input.password);
    const country = await detectCountryFromIp(req.ip).catch(() => null);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          country,
        },
      });
      await tx.authCredential.create({
        data: { userId: u.id, type: 'password' },
      });
      return u;
    });

    // Email verification token
    const verifyToken = randomToken(32);
    await prisma.emailToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(verifyToken),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await sendVerificationEmail(user.email, verifyToken);

    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });

    return reply.status(201).send(
      authResultSchema.parse({
        user: toApiUser(user),
        tokens: { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
      }),
    );
  });
}
```

- [ ] **Step 4: Write `api/src/routes/auth/index.ts`**

The auth plugin registers its own encapsulated rate limiter so the tighter per-IP
budget for `/v1/auth/*` (from config: `authPerIpPerMin`) applies on top of the global
limiter. It is gated on `cfg.rateLimit.enabled` so it stays on in every environment
(tests tune the number rather than disabling it).

```ts
import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { registerRoute } from './register.js';

export async function authRoutes(app: FastifyInstance) {
  const cfg = getConfig();
  if (cfg.rateLimit.enabled) {
    // Encapsulated to this plugin scope → only affects /v1/auth/* routes.
    await app.register(rateLimit, {
      max: cfg.rateLimit.authPerIpPerMin,
      timeWindow: '1 minute',
      redis: getRedis(),
      nameSpace: 'rl:auth:',
      keyGenerator: (req) => `ip:${req.ip}`,
    });
  }
  await app.register(registerRoute);
}
```

- [ ] **Step 5: Mount auth routes in `api/src/server.ts`**

Find `await app.register(healthRoutes);` and add right after:
```ts
await app.register(authRoutes, { prefix: '/v1/auth' });
```
And at the top:
```ts
import { authRoutes } from './routes/auth/index.js';
```

- [ ] **Step 6: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/register.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): POST /v1/auth/register"
```

---

### Task F2: POST /v1/auth/login

**Files:**
- Create: `api/src/routes/auth/login.ts`
- Create: `api/tests/integration/login.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/login.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

/**
 * Register, then mark the email verified — sign-in now requires a verified email,
 * so the standard "happy path" fixture has to clear that gate first.
 */
async function registerVerified(
  app: Awaited<ReturnType<typeof buildServer>>,
  email: string,
  password = 'correct-horse-battery-staple',
) {
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { email, password, firstName: 'A', lastName: 'B' },
  });
  await getPrisma().user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
}

describe('POST /v1/auth/login', () => {
  it('returns tokens for correct password (verified user)', async () => {
    const app = await buildServer();
    await registerVerified(app, 'login@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'login@example.com', password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tokens.accessToken).toBeTruthy();
    await app.close();
  });

  it('rejects sign-in for an unverified email with 403 email_not_verified', async () => {
    const app = await buildServer();
    // Register only — do NOT verify. The user exists with the right password but
    // has never confirmed their email, so sign-in must be refused.
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'unverified@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'unverified@example.com', password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('email_not_verified');
    await app.close();
  });

  it('rejects wrong password with 401 invalid_credentials', async () => {
    const app = await buildServer();
    await registerVerified(app, 'login2@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'login2@example.com', password: 'wrong-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_credentials');
    await app.close();
  });

  it('rejects unknown email with 401 invalid_credentials (no leak)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'nobody@example.com', password: 'correct-horse-battery-staple' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_credentials');
    await app.close();
  });

  it('returns a TOTP challenge for an admin who already enabled TOTP', async () => {
    const app = await buildServer();
    const { hashPassword } = await import('../../src/services/auth/passwords.js');
    const hash = await hashPassword('admin-password-1234');
    const admin = await getPrisma().user.create({
      data: {
        email: 'admin@example.com',
        passwordHash: hash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        emailVerifiedAt: new Date(),
        totpSecret: 'enc.cipher.payload',
        totpEnabledAt: new Date(),
      },
    });
    await getPrisma().authCredential.create({ data: { userId: admin.id, type: 'password' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.requiresTotp).toBe(true);
    expect(body.challengeToken).toBeTruthy();
    // No full session is issued at the password step.
    expect(body.tokens).toBeUndefined();
    await app.close();
  });

  it('forces TOTP enrollment for an admin who has not set up TOTP yet (no full session)', async () => {
    const app = await buildServer();
    const { hashPassword } = await import('../../src/services/auth/passwords.js');
    const hash = await hashPassword('admin-password-1234');
    // Freshly-promoted admin: verified email, password set, but totpEnabledAt is null.
    const admin = await getPrisma().user.create({
      data: {
        email: 'newadmin@example.com',
        passwordHash: hash,
        firstName: 'New',
        lastName: 'Admin',
        role: 'admin',
        emailVerifiedAt: new Date(),
      },
    });
    await getPrisma().authCredential.create({ data: { userId: admin.id, type: 'password' } });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'newadmin@example.com', password: 'admin-password-1234' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.requiresTotpEnrollment).toBe(true);
    expect(body.enrollmentChallenge).toBeTruthy();
    // Critically: no tokens / full session granted before TOTP is set up.
    expect(body.tokens).toBeUndefined();
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/login.ts`**

**Sign-in gates (spec §2.1 and §8.2):** after the password check, login enforces two
rules before any full session is issued:

- **Email must be verified.** If `user.emailVerifiedAt == null`, throw `AppError` 403
  with code `email_not_verified`. (OAuth sign-in sets `emailVerifiedAt` at account
  creation, so this only affects password accounts that never confirmed their email.)
- **Admins always use TOTP.** If `user.role === 'admin'`:
  - If TOTP is already enabled (`totpEnabledAt != null`), return a TOTP *challenge*
    (`{ requiresTotp: true, challengeToken }`) — the existing challenge-verify flow.
  - If TOTP is **not** enabled yet (`totpEnabledAt == null`), do **not** issue a
    session. Return an *enrollment-required* state
    (`{ requiresTotpEnrollment: true, enrollmentChallenge }`). The `enrollmentChallenge`
    is a single-use, short-lived token (stored hashed in `totp_challenges`) that the
    admin presents to the TOTP enroll/verify-enrollment routes. Only after enrollment
    completes and a subsequent login passes the TOTP challenge does the admin receive a
    full session. This guarantees a freshly-promoted admin can never hold a
    password-only session.

```ts
import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, loginSchema } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { verifyPassword } from '../../services/auth/passwords.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { hashToken, randomToken } from '../../utils/random.js';

const INVALID = new AppError({
  status: 401,
  code: ERROR_CODES.INVALID_CREDENTIALS,
  title: 'Invalid email or password',
});

export async function loginRoute(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const input = loginSchema.parse(req.body);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash || user.status !== 'active') throw INVALID;

    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) throw INVALID;

    // Email verification is required before any sign-in (§2.1).
    if (!user.emailVerifiedAt) {
      throw new AppError({
        status: 403,
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        title: 'Please verify your email before signing in',
      });
    }

    // Admins always require TOTP (§8.2).
    if (user.role === 'admin') {
      if (user.totpSecret && user.totpEnabledAt) {
        // TOTP already enabled → second-factor challenge.
        const challengeToken = randomToken(24);
        await prisma.totpChallenge.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(challengeToken),
            purpose: 'login',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
        return reply.send({ requiresTotp: true, challengeToken });
      }
      // TOTP not set up yet → force enrollment; do NOT issue a session.
      const enrollmentChallenge = randomToken(24);
      await prisma.totpChallenge.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(enrollmentChallenge),
          purpose: 'enroll',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      return reply.send({ requiresTotpEnrollment: true, enrollmentChallenge });
    }

    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });
    return reply.send({
      user: toApiUser(user),
      tokens: { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
    });
  });
}
```

- [ ] **Step 4: Mount in `api/src/routes/auth/index.ts`**

Keep the scoped rate limiter from Task F1 at the top; just register the new route after
the existing ones. Replace contents with:
```ts
import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { registerRoute } from './register.js';
import { loginRoute } from './login.js';

export async function authRoutes(app: FastifyInstance) {
  const cfg = getConfig();
  if (cfg.rateLimit.enabled) {
    await app.register(rateLimit, {
      max: cfg.rateLimit.authPerIpPerMin,
      timeWindow: '1 minute',
      redis: getRedis(),
      nameSpace: 'rl:auth:',
      keyGenerator: (req) => `ip:${req.ip}`,
    });
  }
  await app.register(registerRoute);
  await app.register(loginRoute);
}
```

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/login.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): POST /v1/auth/login (with admin TOTP challenge)"
```

---

### Task F3: POST /v1/auth/refresh

**Files:**
- Create: `api/src/routes/auth/refresh.ts`
- Create: `api/tests/integration/refresh.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/refresh.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

async function loginAndGetTokens(app: Awaited<ReturnType<typeof buildServer>>) {
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: 'r@example.com',
      password: 'correct-horse-battery-staple',
      firstName: 'A',
      lastName: 'B',
    },
  });
  // Sign-in requires a verified email.
  await getPrisma().user.update({
    where: { email: 'r@example.com' },
    data: { emailVerifiedAt: new Date() },
  });
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'r@example.com', password: 'correct-horse-battery-staple' },
  });
  return res.json().tokens as { accessToken: string; refreshToken: string };
}

describe('POST /v1/auth/refresh', () => {
  it('rotates the refresh token', async () => {
    const app = await buildServer();
    const t = await loginAndGetTokens(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: t.refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tokens.refreshToken).not.toBe(t.refreshToken);
    expect(body.tokens.accessToken).toBeTruthy();
    await app.close();
  });

  it('rejects an already-rotated token (replay)', async () => {
    const app = await buildServer();
    const t = await loginAndGetTokens(app);
    await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: t.refreshToken },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: t.refreshToken },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });

  it('rejects a bogus token', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: 'not-real' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/refresh.test.ts
```

- [ ] **Step 3: Write `api/src/routes/auth/refresh.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { ERROR_CODES, refreshSchema } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { findActiveSessionByToken, rotateSession } from '../../services/auth/sessions.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { findUserById, toApiUser } from '../../services/users/repository.js';

export async function refreshRoute(app: FastifyInstance) {
  app.post('/refresh', async (req, reply) => {
    const input = refreshSchema.parse(req.body);
    const session = await findActiveSessionByToken(input.refreshToken);
    if (!session) {
      throw new AppError({ status: 401, code: ERROR_CODES.INVALID_TOKEN, title: 'Invalid token' });
    }
    const user = await findUserById(session.userId);
    if (!user || user.status !== 'active') {
      throw new AppError({ status: 401, code: ERROR_CODES.INVALID_TOKEN, title: 'Invalid token' });
    }
    const next = await rotateSession(input.refreshToken);
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    return reply.send({
      user: toApiUser(user),
      tokens: { accessToken, refreshToken: next.refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
    });
  });
}
```

- [ ] **Step 4: Mount in `api/src/routes/auth/index.ts`**

Keep the scoped rate limiter at the top. Update to:
```ts
import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';
import { registerRoute } from './register.js';
import { loginRoute } from './login.js';
import { refreshRoute } from './refresh.js';

export async function authRoutes(app: FastifyInstance) {
  const cfg = getConfig();
  if (cfg.rateLimit.enabled) {
    await app.register(rateLimit, {
      max: cfg.rateLimit.authPerIpPerMin,
      timeWindow: '1 minute',
      redis: getRedis(),
      nameSpace: 'rl:auth:',
      keyGenerator: (req) => `ip:${req.ip}`,
    });
  }
  await app.register(registerRoute);
  await app.register(loginRoute);
  await app.register(refreshRoute);
}
```

> Subsequent tasks add `import` + `await app.register(...)` lines for each new route
> below `refreshRoute`; leave the scoped rate-limiter block at the top intact.

- [ ] **Step 5: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/refresh.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): POST /v1/auth/refresh with rotation"
```

---

### Task F4: POST /v1/auth/logout

**Files:**
- Create: `api/src/routes/auth/logout.ts`
- Create: `api/tests/integration/logout.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/logout.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('POST /v1/auth/logout', () => {
  it('revokes the refresh token', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'lo@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    // Sign-in requires a verified email.
    await getPrisma().user.update({
      where: { email: 'lo@example.com' },
      data: { emailVerifiedAt: new Date() },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'lo@example.com', password: 'correct-horse-battery-staple' },
    });
    const tokens = login.json().tokens;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(res.statusCode).toBe(204);

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(refresh.statusCode).toBe(401);
    await app.close();
  });

  it('idempotent: returns 204 even for an unknown token', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken: 'unknown-token' },
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/logout.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { refreshSchema } from '@expyrico/shared';
import { findActiveSessionByToken, revokeSession } from '../../services/auth/sessions.js';

export async function logoutRoute(app: FastifyInstance) {
  app.post('/logout', async (req, reply) => {
    const input = refreshSchema.parse(req.body);
    const session = await findActiveSessionByToken(input.refreshToken);
    if (session) await revokeSession(session.id);
    return reply.status(204).send();
  });
}
```

- [ ] **Step 4: Mount in `index.ts`**

Add `import { logoutRoute } from './logout.js';` and `await app.register(logoutRoute);`.

- [ ] **Step 5: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/logout.test.ts
git add -A && git commit -m "feat(api): POST /v1/auth/logout"
```

---

### Task F5: GET /v1/auth/me

**Files:**
- Create: `api/src/routes/auth/me.ts`
- Create: `api/tests/integration/me.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/me.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

async function authedTokens(app: Awaited<ReturnType<typeof buildServer>>) {
  await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email: 'me@example.com',
      password: 'correct-horse-battery-staple',
      firstName: 'Me',
      lastName: 'User',
    },
  });
  // Sign-in requires a verified email.
  await getPrisma().user.update({
    where: { email: 'me@example.com' },
    data: { emailVerifiedAt: new Date() },
  });
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'me@example.com', password: 'correct-horse-battery-staple' },
  });
  return login.json().tokens as { accessToken: string };
}

describe('GET /v1/auth/me', () => {
  it('returns the authenticated user', async () => {
    const app = await buildServer();
    const t = await authedTokens(app);
    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${t.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('me@example.com');
    await app.close();
  });

  it('returns 401 without a token', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/me.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { AppError } from '../../errors.js';
import { ERROR_CODES } from '@expyrico/shared';
import { findUserById, toApiUser } from '../../services/users/repository.js';

export async function meRoute(app: FastifyInstance) {
  app.get('/me', { onRequest: [app.requireAuth] }, async (req) => {
    const u = await findUserById(req.user!.id);
    if (!u) throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    return toApiUser(u);
  });
}
```

- [ ] **Step 4: Mount + verify + commit**

```ts
import { meRoute } from './me.js';
// ...
await app.register(meRoute);
```
```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/me.test.ts
git add -A && git commit -m "feat(api): GET /v1/auth/me"
```

---

### Task F6: Email verification routes

**Files:**
- Create: `api/src/routes/auth/verify-email.ts`
- Create: `api/src/routes/auth/resend-verification.ts`
- Create: `api/tests/integration/verify-email.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/verify-email.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('email verification', () => {
  it('verifies an email with a valid token', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 've@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'V',
        lastName: 'E',
      },
    });
    // Fetch the unhashed token by hooking via the email log? Tests run with NODE_ENV=test
    // and email service logs the link — but we don't have access. Instead, generate a fresh
    // verification token via the resend route which writes a new EmailToken row, and capture
    // the plaintext via a one-off test-only path: re-issue the same flow as register did.
    //
    // Approach: we directly insert an EmailToken with a known plaintext for assertion.
    const user = await getPrisma().user.findUnique({ where: { email: 've@example.com' } });
    const { hashToken, randomToken } = await import('../../src/utils/random.js');
    const plain = randomToken(16);
    await getPrisma().emailToken.create({
      data: {
        userId: user!.id,
        tokenHash: hashToken(plain),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/auth/verify-email?token=${plain}`,
    });
    expect(res.statusCode).toBe(200);
    const after = await getPrisma().user.findUnique({ where: { email: 've@example.com' } });
    expect(after?.emailVerifiedAt).not.toBeNull();
    await app.close();
  });

  it('rejects an unknown token', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/v1/auth/verify-email?token=nope' });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });

  it('rejects a re-used token', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'r@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const user = await getPrisma().user.findUnique({ where: { email: 'r@example.com' } });
    const { hashToken, randomToken } = await import('../../src/utils/random.js');
    const plain = randomToken(16);
    await getPrisma().emailToken.create({
      data: {
        userId: user!.id,
        tokenHash: hashToken(plain),
        purpose: 'verify_email',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await app.inject({ method: 'GET', url: `/v1/auth/verify-email?token=${plain}` });
    const res = await app.inject({ method: 'GET', url: `/v1/auth/verify-email?token=${plain}` });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('resend creates a fresh token for an unverified user', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 's@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    const before = await getPrisma().emailToken.count();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/resend-verification',
      payload: { email: 's@example.com' },
    });
    expect(res.statusCode).toBe(204);
    const after = await getPrisma().emailToken.count();
    expect(after).toBe(before + 1);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/verify-email.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';

const querySchema = z.object({ token: z.string().min(1) });

export async function verifyEmailRoute(app: FastifyInstance) {
  app.get('/verify-email', async (req, reply) => {
    const { token } = querySchema.parse(req.query);
    const prisma = getPrisma();
    const row = await prisma.emailToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now() || row.purpose !== 'verify_email') {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid or expired token',
      });
    }
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } }),
      prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    return reply.send({ verified: true });
  });
}
```

- [ ] **Step 4: Write `api/src/routes/auth/resend-verification.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { resendVerificationSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { hashToken, randomToken } from '../../utils/random.js';
import { sendVerificationEmail } from '../../services/auth/email.js';

export async function resendVerificationRoute(app: FastifyInstance) {
  app.post('/resend-verification', async (req, reply) => {
    const input = resendVerificationSchema.parse(req.body);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Always 204 — don't leak whether email exists
    if (user && !user.emailVerifiedAt) {
      const plain = randomToken(32);
      await prisma.emailToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(plain),
          purpose: 'verify_email',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await sendVerificationEmail(user.email, plain);
    }
    return reply.status(204).send();
  });
}
```

- [ ] **Step 5: Mount + verify + commit**

```ts
import { verifyEmailRoute } from './verify-email.js';
import { resendVerificationRoute } from './resend-verification.js';
// ...
await app.register(verifyEmailRoute);
await app.register(resendVerificationRoute);
```
```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/verify-email.test.ts
git add -A && git commit -m "feat(api): email verification + resend"
```

---

### Task F7: Forgot/reset password

**Files:**
- Create: `api/src/routes/auth/forgot-password.ts`
- Create: `api/src/routes/auth/reset-password.ts`
- Create: `api/tests/integration/forgot-reset.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/forgot-reset.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('forgot/reset password', () => {
  it('forgot creates a reset token; reset sets new password', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'fr@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });

    const forgot = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'fr@example.com' },
    });
    expect(forgot.statusCode).toBe(204);
    const reset = await getPrisma().passwordReset.findFirst({});
    expect(reset).not.toBeNull();

    // Inject a known plaintext for assertion
    const { hashToken, randomToken } = await import('../../src/utils/random.js');
    const plain = randomToken(16);
    await getPrisma().passwordReset.update({
      where: { id: reset!.id },
      data: { tokenHash: hashToken(plain) },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token: plain, password: 'a-new-correct-horse-1234' },
    });
    expect(res.statusCode).toBe(204);

    // Sign-in requires a verified email — mark it verified before logging in.
    await getPrisma().user.update({
      where: { email: 'fr@example.com' },
      data: { emailVerifiedAt: new Date() },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'fr@example.com', password: 'a-new-correct-horse-1234' },
    });
    expect(login.statusCode).toBe(200);
    await app.close();
  });

  it('forgot returns 204 even for unknown email (no leak)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      payload: { email: 'noone@example.com' },
    });
    expect(res.statusCode).toBe(204);
    expect(await getPrisma().passwordReset.count()).toBe(0);
    await app.close();
  });

  it('reset rejects bogus token', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token: 'nope', password: 'a-new-correct-horse-1234' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_token');
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/forgot-password.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { forgotPasswordSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { hashToken, randomToken } from '../../utils/random.js';
import { sendPasswordResetEmail } from '../../services/auth/email.js';

export async function forgotPasswordRoute(app: FastifyInstance) {
  app.post('/forgot-password', async (req, reply) => {
    const input = forgotPasswordSchema.parse(req.body);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (user && user.status === 'active') {
      const plain = randomToken(32);
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(plain),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
        },
      });
      await sendPasswordResetEmail(user.email, plain);
    }
    return reply.status(204).send();
  });
}
```

- [ ] **Step 4: Write `api/src/routes/auth/reset-password.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { resetPasswordSchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { hashToken } from '../../utils/random.js';
import { hashPassword } from '../../services/auth/passwords.js';
import { revokeAllSessions } from '../../services/auth/sessions.js';

export async function resetPasswordRoute(app: FastifyInstance) {
  app.post('/reset-password', async (req, reply) => {
    const input = resetPasswordSchema.parse(req.body);
    const prisma = getPrisma();
    const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(input.token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new AppError({ status: 400, code: ERROR_CODES.INVALID_TOKEN, title: 'Invalid or expired token' });
    }
    const passwordHash = await hashPassword(input.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    // Revoke all existing sessions on password reset (security)
    await revokeAllSessions(row.userId);
    return reply.status(204).send();
  });
}
```

- [ ] **Step 5: Mount + verify + commit**

```ts
import { forgotPasswordRoute } from './forgot-password.js';
import { resetPasswordRoute } from './reset-password.js';
// ...
await app.register(forgotPasswordRoute);
await app.register(resetPasswordRoute);
```
```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/forgot-reset.test.ts
git add -A && git commit -m "feat(api): forgot/reset password with session revocation"
```

---

### Task F8: Auth-scope rate limit triggers

The `/v1/auth/*` routes carry a tighter per-IP budget than the rest of the API to slow
credential stuffing and brute force. The limiter is never disabled in tests — `.env.test`
sets the global budgets high and the auth-scope budget low (`RATE_LIMIT_AUTH_PER_IP_PER_MIN=5`)
so this test can prove the auth limiter trips while ordinary multi-request flows are
unaffected.

**Files:**
- Create: `api/tests/integration/rate-limit.test.ts`

- [ ] **Step 1: Write the test**

```ts
// api/tests/integration/rate-limit.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getConfig } from '../../src/config.js';

describe('auth rate limiting', () => {
  it('returns 429 once the per-IP /v1/auth/* budget is exceeded', async () => {
    const app = await buildServer();
    const limit = getConfig().rateLimit.authPerIpPerMin;
    // Hit a cheap auth endpoint (login with bad creds) until the budget is spent.
    let last = 200;
    for (let i = 0; i < limit + 1; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'nobody@example.com', password: 'correct-horse-battery-staple' },
        headers: { 'x-forwarded-for': '203.0.113.7' },
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify pass**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/rate-limit.test.ts
```
Expected: passes. Note: `beforeEach` flushes Redis (M0a Task D7), so the limiter
counter starts fresh per test.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test(api): assert /v1/auth/* rate limit triggers"
```

---

## Phase G — OAuth (Google + Apple)

### Task G1: Google id_token verification service

**Files:**
- Create: `api/src/services/auth/google.ts`

- [ ] **Step 1: Write `api/src/services/auth/google.ts`**

```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getConfig } from '../../config.js';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const cfg = getConfig();
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: cfg.oauth.googleClientId,
  });
  const p = payload as JWTPayload & {
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  if (!p.sub || !p.email) throw new Error('id_token missing sub or email');
  return {
    sub: p.sub,
    email: p.email.toLowerCase(),
    emailVerified: p.email_verified === true,
    ...(p.given_name !== undefined ? { givenName: p.given_name } : {}),
    ...(p.family_name !== undefined ? { familyName: p.family_name } : {}),
    ...(p.picture !== undefined ? { picture: p.picture } : {}),
  };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/api typecheck
git add -A && git commit -m "feat(api): Google id_token verification service"
```

---

### Task G2: POST /v1/auth/oauth/google route

**Files:**
- Create: `api/src/routes/auth/oauth-google.ts`
- Create: `api/tests/integration/oauth-google.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/oauth-google.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

vi.mock('../../src/services/auth/google.js', () => ({
  verifyGoogleIdToken: vi.fn(),
}));

import { verifyGoogleIdToken } from '../../src/services/auth/google.js';

describe('POST /v1/auth/oauth/google', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a user on first sign-in', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 'google-sub-1',
      email: 'gnew@example.com',
      emailVerified: true,
      givenName: 'Grace',
      familyName: 'Hopper',
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 'token' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.email).toBe('gnew@example.com');
    expect(body.user.firstName).toBe('Grace');
    expect(body.tokens.accessToken).toBeTruthy();

    const cred = await getPrisma().authCredential.findFirst({
      where: { type: 'google', providerUserId: 'google-sub-1' },
    });
    expect(cred).not.toBeNull();
    await app.close();
  });

  it('signs in an existing user without duplicating credentials', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 'google-sub-2',
      email: 'gex@example.com',
      emailVerified: true,
    });
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 'first' },
    });
    const before = await getPrisma().authCredential.count({ where: { type: 'google' } });

    await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 'second' },
    });
    const after = await getPrisma().authCredential.count({ where: { type: 'google' } });
    expect(after).toBe(before);
    await app.close();
  });

  it('links Google to an existing email-account on email match', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: 'shared@example.com',
        password: 'correct-horse-battery-staple',
        firstName: 'A',
        lastName: 'B',
      },
    });
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 'google-sub-3',
      email: 'shared@example.com',
      emailVerified: true,
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 't' },
    });
    expect(res.statusCode).toBe(200);
    const credCount = await getPrisma().authCredential.count({
      where: { user: { email: 'shared@example.com' } },
    });
    expect(credCount).toBe(2); // password + google
    await app.close();
  });

  it('rejects unverified emails', async () => {
    vi.mocked(verifyGoogleIdToken).mockResolvedValue({
      sub: 's',
      email: 'unv@example.com',
      emailVerified: false,
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/google',
      payload: { idToken: 't' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('email_not_verified');
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/oauth-google.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { oauthGoogleSchema, ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { verifyGoogleIdToken } from '../../services/auth/google.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { detectCountryFromIp } from '../../services/country/detect.js';

export async function oauthGoogleRoute(app: FastifyInstance) {
  app.post('/oauth/google', async (req, reply) => {
    const input = oauthGoogleSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyGoogleIdToken(input.idToken);
    } catch (err) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid Google id_token',
      });
    }

    if (!identity.emailVerified) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        title: 'Google account email is not verified',
      });
    }

    const prisma = getPrisma();

    // Try to find an existing credential
    let cred = await prisma.authCredential.findUnique({
      where: { type_providerUserId: { type: 'google', providerUserId: identity.sub } },
    });

    let user;
    if (cred) {
      user = await prisma.user.findUnique({ where: { id: cred.userId } });
    } else {
      // Maybe an existing email account — link rather than duplicate
      user = await prisma.user.findUnique({ where: { email: identity.email } });
      if (!user) {
        const country = await detectCountryFromIp(req.ip).catch(() => null);
        user = await prisma.user.create({
          data: {
            email: identity.email,
            firstName: identity.givenName ?? 'User',
            lastName: identity.familyName ?? '',
            emailVerifiedAt: new Date(),
            avatarUrl: identity.picture ?? null,
            country,
          },
        });
      }
      await prisma.authCredential.create({
        data: {
          userId: user.id,
          type: 'google',
          providerUserId: identity.sub,
          metadata: { picture: identity.picture },
        },
      });
    }

    if (!user || user.status !== 'active') {
      throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    }

    await prisma.authCredential.update({
      where: { type_providerUserId: { type: 'google', providerUserId: identity.sub } },
      data: { lastUsedAt: new Date() },
    });

    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });

    return reply.send({
      user: toApiUser(user),
      tokens: { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
    });
  });
}
```

- [ ] **Step 4: Mount + verify + commit**

```ts
import { oauthGoogleRoute } from './oauth-google.js';
// ...
await app.register(oauthGoogleRoute);
```
```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/oauth-google.test.ts
git add -A && git commit -m "feat(api): POST /v1/auth/oauth/google"
```

---

### Task G3: Apple identity_token verification service

**Files:**
- Create: `api/src/services/auth/apple.ts`

- [ ] **Step 1: Write `api/src/services/auth/apple.ts`**

```ts
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getConfig } from '../../config.js';

const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export interface AppleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  isPrivateEmail: boolean;
}

export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const cfg = getConfig();
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: cfg.oauth.appleClientId,
  });
  const p = payload as JWTPayload & {
    email?: string;
    email_verified?: boolean | string;
    is_private_email?: boolean | string;
  };
  if (!p.sub) throw new Error('identity_token missing sub');
  const emailVerified = p.email_verified === true || p.email_verified === 'true';
  const isPrivateEmail = p.is_private_email === true || p.is_private_email === 'true';
  return {
    sub: p.sub,
    ...(p.email !== undefined ? { email: p.email.toLowerCase() } : {}),
    emailVerified,
    isPrivateEmail,
  };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/api typecheck
git add -A && git commit -m "feat(api): Apple identity_token verification service"
```

---

### Task G4: POST /v1/auth/oauth/apple route

**Files:**
- Create: `api/src/routes/auth/oauth-apple.ts`
- Create: `api/tests/integration/oauth-apple.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/oauth-apple.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

vi.mock('../../src/services/auth/apple.js', () => ({
  verifyAppleIdentityToken: vi.fn(),
}));

import { verifyAppleIdentityToken } from '../../src/services/auth/apple.js';

describe('POST /v1/auth/oauth/apple', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a user on first sign-in (with name from payload)', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({
      sub: 'apple-sub-1',
      email: 'a@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 't', firstName: 'Anita', lastName: 'Borg' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.firstName).toBe('Anita');
    const cred = await getPrisma().authCredential.findFirst({
      where: { type: 'apple', providerUserId: 'apple-sub-1' },
    });
    expect(cred).not.toBeNull();
    await app.close();
  });

  it('handles second-time sign-in when Apple omits the name fields', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({
      sub: 'apple-sub-2',
      email: 'a2@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    });
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 'first', firstName: 'Ada', lastName: 'L' },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 'second' },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().user.firstName).toBe('Ada'); // preserved
    await app.close();
  });

  it('handles sub-only token (no email) gracefully', async () => {
    vi.mocked(verifyAppleIdentityToken).mockResolvedValue({
      sub: 'apple-sub-3',
      emailVerified: false,
      isPrivateEmail: false,
    });
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/oauth/apple',
      payload: { identityToken: 't', firstName: 'X', lastName: 'Y' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('email_not_verified');
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/oauth-apple.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { oauthAppleSchema, ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { verifyAppleIdentityToken } from '../../services/auth/apple.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { detectCountryFromIp } from '../../services/country/detect.js';

export async function oauthAppleRoute(app: FastifyInstance) {
  app.post('/oauth/apple', async (req, reply) => {
    const input = oauthAppleSchema.parse(req.body);
    let identity;
    try {
      identity = await verifyAppleIdentityToken(input.identityToken);
    } catch {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.INVALID_TOKEN,
        title: 'Invalid Apple identity_token',
      });
    }
    if (!identity.email || !identity.emailVerified) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.EMAIL_NOT_VERIFIED,
        title: 'Apple account email is not verified or missing',
      });
    }

    const prisma = getPrisma();
    let cred = await prisma.authCredential.findUnique({
      where: { type_providerUserId: { type: 'apple', providerUserId: identity.sub } },
    });

    let user;
    if (cred) {
      user = await prisma.user.findUnique({ where: { id: cred.userId } });
    } else {
      user = await prisma.user.findUnique({ where: { email: identity.email } });
      if (!user) {
        const country = await detectCountryFromIp(req.ip).catch(() => null);
        user = await prisma.user.create({
          data: {
            email: identity.email,
            firstName: input.firstName ?? 'User',
            lastName: input.lastName ?? '',
            emailVerifiedAt: new Date(),
            country,
          },
        });
      }
      await prisma.authCredential.create({
        data: {
          userId: user.id,
          type: 'apple',
          providerUserId: identity.sub,
          metadata: { isPrivateEmail: identity.isPrivateEmail },
        },
      });
    }

    if (!user || user.status !== 'active') {
      throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    }

    await prisma.authCredential.update({
      where: { type_providerUserId: { type: 'apple', providerUserId: identity.sub } },
      data: { lastUsedAt: new Date() },
    });

    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });
    return reply.send({
      user: toApiUser(user),
      tokens: { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
    });
  });
}
```

- [ ] **Step 4: Mount + verify + commit**

```ts
import { oauthAppleRoute } from './oauth-apple.js';
// ...
await app.register(oauthAppleRoute);
```
```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/oauth-apple.test.ts
git add -A && git commit -m "feat(api): POST /v1/auth/oauth/apple"
```

---

## Phase H — Passkeys (WebAuthn)

### Task H1: Passkey service

**Files:**
- Create: `api/src/services/auth/passkey.ts`

- [ ] **Step 1: Write `api/src/services/auth/passkey.ts`**

```ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';
import { getConfig } from '../../config.js';
import { getRedis } from '../../redis.js';

const CHALLENGE_TTL_SECONDS = 5 * 60;

function challengeKey(scope: 'register' | 'login', subject: string): string {
  return `passkey:challenge:${scope}:${subject}`;
}

export async function buildRegistrationOptions(userId: string, userName: string, existingCredIds: string[]) {
  const cfg = getConfig();
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: cfg.webauthn.rpName,
    rpID: cfg.webauthn.rpId,
    userID: new TextEncoder().encode(userId),
    userName,
    attestationType: 'none',
    excludeCredentials: existingCredIds.map((id) => ({ id })),
    authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
  };
  const options = await generateRegistrationOptions(opts);
  await getRedis().set(challengeKey('register', userId), options.challenge, 'EX', CHALLENGE_TTL_SECONDS);
  return options;
}

export async function consumeRegistration(userId: string, response: unknown) {
  const cfg = getConfig();
  const expected = await getRedis().get(challengeKey('register', userId));
  if (!expected) throw new Error('challenge expired');
  const opts: VerifyRegistrationResponseOpts = {
    response: response as VerifyRegistrationResponseOpts['response'],
    expectedChallenge: expected,
    expectedOrigin: cfg.webauthn.origin,
    expectedRPID: cfg.webauthn.rpId,
    requireUserVerification: false,
  };
  const verification = await verifyRegistrationResponse(opts);
  await getRedis().del(challengeKey('register', userId));
  if (!verification.verified || !verification.registrationInfo) throw new Error('verification failed');
  return verification.registrationInfo;
}

export async function buildAuthenticationOptions(subject: string, allowedCredIds: string[]) {
  const cfg = getConfig();
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: cfg.webauthn.rpId,
    allowCredentials: allowedCredIds.map((id) => ({ id })),
    userVerification: 'preferred',
  };
  const options = await generateAuthenticationOptions(opts);
  await getRedis().set(challengeKey('login', subject), options.challenge, 'EX', CHALLENGE_TTL_SECONDS);
  return options;
}

export async function consumeAuthentication(
  subject: string,
  response: unknown,
  authenticator: { credentialID: string; credentialPublicKey: Uint8Array; counter: number },
) {
  const cfg = getConfig();
  const expected = await getRedis().get(challengeKey('login', subject));
  if (!expected) throw new Error('challenge expired');
  const opts: VerifyAuthenticationResponseOpts = {
    response: response as VerifyAuthenticationResponseOpts['response'],
    expectedChallenge: expected,
    expectedOrigin: cfg.webauthn.origin,
    expectedRPID: cfg.webauthn.rpId,
    credential: {
      id: authenticator.credentialID,
      publicKey: authenticator.credentialPublicKey,
      counter: authenticator.counter,
    },
    requireUserVerification: false,
  };
  const verification = await verifyAuthenticationResponse(opts);
  await getRedis().del(challengeKey('login', subject));
  if (!verification.verified) throw new Error('verification failed');
  return verification.authenticationInfo;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/api typecheck
git add -A && git commit -m "feat(api): passkey (WebAuthn) service wrappers"
```

---

### Task H2: Passkey register routes

**Files:**
- Create: `api/src/routes/auth/passkey-register.ts`
- Create: `api/tests/integration/passkey.test.ts` (covers both register and login)
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test (initial coverage for register options)**

```ts
// api/tests/integration/passkey.test.ts
import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';

describe('passkey routes', () => {
  it('register/options requires auth', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'POST', url: '/v1/auth/passkey/register/options' });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('register/options returns a challenge for an authenticated user', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'p@example.com', password: 'correct-horse-battery-staple', firstName: 'A', lastName: 'B' },
    });
    // Sign-in requires a verified email.
    await getPrisma().user.update({
      where: { email: 'p@example.com' },
      data: { emailVerifiedAt: new Date() },
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'p@example.com', password: 'correct-horse-battery-staple' },
    });
    const tok = login.json().tokens.accessToken;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/register/options',
      headers: { authorization: `Bearer ${tok}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().challenge).toBeTruthy();
    expect(res.json().rp.id).toBe('localhost');
    await app.close();
  });

  it('login/options for an unknown email returns generic options (no leak)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/passkey/login/options',
      payload: { email: 'nobody@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().challenge).toBeTruthy();
    await app.close();
  });
});
```

> **Note for the engineer:** End-to-end "verify" tests against real WebAuthn responses require a virtual authenticator. We rely on integration tests for the option-generation paths and unit-test mocking for the verify paths. Real verify is exercised in M0c via Maestro/Playwright against the running stack.

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/passkey-register.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { passkeyRegisterVerifySchema, ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildRegistrationOptions, consumeRegistration } from '../../services/auth/passkey.js';

export async function passkeyRegisterRoute(app: FastifyInstance) {
  app.post(
    '/passkey/register/options',
    { onRequest: [app.requireAuth] },
    async (req) => {
      const userId = req.user!.id;
      const prisma = getPrisma();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const existing = await prisma.authCredential.findMany({
        where: { userId, type: 'passkey' },
      });
      const ids = existing
        .map((c) => c.providerUserId)
        .filter((v): v is string => !!v);
      return buildRegistrationOptions(userId, user!.email, ids);
    },
  );

  app.post(
    '/passkey/register/verify',
    { onRequest: [app.requireAuth] },
    async (req, reply) => {
      const input = passkeyRegisterVerifySchema.parse(req.body);
      const userId = req.user!.id;
      let regInfo;
      try {
        regInfo = await consumeRegistration(userId, input.attestationResponse);
      } catch (err) {
        throw new AppError({
          status: 400,
          code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
          title: 'Passkey registration failed',
        });
      }
      const prisma = getPrisma();
      await prisma.authCredential.create({
        data: {
          userId,
          type: 'passkey',
          providerUserId: regInfo.credential.id,
          publicKey: Buffer.from(regInfo.credential.publicKey),
          counter: BigInt(regInfo.credential.counter),
          metadata: { transports: regInfo.credential.transports ?? [] },
        },
      });
      return reply.status(201).send({ registered: true });
    },
  );
}
```

- [ ] **Step 4: Mount in `index.ts`**

```ts
import { passkeyRegisterRoute } from './passkey-register.js';
await app.register(passkeyRegisterRoute);
```

- [ ] **Step 5: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/passkey.test.ts
git add -A && git commit -m "feat(api): passkey register options + verify"
```

---

### Task H3: Passkey login routes

**Files:**
- Create: `api/src/routes/auth/passkey-login.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write `api/src/routes/auth/passkey-login.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { passkeyLoginOptionsSchema, passkeyLoginVerifySchema, ERROR_CODES } from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildAuthenticationOptions, consumeAuthentication } from '../../services/auth/passkey.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';

export async function passkeyLoginRoute(app: FastifyInstance) {
  app.post('/passkey/login/options', async (req) => {
    const input = passkeyLoginOptionsSchema.parse(req.body ?? {});
    const prisma = getPrisma();
    let allowed: string[] = [];
    let subject = `anon:${req.ip}`;
    if (input.email) {
      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (user) {
        const creds = await prisma.authCredential.findMany({
          where: { userId: user.id, type: 'passkey' },
        });
        allowed = creds
          .map((c) => c.providerUserId)
          .filter((v): v is string => !!v);
        subject = `user:${user.id}`;
      }
    }
    return buildAuthenticationOptions(subject, allowed);
  });

  app.post('/passkey/login/verify', async (req, reply) => {
    const input = passkeyLoginVerifySchema.parse(req.body);
    const prisma = getPrisma();
    const r = input.assertionResponse as { id?: string };
    if (!r.id) {
      throw new AppError({
        status: 400,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Missing credential id',
      });
    }
    const cred = await prisma.authCredential.findUnique({
      where: { type_providerUserId: { type: 'passkey', providerUserId: r.id } },
    });
    if (!cred || !cred.publicKey) {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Unknown passkey',
      });
    }
    const user = await prisma.user.findUnique({ where: { id: cred.userId } });
    if (!user || user.status !== 'active') {
      throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
    }

    let info;
    try {
      info = await consumeAuthentication(`user:${user.id}`, input.assertionResponse, {
        credentialID: r.id,
        credentialPublicKey: new Uint8Array(cred.publicKey),
        counter: Number(cred.counter ?? 0n),
      });
    } catch {
      throw new AppError({
        status: 401,
        code: ERROR_CODES.PASSKEY_VERIFICATION_FAILED,
        title: 'Passkey verification failed',
      });
    }

    await prisma.authCredential.update({
      where: { id: cred.id },
      data: { counter: BigInt(info.newCounter), lastUsedAt: new Date() },
    });

    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });
    return reply.send({
      user: toApiUser(user),
      tokens: { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
    });
  });
}
```

- [ ] **Step 2: Mount + commit**

```ts
import { passkeyLoginRoute } from './passkey-login.js';
await app.register(passkeyLoginRoute);
```
```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/passkey.test.ts
git add -A && git commit -m "feat(api): passkey login options + verify"
```

---

## Phase I — TOTP (admin 2FA)

### Task I1: TOTP service

**Files:**
- Create: `api/src/services/auth/totp.ts`

- [ ] **Step 1: Write `api/src/services/auth/totp.ts`**

```ts
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { getConfig } from '../../config.js';
import { encrypt, decrypt } from '../../utils/encryption.js';
import { randomToken } from '../../utils/random.js';

authenticator.options = { window: 1 };

export interface TotpEnrollment {
  encryptedSecret: string;
  qrCodeDataUrl: string;
  rawSecret: string;
  recoveryCodes: string[];
}

export async function buildEnrollment(email: string): Promise<TotpEnrollment> {
  const cfg = getConfig();
  const rawSecret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(email, 'Expyrico Admin', rawSecret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
  const encryptedSecret = encrypt(rawSecret, cfg.totp.encryptionKey);
  const recoveryCodes = Array.from({ length: 10 }, () => randomToken(8).slice(0, 10));
  return { encryptedSecret, qrCodeDataUrl, rawSecret, recoveryCodes };
}

export function verifyTotp(encryptedSecret: string, code: string): boolean {
  const cfg = getConfig();
  try {
    const secret = decrypt(encryptedSecret, cfg.totp.encryptionKey);
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @expyrico/api typecheck
git add -A && git commit -m "feat(api): TOTP service with otplib + AES-GCM"
```

---

### Task I2: TOTP routes (enroll + verify-enrollment + challenge-verify)

**Files:**
- Create: `api/src/routes/auth/totp.ts`
- Create: `api/tests/integration/totp.test.ts`
- Modify: `api/src/routes/auth/index.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/tests/integration/totp.test.ts
import { describe, expect, it } from 'vitest';
import { authenticator } from 'otplib';
import { buildServer } from '../../src/server.js';
import { getPrisma } from '../../src/db.js';
import { hashPassword } from '../../src/services/auth/passwords.js';

async function makeAdmin() {
  const hash = await hashPassword('admin-password-1234');
  return getPrisma().user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: hash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      emailVerifiedAt: new Date(),
    },
  });
}

/** Password-login a fresh admin and return the forced-enrollment challenge. */
async function loginForEnrollment(app: Awaited<ReturnType<typeof buildServer>>) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'admin@example.com', password: 'admin-password-1234' },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  // A fresh admin gets no session — only an enrollment challenge.
  expect(body.requiresTotpEnrollment).toBe(true);
  expect(body.tokens).toBeUndefined();
  return body.enrollmentChallenge as string;
}

/** Full enrollment: returns the raw secret + recovery codes for later assertions. */
async function enroll(app: Awaited<ReturnType<typeof buildServer>>) {
  const enrollmentChallenge = await loginForEnrollment(app);
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/totp/enroll',
    payload: { enrollmentChallenge },
  });
  expect(res.statusCode).toBe(200);
  const { qrCodeDataUrl, secret, recoveryCodes } = res.json();
  expect(qrCodeDataUrl).toContain('data:image/png');
  expect(secret).toBeTruthy();
  expect(recoveryCodes).toHaveLength(10);
  const verify = await app.inject({
    method: 'POST',
    url: '/v1/auth/totp/verify-enrollment',
    payload: { enrollmentChallenge, code: authenticator.generate(secret) },
  });
  expect(verify.statusCode).toBe(204);
  return { secret: secret as string, recoveryCodes: recoveryCodes as string[] };
}

describe('TOTP', () => {
  it('enroll rejects a missing/invalid enrollment challenge', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/enroll',
      payload: { enrollmentChallenge: 'not-a-real-challenge' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('admin enroll → verify-enrollment persists hashed recovery codes', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({ data: { userId: admin.id, type: 'password' } });

    const { recoveryCodes } = await enroll(app);

    const stored = await getPrisma().totpRecoveryCode.findMany({ where: { userId: admin.id } });
    expect(stored).toHaveLength(10);
    // Codes are stored hashed, never in plaintext.
    for (const row of stored) {
      expect(recoveryCodes).not.toContain(row.codeHash);
      expect(row.usedAt).toBeNull();
    }
    // The user is now flagged as TOTP-enabled.
    const after = await getPrisma().user.findUnique({ where: { id: admin.id } });
    expect(after?.totpEnabledAt).not.toBeNull();
    await app.close();
  });

  it('enabled admin: login → TOTP challenge-verify grants a session', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({ data: { userId: admin.id, type: 'password' } });
    const { secret } = await enroll(app);

    // Login again — now TOTP is enabled → second-factor challenge.
    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const challenge = login2.json();
    expect(challenge.requiresTotp).toBe(true);
    expect(challenge.tokens).toBeUndefined();
    const challengeToken = challenge.challengeToken;

    const wrong = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken, code: '000000' },
    });
    expect(wrong.statusCode).toBe(401);

    const right = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken, code: authenticator.generate(secret) },
    });
    expect(right.statusCode).toBe(200);
    expect(right.json().tokens.accessToken).toBeTruthy();
    await app.close();
  });

  it('challenge token is single-use', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({ data: { userId: admin.id, type: 'password' } });
    const { secret } = await enroll(app);

    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const ct = login2.json().challengeToken;
    await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken: ct, code: authenticator.generate(secret) },
    });
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/challenge-verify',
      payload: { challengeToken: ct, code: authenticator.generate(secret) },
    });
    expect(replay.statusCode).toBe(401);
    await app.close();
  });

  it('a recovery code can be redeemed once to grant a session, then is rejected on reuse', async () => {
    const app = await buildServer();
    const admin = await makeAdmin();
    await getPrisma().authCredential.create({ data: { userId: admin.id, type: 'password' } });
    const { recoveryCodes } = await enroll(app);
    const code = recoveryCodes[0]!;

    // Login → TOTP challenge.
    const login2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const ct = login2.json().challengeToken;

    // Redeem the recovery code in place of a TOTP code → full session.
    const redeem = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/recovery-verify',
      payload: { challengeToken: ct, recoveryCode: code },
    });
    expect(redeem.statusCode).toBe(200);
    expect(redeem.json().tokens.accessToken).toBeTruthy();

    // The consumed code is now marked used and cannot be redeemed again.
    const login3 = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin@example.com', password: 'admin-password-1234' },
    });
    const ct3 = login3.json().challengeToken;
    const reuse = await app.inject({
      method: 'POST',
      url: '/v1/auth/totp/recovery-verify',
      payload: { challengeToken: ct3, recoveryCode: code },
    });
    expect(reuse.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 2: Verify FAIL**

- [ ] **Step 3: Write `api/src/routes/auth/totp.ts`**

**Design notes for this route:**

- Enrollment is authorized by the single-use `enrollmentChallenge` issued by the login
  route (purpose `enroll`), **not** by an admin bearer token — a freshly-promoted admin
  has no full session until TOTP is set up, so there is no admin token to present yet.
- `verify-enrollment` persists the hashed recovery codes generated during `enroll` into
  `totp_recovery_codes` (one row per code). They are stored hashed and are single-use.
- `challenge-verify` accepts a TOTP code; `recovery-verify` accepts a one-time recovery
  code in its place. Both consume the login challenge (purpose `login`) and grant a
  full session.
- The pending enrollment (raw/encrypted secret + plaintext recovery codes) is held in a
  short-lived in-memory map keyed by userId between `enroll` and `verify-enrollment`.

```ts
import type { FastifyInstance } from 'fastify';
import {
  totpEnrollSchema,
  totpVerifyEnrollmentSchema,
  totpChallengeVerifySchema,
  totpRecoveryVerifySchema,
  ERROR_CODES,
} from '@expyrico/shared';
import { getConfig } from '../../config.js';
import { AppError } from '../../errors.js';
import { getPrisma } from '../../db.js';
import { buildEnrollment, verifyTotp } from '../../services/auth/totp.js';
import { issueAccessToken } from '../../services/auth/tokens.js';
import { createSession } from '../../services/auth/sessions.js';
import { toApiUser } from '../../services/users/repository.js';
import { hashToken } from '../../utils/random.js';

const PENDING_ENROLLMENTS = new Map<string, { encryptedSecret: string; rawSecret: string; recoveryCodes: string[] }>();

/** Resolve and validate an admin enrollment challenge (purpose 'enroll'). */
async function resolveEnrollmentChallenge(enrollmentChallenge: string) {
  const prisma = getPrisma();
  const challenge = await prisma.totpChallenge.findUnique({
    where: { tokenHash: hashToken(enrollmentChallenge) },
  });
  if (
    !challenge ||
    challenge.purpose !== 'enroll' ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError({ status: 401, code: ERROR_CODES.INVALID_TOKEN, title: 'Invalid or expired enrollment challenge' });
  }
  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || user.role !== 'admin' || user.status !== 'active') {
    throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
  }
  return { challenge, user };
}

/** Resolve and validate a login challenge (purpose 'login') for an enabled admin. */
async function resolveLoginChallenge(challengeToken: string) {
  const prisma = getPrisma();
  const challenge = await prisma.totpChallenge.findUnique({
    where: { tokenHash: hashToken(challengeToken) },
  });
  if (
    !challenge ||
    challenge.purpose !== 'login' ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError({ status: 401, code: ERROR_CODES.INVALID_TOKEN, title: 'Invalid or expired challenge' });
  }
  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || !user.totpSecret || user.status !== 'active') {
    throw new AppError({ status: 401, code: ERROR_CODES.UNAUTHORIZED, title: 'Unauthorized' });
  }
  return { challenge, user };
}

export async function totpRoutes(app: FastifyInstance) {
  // POST /v1/auth/totp/enroll  — authorized by the enrollment challenge
  app.post('/totp/enroll', async (req) => {
    const input = totpEnrollSchema.parse(req.body);
    const { user } = await resolveEnrollmentChallenge(input.enrollmentChallenge);
    const enrollment = await buildEnrollment(user.email);
    PENDING_ENROLLMENTS.set(user.id, {
      encryptedSecret: enrollment.encryptedSecret,
      rawSecret: enrollment.rawSecret,
      recoveryCodes: enrollment.recoveryCodes,
    });
    return {
      secret: enrollment.rawSecret,
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
      recoveryCodes: enrollment.recoveryCodes,
    };
  });

  // POST /v1/auth/totp/verify-enrollment  — authorized by the enrollment challenge
  app.post('/totp/verify-enrollment', async (req, reply) => {
    const input = totpVerifyEnrollmentSchema.parse(req.body);
    const { challenge, user } = await resolveEnrollmentChallenge(input.enrollmentChallenge);
    const pending = PENDING_ENROLLMENTS.get(user.id);
    if (!pending) {
      throw new AppError({ status: 400, code: ERROR_CODES.INVALID_TOTP, title: 'No pending enrollment' });
    }
    if (!verifyTotp(pending.encryptedSecret, input.code)) {
      throw new AppError({ status: 401, code: ERROR_CODES.INVALID_TOTP, title: 'Invalid TOTP code' });
    }
    const prisma = getPrisma();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: pending.encryptedSecret, totpEnabledAt: new Date() },
      }),
      // Persist each recovery code hashed; consumed one-time at redemption.
      prisma.totpRecoveryCode.createMany({
        data: pending.recoveryCodes.map((c) => ({ userId: user.id, codeHash: hashToken(c) })),
      }),
      prisma.totpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      }),
    ]);
    PENDING_ENROLLMENTS.delete(user.id);
    return reply.status(204).send();
  });

  // POST /v1/auth/totp/challenge-verify  — public, requires a valid login challenge
  app.post('/totp/challenge-verify', async (req, reply) => {
    const input = totpChallengeVerifySchema.parse(req.body);
    const { challenge, user } = await resolveLoginChallenge(input.challengeToken);
    if (!verifyTotp(user.totpSecret!, input.code)) {
      throw new AppError({ status: 401, code: ERROR_CODES.INVALID_TOTP, title: 'Invalid TOTP code' });
    }
    const prisma = getPrisma();
    await prisma.totpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });
    return reply.send({
      user: toApiUser(user),
      tokens: { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
    });
  });

  // POST /v1/auth/totp/recovery-verify  — redeem a one-time recovery code
  app.post('/totp/recovery-verify', async (req, reply) => {
    const input = totpRecoveryVerifySchema.parse(req.body);
    const { challenge, user } = await resolveLoginChallenge(input.challengeToken);
    const prisma = getPrisma();
    const row = await prisma.totpRecoveryCode.findUnique({
      where: { codeHash: hashToken(input.recoveryCode) },
    });
    if (!row || row.userId !== user.id || row.usedAt) {
      throw new AppError({ status: 401, code: ERROR_CODES.INVALID_RECOVERY_CODE, title: 'Invalid recovery code' });
    }
    await prisma.$transaction([
      prisma.totpRecoveryCode.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      prisma.totpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } }),
    ]);
    const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
    const { refreshToken } = await createSession(user.id, { ip: req.ip });
    return reply.send({
      user: toApiUser(user),
      tokens: { accessToken, refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds },
    });
  });
}
```

- [ ] **Step 4: Mount in `index.ts`**

```ts
import { totpRoutes } from './totp.js';
await app.register(totpRoutes);
```

- [ ] **Step 5: Verify pass + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/totp.test.ts
git add -A && git commit -m "feat(api): TOTP enroll, verify-enrollment, challenge-verify"
```

---

## Phase J — `PATCH /v1/me`

### Task J1: Profile update endpoint

**Files:**
- Create: `api/src/routes/me/index.ts`
- Create: `api/src/routes/me/profile.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write `api/src/routes/me/profile.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { updateProfileSchema } from '@expyrico/shared';
import { getPrisma } from '../../db.js';
import { toApiUser } from '../../services/users/repository.js';

export async function profileRoute(app: FastifyInstance) {
  app.patch('/', { onRequest: [app.requireAuth] }, async (req) => {
    const input = updateProfileSchema.parse(req.body);
    const user = await getPrisma().user.update({
      where: { id: req.user!.id },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        ...(input.themePreference !== undefined ? { themePreference: input.themePreference } : {}),
      },
    });
    return toApiUser(user);
  });
}
```

- [ ] **Step 2: Write `api/src/routes/me/index.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { profileRoute } from './profile.js';

export async function meRoutes(app: FastifyInstance) {
  await app.register(profileRoute);
}
```

- [ ] **Step 3: Mount in `api/src/server.ts`**

After the auth route registration:
```ts
await app.register(meRoutes, { prefix: '/v1/me' });
```
And import: `import { meRoutes } from './routes/me/index.js';`

- [ ] **Step 4: Add a quick integration test `api/tests/integration/me.test.ts` (extend existing)**

Append:
```ts
it('PATCH /v1/me updates profile', async () => {
  const app = await buildServer();
  const t = await authedTokens(app);
  const res = await app.inject({
    method: 'PATCH',
    url: '/v1/me',
    headers: { authorization: `Bearer ${t.accessToken}` },
    payload: { firstName: 'New', themePreference: 'bento' },
  });
  expect(res.statusCode).toBe(200);
  const body = res.json();
  expect(body.firstName).toBe('New');
  expect(body.themePreference).toBe('bento');
  await app.close();
});
```

- [ ] **Step 5: Verify + commit**

```bash
pnpm --filter @expyrico/api exec vitest run tests/integration/me.test.ts
git add -A && git commit -m "feat(api): PATCH /v1/me profile updates"
```

---

## Phase Z — Final verification

### Task Z1: Run the whole API suite

- [ ] **Step 1: Full test run**

```bash
pnpm --filter @expyrico/api test
```
Expected: every M0a test still passing, plus M0b's new tests:
- register, login, refresh, logout, me, verify-email, forgot-reset, rate-limit, oauth-google, oauth-apple, passkey, totp.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Boot smoke**

```bash
pnpm --filter @expyrico/api dev
```
Then in another terminal:
```bash
curl -s -X POST http://localhost:4000/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"correct-horse-battery-staple","firstName":"S","lastName":"M"}' | jq .
```
Expected: JSON body with `user` and `tokens` keys, `user.email = "smoke@example.com"`.

- [ ] **Step 4: Tag the milestone**

```bash
git tag m0b-complete
```

---

## Self-review checklist

- [ ] All 12 integration test files in M0b pass.
- [ ] `pnpm typecheck` is clean.
- [ ] No route file imports raw `process.env` (must go through `getConfig()`).
- [ ] No route file calls `console.*` (must use `req.log`).
- [ ] Every route that returns tokens builds `{ accessToken: issueAccessToken({...}), refreshToken, expiresIn: getConfig().jwt.accessTtlSeconds }` — `issueAccessToken` returns a **string**, never an object. No `.token` unwrapping, no hardcoded `expiresIn: 900`.
- [ ] Login refuses an unverified email with 403 `email_not_verified` (verified in `login.test.ts`).
- [ ] An admin without TOTP enabled gets `{ requiresTotpEnrollment: true, enrollmentChallenge }` and **no** session at the password step; full session only after enrollment + TOTP challenge (verified in `login.test.ts` and `totp.test.ts`).
- [ ] Auth-scope rate limit triggers a 429 on `/v1/auth/*` and is not disabled in tests (verified in `rate-limit.test.ts`).
- [ ] TOTP recovery codes are persisted hashed at enrollment and are single-use: redeeming one grants a session and the same code is rejected on reuse (verified in `totp.test.ts`).
- [ ] Email-leak resistance: `forgot-password` and `resend-verification` always return 204 regardless of whether the email exists.
- [ ] Session revocation on password reset works (verified in `forgot-reset.test.ts`).
- [ ] Refresh-token replay is detected and rejected (verified in `refresh.test.ts`).
- [ ] TOTP challenge tokens are single-use (verified in `totp.test.ts`).

---

## Handoff to M0c

M0c builds the Expo mobile app shell:

- Theme provider consuming `@expyrico/theme`, with a working in-app theme switcher
- Auth Zustand store with secure-store persistence
- Fetch wrapper with automatic token refresh on 401
- TanStack Query hooks for every M0b auth route
- Welcome / Sign-in / Sign-up / Forgot-password / Verify-email screens
- Social sign-in buttons (Google + Apple) wired to `/v1/auth/oauth/*`
- Passkey enrollment and login flows wired to `/v1/auth/passkey/*`
- Bottom-tabs shell (home/browse/reviews/profile, all placeholders for M1)
- Maestro smoke test that registers, signs in, and reaches the home tab
