# Validation: M0a (foundation) + M0b (API auth routes)

Greenfield. Validated internal consistency, cross-plan symbol/signature consistency, spec coverage (§2.1, §5, §6.1, §6.6, §6.8, §8.2, §10.3). Read both plans in full.

---

## 1. Internal & cross-plan consistency

### Symbols M0b consumes that M0a actually defines — OK
- `AppError` (errors.ts), `toProblem` — defined M0a D8.
- `getPrisma` / `disconnectPrisma` (db.ts), `getRedis` / `disconnectRedis` (redis.ts) — M0a D3.
- `hashPassword` / `verifyPassword` (passwords.ts) — M0a E2.
- `issueAccessToken` / `verifyAccessToken` / `issueRefreshToken` (tokens.ts) — M0a E3.
- `createSession` / `findActiveSessionByToken` / `rotateSession` / `revokeSession` / `revokeAllSessions` (sessions.ts) — M0a E4. All M0b imports resolve.
- `sendVerificationEmail` / `sendPasswordResetEmail` (email.ts) — M0a E5.
- `detectCountryFromIp` (country/detect.ts) — M0a E6.
- `toApiUser` / `findUserById` / `findUserByEmail` / `touchLastSeen` (users/repository.ts) — M0a E7.
- `hashToken` / `randomToken` (utils/random.ts), `encrypt` / `decrypt` (utils/encryption.ts) — M0a E1.
- `app.requireAuth` / `app.requireAdmin` / `req.user` — M0a E8 authPlugin.
- All Zod schemas (`registerSchema`, `loginSchema`, `refreshSchema`, `verifyEmailSchema`, `resendVerificationSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `oauthGoogleSchema`, `oauthAppleSchema`, `passkey*Schema`, `totp*Schema`, `authResultSchema`, `ERROR_CODES`, `updateProfileSchema`) — M0a B2. All present.
- Prisma models/columns referenced by M0b routes (User.totpSecret/totpEnabledAt/passwordHash/status/role, AuthCredential type/providerUserId/publicKey/counter/metadata, EmailToken.purpose/usedAt, PasswordReset.usedAt, TotpChallenge.consumedAt, `type_providerUserId` compound unique) — all defined M0a D4. OK.

### CONTRADICTIONS / BUGS

**C1 (CRITICAL — type mismatch, breaks every authenticated route).** M0a E3 redefines `issueAccessToken` to return an OBJECT `{ token, expiresIn }`. EVERY M0b route call site does:
```
const accessToken = await issueAccessToken({ sub: user.id, role: user.role });
... tokens: { accessToken, refreshToken, expiresIn: 900 }
```
So `accessToken` is the `{token, expiresIn}` object, not a string. The response `tokens.accessToken` would serialize as `{token,expiresIn}` and fail `authResultSchema.parse` (register) / break the `accessToken: z.string()` contract everywhere else (login, refresh, oauth-google, oauth-apple, passkey-login, totp challenge-verify). Affected files: register.ts, login.ts, refresh.ts, oauth-google.ts, oauth-apple.ts, passkey-login.ts, totp.ts. Every route needs `const { token: accessToken } = await issueAccessToken(...)` (and should forward `expiresIn` instead of hard-coding `900`). This is the single biggest defect; M0a's tokens.ts and M0b's routes were written against different return shapes.

**C2 (response contract drift — `expiresIn` hard-coded 900).** Routes always emit `expiresIn: 900`, ignoring `cfg.jwt.accessTtlSeconds`. Config defaults to 900 so values agree by luck, but the literal duplicates config and will silently lie if TTL changes. Downstream M0c fetch-wrapper refresh timing keys off this field.

**C3 (login response — two divergent shapes, no shared schema).** `POST /v1/auth/login` returns EITHER `{ user, tokens }` (matches `authResultSchema`) OR `{ requiresTotp: true, challengeToken }`. The TOTP branch is NOT validated against any schema (`totpChallengeSchema` exists in shared but is unused by the route). M0a defines `totpChallengeSchema = { requiresTotp: z.literal(true), challengeToken }` — route emits the right field names, but nothing enforces it, and there is no `loginResponseSchema = union(authResultSchema, totpChallengeSchema)`. Downstream M0c (mobile) and M0d (admin) both branch on this exact shape; recommend exporting a discriminated union from `@pantry/shared`.

**C4 (verify-email response unschematized).** Route returns `{ verified: true }`; resend returns 204. Neither shape is in `@pantry/shared`. Minor, but breaks the plan's stated "no string-typing across boundaries" convention.

**C5 (TOTP pending-enrollment stored in process memory).** `totp.ts` keeps `PENDING_ENROLLMENTS = new Map()` between `/totp/enroll` and `/totp/verify-enrollment`. Survives only within one process. Tests pass because vitest uses `singleFork`. In production (systemd, possibly >1 worker, restarts) enrollment breaks across requests. Spec §8.2 says secret is generated then stored encrypted — plan should persist the pending encrypted secret on the user row (or a short-TTL Redis key), not a Map. Functional gap that tests will not catch.

**C6 (CORS allow-list vs config).** `cors.ts` allows `cfg.frontend.adminUrl`; spec §6.8 says restrict to `exp://`, `pantry://`, and admin domain. Plan also allows `exp://`/`pantry://` prefixes — OK. Consistent enough; note adminUrl is exact-match only.

**C7 (rate-limit disabled in test + does not meet spec §6.8).** server.ts skips `registerRateLimit` when `env==='test'`, and the only limiter is global 60/min. Spec §6.8 requires `/auth/*` at 10/min per IP and 30/min per IP global tier. M0a/M0b implement NEITHER the per-auth-route tighter limit nor the 30/min-per-IP tier. Auth brute-force protection from spec is absent.

**C8 (email-verification not enforced at login).** Spec §2.1: "email verification (required before first sign-in)". `login.ts` never checks `user.emailVerifiedAt`; register returns full `tokens` immediately. So unverified users CAN sign in and get sessions. `ERROR_CODES.EMAIL_NOT_VERIFIED` exists but is only used by OAuth provider-email checks, never for local login. Direct contradiction with §2.1. (May be an intentional product softening, but plan never states it — flag for user.)

**C9 (admin TOTP self-bootstrap gap).** Spec §8.2: TOTP secret "required to be set for role='admin'" and generated "when an existing user is promoted". login.ts only challenges TOTP `if (user.role==='admin' && user.totpSecret && user.totpEnabledAt)`. A freshly-promoted admin with no secret logs in with password ONLY (no 2FA, no forced enrollment). Enrollment endpoints are admin-gated, so the admin must already hold a full session to enroll — consistent with the test flow, but it means there is a window where an admin account has no second factor. Spec intent (admin always 2FA) not enforced.

### Non-issues verified
- `findActiveSessionByToken`/`rotateSession`/`revokeSession` signatures match M0b refresh/logout usage. OK.
- `req.user` optional typing — routes use `req.user!.id` under `requireAuth`; safe. OK.
- Truncate order in setup.ts respects FK deps. OK.
- `type_providerUserId` Prisma compound unique name matches `@@unique([type, providerUserId])`. OK.

---

## 2. Spec coverage (§6.1 auth + §2.1 requirements)

| §6.1 endpoint | Plan task | Status |
|---|---|---|
| POST /auth/register | M0b F1 | ✓ |
| POST /auth/login | M0b F2 | ✓ (but C3/C8) |
| POST /auth/oauth/google | M0b G2 | ✓ |
| POST /auth/oauth/apple | M0b G4 | ✓ |
| POST /auth/passkey/register/options | M0b H2 | ✓ |
| POST /auth/passkey/register/verify | M0b H2 | ✓ |
| POST /auth/passkey/login/options | M0b H3 | ✓ |
| POST /auth/passkey/login/verify | M0b H3 | ✓ |
| POST /auth/refresh | M0b F3 | ✓ |
| POST /auth/logout | M0b F4 | ✓ |
| POST /auth/forgot-password | M0b F7 | ✓ |
| POST /auth/reset-password | M0b F7 | ✓ |
| GET /auth/verify-email | M0b F6 | ✓ |
| POST /auth/resend-verification | M0b F6 | ✓ |
| GET /auth/me | M0b F5 | ✓ |
| PATCH /me (§6.6) | M0b J1 | ✓ (subset) |

**Coverage gaps / notes:**
- **G-1 §2.1 email-verification-before-signin: NOT enforced** (see C8).
- **G-2 §6.8 `/auth/*` 10/min-per-IP + 30/min-per-IP tiers: NOT implemented** (see C7).
- **G-3 §6.6 PATCH /me scope drift.** Spec lists `first_name, last_name, country, avatar_url`. Plan's `updateProfileSchema` ALSO accepts `themePreference` (extra) — fine, theme is §2.10. No contradiction, just broader than §6.6 text.
- **G-4 §6.6 other profile endpoints** (`POST /me/avatar`, `POST /me/push-token`, `DELETE /me/push-token/:id`, `DELETE /me` soft-delete) are NOT in M0a/M0b — but M0b explicitly scopes only `PATCH /v1/me`; these belong to later milestones. Acceptable, just confirm they are assigned somewhere (M1/M2).
- **TOTP / admin-2FA (§8.2):** enroll + verify-enrollment + challenge-verify all present (M0b I2). login emits `requires_totp` challenge (C3). Recovery codes are generated and returned but NEVER persisted/hashed anywhere — `buildEnrollment` returns `recoveryCodes` but the user row stores only `totpSecret`. So recovery codes are non-functional (cannot be redeemed; no schema/table). Spec §8.2 doesn't explicitly demand recovery-code redemption, but generating-then-discarding them is dead code / false UX.

---

## 3. PROVIDES manifest (what M0a+M0b hand to M0c/M0d/M1/M2/M3)

### Files / modules (verbatim paths)
Shared/theme:
- `packages/shared/src/index.ts` (barrel) + `schemas/auth.ts`, `schemas/user.ts`, `schemas/error.ts`, `types.ts`
- `packages/theme/src/index.ts` + `tokens.ts` + `themes/{aurora,bento,clay,material}.ts`

API foundation (M0a):
- `api/src/config.ts`, `logger.ts`, `db.ts`, `redis.ts`, `errors.ts`, `server.ts`
- `api/src/plugins/{auth.ts,cors.ts,rate-limit.ts,error-handler.ts}`
- `api/src/routes/health.ts`
- `api/src/services/auth/{passwords.ts,tokens.ts,sessions.ts,email.ts}`
- `api/src/services/users/repository.ts`, `api/src/services/country/detect.ts`
- `api/src/utils/{random.ts,encryption.ts}`
- `api/prisma/schema.prisma` + initial migration (`<ts>_init`)
- `api/tests/helpers/setup.ts`, `api/tests/helpers/factories.ts` (exports `makeUser`), `api/vitest.config.ts`
- `api/.env.example`, `api/.env.test.example`

API routes (M0b):
- `api/src/routes/auth/index.ts` (`authRoutes`) + register/login/refresh/logout/me/verify-email/resend-verification/forgot-password/reset-password/oauth-google/oauth-apple/passkey-register/passkey-login/totp `.ts`
- `api/src/routes/me/index.ts` (`meRoutes`) + `profile.ts`
- `api/src/services/auth/{google.ts,apple.ts,passkey.ts,totp.ts}`

### Exported symbols / decorators
- `@pantry/shared`: `userSchema`,`User`,`userRoleSchema`,`userStatusSchema`,`themePreferenceSchema`,`updateProfileSchema`,`UpdateProfile`,`tokensSchema`,`Tokens`,`authResultSchema`,`AuthResult`,`totpChallengeSchema`,`TotpChallenge`,`registerSchema`/`RegisterInput`,`loginSchema`/`LoginInput`,`refreshSchema`/`RefreshInput`,`verifyEmailSchema`/`VerifyEmailInput`,`resendVerificationSchema`,`forgotPasswordSchema`/`ForgotPasswordInput`,`resetPasswordSchema`/`ResetPasswordInput`,`oauthGoogleSchema`,`oauthAppleSchema`,`passkeyRegisterOptionsSchema`,`passkeyRegisterVerifySchema`,`passkeyLoginOptionsSchema`,`passkeyLoginVerifySchema`,`totpEnrollSchema`,`totpEnrollResponseSchema`/`TotpEnrollResponse`,`totpVerifyEnrollmentSchema`,`totpChallengeVerifySchema`,`problemSchema`/`Problem`,`ERROR_CODES`,`ErrorCode`,`Paginated<T>`
- `@pantry/theme`: `ThemeId`,`Theme`,`ColorTokens`,`RadiusTokens`,`ShadowTokens`,`TypographyTokens`,`SpacingTokens`,`AnimationTokens`,`aurora`,`bento`,`clay`,`material`,`themes` (Record),`themeList` (array)
- config: `Config`,`Env`,`parseConfig`,`getConfig`,`resetConfigForTests` (config object shape: `jwt.{accessSecret,accessTtlSeconds,issuer,audience,refreshTtlDays}`, `totp.encryptionKey: Buffer`, `oauth.*`, `webauthn.*`, `smtp.*`, `frontend.{appDeepLink,adminUrl}`, `countryDetect.{primary,fallback}`)
- singletons: `getPrisma`/`disconnectPrisma`, `getRedis`/`disconnectRedis`, `logger`
- errors: `AppError`, `toProblem`
- tokens: `issueAccessToken(payload,{expiresIn?}) → {token,expiresIn}` [NOTE C1], `verifyAccessToken → {sub,role}`, `issueRefreshToken() → {token,hash,expiresAt}`, types `AccessTokenPayload`/`AccessClaims`,`IssuedAccessToken`,`RefreshTokenIssue`
- passwords: `hashPassword`,`verifyPassword`
- sessions: `createSession(userId,ctx) → {session,refreshToken}`,`findActiveSessionByToken`,`rotateSession`,`revokeSession`,`revokeAllSessions`,`SessionContext`
- email: `sendVerificationEmail`,`sendPasswordResetEmail`
- country: `detectCountryFromIp(ip,{fetch?}) → string|null`
- users repo: `toApiUser`,`findUserByEmail`,`findUserById`,`touchLastSeen`
- utils: `randomToken(bytes=32)`,`hashToken`,`encrypt(plaintext,key)`,`decrypt(payload,key)`
- Fastify decorators: `app.requireAuth`, `app.requireAdmin`; request decorator `req.user?: {id, role}`; `authPlugin`
- google: `verifyGoogleIdToken → GoogleIdentity`; apple: `verifyAppleIdentityToken → AppleIdentity`
- passkey: `buildRegistrationOptions`,`consumeRegistration`,`buildAuthenticationOptions`,`consumeAuthentication`
- totp: `buildEnrollment(email) → {encryptedSecret,qrCodeDataUrl,rawSecret,recoveryCodes}`,`verifyTotp(encryptedSecret,code)`
- route registrars: `authRoutes`,`meRoutes`,`healthRoutes`, `buildServer()`

### Prisma tables + key columns (initial migration)
- `users` (id uuid, email unique, emailVerifiedAt, passwordHash?, firstName, lastName, country char(2)?, avatarUrl?, role enum user|admin, status enum active|suspended|deleted, themePreference enum aurora|bento|clay|material default aurora, totpSecret?, totpEnabledAt?, createdAt, updatedAt, lastSeenAt)
- `auth_credentials` (id, userId, type enum password|google|apple|passkey, providerUserId?, publicKey bytes?, counter bigint?, metadata json?, createdAt, lastUsedAt; unique(type,providerUserId))
- `sessions` (id, userId, refreshTokenHash unique, deviceInfo json?, ip?, expiresAt, revokedAt?, createdAt)
- `push_tokens` (id, userId, expoPushToken unique, platform, deviceInfo?, createdAt, lastUsedAt?, revokedAt?)
- `email_tokens` (id, userId, tokenHash unique, purpose, expiresAt, usedAt?, createdAt)
- `password_resets` (id, userId, tokenHash unique, expiresAt, usedAt?, createdAt)
- `totp_challenges` (id, userId, tokenHash unique, expiresAt, consumedAt?, createdAt)
- `admin_audit_log` (id, adminId, action, targetType, targetId, diff json?, requestId?, ip?, createdAt)
- Enums: `UserRole`, `UserStatus`, `ThemePreference`, `AuthCredentialType`
- NOTE: spec §5 uses `citext` for email and `inet` for ip; Prisma plan uses plain `String` (`@unique`) and `String?`. Functional deviation — case-insensitivity is enforced at app layer (`emailField` lowercases). Downstream must not rely on DB-level citext/inet.

### HTTP endpoints (method + path + response)
- POST /v1/auth/register → 201 `{user, tokens}` (authResultSchema); 409 `email_already_registered`; 400 `validation_error`
- POST /v1/auth/login → 200 `{user, tokens}` OR 200 `{requiresTotp:true, challengeToken}`; 401 `invalid_credentials`
- POST /v1/auth/refresh → 200 `{user, tokens}` (rotated); 401 `invalid_token`
- POST /v1/auth/logout → 204 (idempotent)
- GET /v1/auth/me → 200 ApiUser; 401
- GET /v1/auth/verify-email?token= → 200 `{verified:true}`; 400 `invalid_token`
- POST /v1/auth/resend-verification → 204 (no leak)
- POST /v1/auth/forgot-password → 204 (no leak)
- POST /v1/auth/reset-password → 204 (revokes all sessions); 400 `invalid_token`
- POST /v1/auth/oauth/google → 200 `{user, tokens}`; 400 `email_not_verified`; 401 `invalid_token`
- POST /v1/auth/oauth/apple → 200 `{user, tokens}`; 400 `email_not_verified`; 401 `invalid_token`
- POST /v1/auth/passkey/register/options → 200 WebAuthn options (auth required, 401 else)
- POST /v1/auth/passkey/register/verify → 201 `{registered:true}`; 400 `passkey_verification_failed`
- POST /v1/auth/passkey/login/options → 200 options (no leak)
- POST /v1/auth/passkey/login/verify → 200 `{user, tokens}`; 401 `passkey_verification_failed`
- POST /v1/auth/totp/enroll → 200 `{secret, qrCodeDataUrl, recoveryCodes}` (admin only, 403 else)
- POST /v1/auth/totp/verify-enrollment → 204; 401 `invalid_totp`
- POST /v1/auth/totp/challenge-verify → 200 `{user, tokens}`; 401 `invalid_token`/`invalid_totp`  **(this is the TOTP challenge-verify endpoint path)**
- PATCH /v1/me → 200 ApiUser (auth required)
- GET /health → 200 `{status:ok}`; GET /health/ready → 200 `{status:ready}` / 503

### Git tags declared
- `m0a-complete` (M0a Z1) — M0b prerequisite check.
- `m0b-complete` (M0b Z1).

---

## 4. CONSUMES (upstream assumptions)
These are base milestones — no upstream code dependency. External/system assumptions only:
- Node 20 LTS, pnpm 9, Postgres 16 (local `pantry` + `pantry_test` DBs, role `pantry`/`pantry`), Redis 7. (M0a A1, D5)
- Spec doc at `docs/superpowers/specs/2026-05-23-pantry-app-design.md`.
- M0b assumes `git tag m0a-complete` exists.
- No M0a/M0b code consumes any M0c/M0d/M1/M2/M3 artifact (correct for a foundation).

---

## 5. Top risks / decision points (brutal)
1. **C1 access-token return-shape mismatch** — `issueAccessToken` returns `{token,expiresIn}` (M0a) but all 7 route call sites treat it as a string. Every `{user,tokens}` response is wrong and `authResultSchema.parse` will throw on register. MUST fix before any route works. Highest priority.
2. **Login response contract has no shared schema (C3)** — M0c and M0d both branch on `{user,tokens}` vs `{requiresTotp,challengeToken}`; nothing enforces field names server-side. Add `loginResponseSchema` discriminated union to `@pantry/shared` now, before clients hard-code it.
3. **Email-verification not enforced at login (C8, §2.1)** + **admin always-2FA not enforced (C9, §8.2)** — both are security requirements in the spec that the routes silently skip. Decide intentionally; if softened, document it.
4. **Rate limiting does not meet §6.8 (C7)** — no `/auth/*` 10/min-per-IP, no 30/min-per-IP tier, and the limiter is disabled in tests so the gap is invisible to CI. Auth endpoints are unthrottled brute-force surface.
5. **TOTP enrollment in process-memory Map (C5)** + **recovery codes generated but never stored** — enrollment will break under multi-process/systemd restart, and recovery codes are dead UX. Persist pending secret (Redis/short-TTL or user row) and either store hashed recovery codes or drop them.

Secondary: DB type deviation citext/inet→String (§5); `expiresIn:900` hard-coded (C2); verify-email/resend response shapes unschematized (C4).

## Open questions for user
- Is sign-in-while-unverified intentional (overriding §2.1 "required before first sign-in")?
- Should `/auth/*` get the §6.8 10/min-per-IP limiter inside M0b, or is it deferred?
- Are TOTP recovery codes in scope (redemption flow), or should generation be removed?
- Confirm a `loginResponseSchema` union belongs in M0a/M0b shared before M0c/M0d consume it.
