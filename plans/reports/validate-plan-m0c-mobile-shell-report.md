# Validation report — M0c Mobile Shell + Mobile Mockup Prototype

Plans validated (greenfield; no codebase cross-check):
- `docs/superpowers/plans/2026-05-24-m0c-mobile-shell.md`
- `docs/superpowers/plans/2026-05-24-mobile-mockup-prototype.md`

Spec refs: `2026-05-23-pantry-app-design.md` §2.1, §2.10, §6, §7, §8.2; `2026-05-24-mobile-mockup-design.md`.

---

## 1. M0c internal consistency

GOOD — symbol/file references are coherent forward and backward:
- `secureStore` (B1) consumed by client.ts (B3/B4), session-store (D1), theme store (C1/C3), sync (C3).
- `ApiError`/`isApiError` (B2) consumed by client, query-client, all screens.
- `apiClient` + `setOnSignOut` (B3/B4) wired by `wireApiClient` (D2), invoked in root layout (F1).
- `useThemeStore`/`initThemeStore` (C1) consumed by ThemeProvider (C2), settings/theme (I2), root layout (F1).
- `authEndpoints`/`meEndpoints` (B6) consumed by sync (C3), passkey (G3), all auth screens (H2–H6).
- Self-review checklist (lines 3889–3904) is accurate against the body.

Route tree vs spec §7.2: consistent for what M0c builds — `app/_layout.tsx`, `(auth)/{welcome,sign-in,sign-up,verify-email,forgot-password,reset-password}`, `(app)/_layout.tsx`, `(app)/(tabs)/{home,browse,reviews,profile}`, `(app)/settings/theme.tsx`. M0c ADDS `reset-password.tsx` (not in spec §7.2 list, but required by §2.1 reset flow — correct expansion). M0c DEFERS `scan.tsx`, `record/[id]`, `product/[id]`, `product/[id]/review`, `settings/index|notifications|account` to M1/M2 (documented).

Theme provider vs §2.10/§7.5: consistent — 4 themes, `useTheme()` Zustand-backed, 200ms cross-fade (`theme.animation.themeSwitch`, F=C2), secure-store persist (C1) + `PATCH /v1/me` sync (C3). `useThemeSwitcher()` also exported.

INCONSISTENCIES found:
- **(minor) verify-email route call style mismatch.** Sign-up (H2) does `router.replace('/(auth)/verify-email')`; sign-in `email_not_verified` (H3) and deep-link handler (F1) do `router.push(...)`. Both resolve to the same route; not a bug, just inconsistent navigation semantics. The H2 test asserts `replace`, H3 test asserts `push` — internally consistent with their own code.
- **(minor) tailwind.config.js requires a `.ts` file via CommonJS** (`require('./src/theme/tailwind-tokens.ts')`, A3). Node `require` of a raw `.ts` file will not work without a TS loader; metro/babel won't help the tailwind config eval at build time. Likely needs ts-node/register or compiling tokens to JS. Flag for implementer.
- **(observation) refresh single-flight uses `setTimeout(...,0)` to clear `refreshInFlight`** (B4). The "concurrent" test passes because both initial 401s resolve before the timer, but in real runtime two requests that 401 in separate ticks after the timer fires could each trigger a refresh. Test gives false confidence about true concurrency. See risks.

---

## 2. Spec coverage (auth flow UI §7.3) + deferrals

COVERED by M0c: welcome (H1), sign-up + email verify trigger (H2), sign-in password (H3), verify-email + resend (H4), forgot-password (H5), reset-password via deep link (H6), Google (G1+H3), Apple iOS-gated (G2+H3), passkey (G3+H3). Tokens in expo-secure-store (B1). Full theme switcher (C1–C3, I2).

DEFERRED by M0c (all explicitly claimed):
- WatermelonDB models + sync engine → M1 (`apps/mobile/src/db/`). NOTE: tech-stack line installs WatermelonDB in M1, NOT M0c (handoff line 3910). Stack list line 9 parenthetical confirms.
- Scan camera flow, OCR → M1 (`app/(app)/scan.tsx`).
- Push notifications + `me/push-token` → M1.
- Country auto-detection on first launch → M1.
- Reviews/votes/product UI → M2 (`reviews.tsx`, `product/[id].tsx`).
- Polished per-screen UI for Bento/Soft Clay/Material You → M4 (provider works for all 4; only Aurora screens polished).
- EAS production profile, store submission → M4.

GAPS / partial:
- **Passkey REGISTRATION not covered.** Spec §6.1 lists `/auth/passkey/register/options` + `/verify`; §2.1 wants linking passkey to an existing account. M0c only wires passkey LOGIN (`passkeyLoginOptions`/`passkeyLoginVerify`, B6+G3). No passkey enrollment UI/endpoint. Not explicitly deferred — unstated gap. (Account-linking UI is M-later per mockup screen 23 being visual-only, but no plan explicitly claims passkey register.)
- **Apple Sign-In availability vs App Store policy.** Implemented iOS-only gated, fine. No issue.
- **`verify-email` is a tappable email link**, but the in-app `GET /auth/verify-email?token=` consumption is only partially handled: the screen shows a message but does not POST the token to verify on-device (H4 only resends; deep-link routes to the screen with token param but screen ignores it for verification). Likely fine if verification is link-in-browser, but the deep-link path implies in-app handling that isn't wired. Flag.

---

## 3. CONSUMES list (VERBATIM upstream assumptions — CRITICAL, cross-check vs M0a/M0b)

### 3a. Git-tag / milestone prerequisites
- Line 13: "M0a complete (`@pantry/shared` and `@pantry/theme` packages exist; tags exist) and M0b complete (all `/v1/auth/*` and `PATCH /v1/me` endpoints exist)."
- A1 Step 1: assumes `pnpm-workspace.yaml` already includes `"apps/*"` (set in M0a).
- A1 Step 4: assumes `../../tsconfig.base.json` exists (M0a).
- J3: "M0a does NOT ship `.github/workflows/ci.yml` — M0c creates it from scratch." (asserted prerequisite that the file is absent).
- Checklist line 3900: schema imports "all real exports from `@pantry/shared` per M0a Task B2."

### 3b. API base URL + path convention
- Client prepends `/v1` to every path; base URL from `expo-constants` `extra.apiBaseUrl` (default `http://localhost:4000`). So effective calls = `${base}/v1${path}`.
- Paths passed WITHOUT `/v1` prefix (client adds it).

### 3c. Exact endpoint paths M0c calls (from B6 endpoints.ts + B4 refresh + C3 sync), all under `/v1`:
- `POST /v1/auth/register`  (body = `RegisterInput`; expects `AuthResult`)
- `POST /v1/auth/login`     (body = `LoginInput`; expects `AuthResult | TotpChallenge`)
- `POST /v1/auth/refresh`   (body `{ refreshToken }`; expects `Tokens` / `RefreshResponse`)
- `POST /v1/auth/logout`
- `GET  /v1/auth/me`        (NOTE: endpoints.ts `me()` calls `/auth/me`; spec §6.1 has `GET /auth/me` — OK)
- `POST /v1/auth/resend-verification`   (body `{ email }`)
- `POST /v1/auth/forgot-password`       (body `{ email }`)
- `POST /v1/auth/reset-password`        (body `{ token, password }`)
- `POST /v1/auth/oauth/google`          (body `{ idToken }`)
- `POST /v1/auth/oauth/apple`           (body `{ identityToken, firstName?, lastName? }`)
- `POST /v1/auth/passkey/login/options` (body `{ email? }`)
- `POST /v1/auth/passkey/login/verify`  (body `{ assertionResponse }`)
- `PATCH /v1/me`            (body `{ themePreference }` for theme sync; meEndpoints.update takes `UpdateProfile`)

### 3d. Login / refresh / TOTP response SHAPES M0c expects (cross-check critical):
- **Login success / register / oauth** → `AuthResult` = `{ user: User, tokens: Tokens }` (session-store D1 destructures `{ user, tokens }`).
- **Tokens** = `{ accessToken: string, refreshToken: string, expiresIn: number }` (camelCase). Refresh path (B4) reads `data.accessToken`/`data.refreshToken`.
- **TOTP challenge** (endpoints.ts B6) = `{ requiresTotp: true, challengeToken: string }` (camelCase). Sign-in (H3) branches on `'requiresTotp' in result`.
  - **CONFLICT TO CHECK:** spec §8.2 says login returns **`requires_totp: true`** (snake_case) + "one-time challenge token". M0c assumes camelCase `requiresTotp`/`challengeToken`. M0a/M0b MUST emit camelCase or M0c TOTP detection silently fails (mobile would treat an admin challenge as a malformed AuthResult). Verify M0b serialization casing.
- **Error responses** → RFC7807 problem+json. M0c (client parseError B4) reads fields `{ code, status, title, detail, errors[] }`. Spec §6.8 RFC7807 fields = `type, title, status, detail, instance, code`. M0c does NOT read `type`/`instance` (OK) but RELIES on a stable top-level **`code`** and matches specific codes: `email_not_verified`, `invalid_credentials`, `email_already_registered`, `token_expired`, `invalid_token`. M0b MUST emit these exact `code` strings.
- **User shape** consumed (session-store/sign-up tests): `{ id, email, emailVerified, firstName, lastName, country, avatarUrl, role, status, themePreference, createdAt, updatedAt }` — all camelCase, `themePreference` enum `aurora|bento|clay|material`, `role` includes `'user'`, `status` includes `'active'`. M0a `@pantry/shared User` type MUST match this casing/fields.

### 3e. `@pantry/theme` exports M0c imports (cross-check):
- Named: `aurora` (with `.colors.{bg,bgElevated,bgGlass,border,text,textMuted,primary,primaryFg,accent,success,warning,danger}` and `.radii.{sm,md,lg,xl,pill}`) — tailwind-tokens.ts A3.
- `themes` (record keyed by ThemeId), `themeList` (array), type `Theme`, type `ThemeId` (`'aurora'|'bento'|'clay'|'material'`).
- `Theme` shape used: `.id`, `.name` (e.g. `'Aurora Glass'`, `'Soft Clay'`, `'Bento'`, `'Material You'`), `.colors.*`, `.radii.*`, `.scheme` (`'dark'|'light'`), `.animation.themeSwitch` (=200).
  - **CONFLICT TO CHECK:** spec §2.10/§7.5 says token key is **`animations`** (plural). M0c reads **`theme.animation.themeSwitch`** (singular). M0a `@pantry/theme` MUST expose `animation` (singular) with a `themeSwitch` member, OR M0c breaks at the cross-fade. Verify M0a key name.
  - Theme NAME strings asserted in tests: `'Aurora Glass'`, `'Soft Clay'`, `'Bento'`, `'Material You'`. (Spec calls #2 "Bento Grid"; M0c test expects `'Bento'`.) Verify M0a `theme.name` values match test literals or tests fail.

### 3f. `@pantry/shared` schemas/types M0c imports (cross-check):
- Zod schemas: `registerSchema`, `loginSchema`, `forgotPasswordSchema`, `resetPasswordSchema` (used by `fieldErrors`). M0a MUST export these exact names.
- Types: `AuthResult`, `LoginInput`, `RegisterInput`, `Tokens`, `User`, `UpdateProfile`. `UpdateProfile` MUST allow `{ themePreference }` (theme sync) — spec §6.6 `PATCH /me` lists first_name/last_name/country/avatar_url; theme_preference is in users table (§ line 210) but NOT in §6.6 PATCH field list. **CONFLICT TO CHECK:** M0c PATCHes `/v1/me` with `{ themePreference }`; M0b/M0a `UpdateProfile` schema MUST accept `themePreference` or the sync request is rejected by server-side validation.

---

## 4. PROVIDES manifest (what M1/M2 consume)

- **`apps/mobile/src/api/client.ts`** — `apiClient.{request,get,post,patch,delete}`; injects `Authorization: Bearer <access>` from secureStore; on 401 (non-`/auth/*`, not retrying, not skipAuth) refreshes ONCE via single-flight `refreshTokensOnce()` then replays; refresh failure → `clearAll()` + `onSignOut()`; non-2xx → throws typed `ApiError` (RFC7807 fields). `setOnSignOut(cb)` registration hook. Base URL via expo-constants, `/v1` auto-prefixed.
- **`apps/mobile/src/api/errors.ts`** — `ApiError {code,status,title,detail,errors[]}`, `isApiError()`.
- **`apps/mobile/src/api/query-client.ts`** — `createQueryClient()`: staleTime 30s, gcTime 5m, no retry on 4xx, 2 retries otherwise, mutations no-retry.
- **`apps/mobile/src/api/endpoints.ts`** — `authEndpoints.*`, `meEndpoints.update`, `TotpChallenge` type.
- **`apps/mobile/src/auth/secure-store.ts`** — `secureStore.{get,set}{AccessToken,RefreshToken,ThemePreference}`, `clearAll()`; theme-id runtime validation.
- **`apps/mobile/src/auth/session-store.ts`** — `useSessionStore` (Zustand: user, accessToken, refreshToken, hydrated, `signIn(AuthResult)`, `signOut()`, `setUser()`), `hydrateSession()`.
- **`apps/mobile/src/auth/wire-client.ts`** — `wireApiClient()` idempotent.
- **`apps/mobile/src/auth/{google,apple,passkey}.ts`** — `signInWithGoogle()`, `signInWithApple()`/`isAppleSignInAvailable()`, `signInWithPasskey()`.
- **`apps/mobile/src/theme/`** — `ThemeProvider`, `useTheme()`, `useThemeSwitcher()`, `useThemeStore`/`initThemeStore`, `syncThemeToServer()`, `tailwindTokens`.
- **`apps/mobile/src/components/`** — `Screen, Button, TextField, ErrorText, Card, GlassCard` (all token-driven).
- **`apps/mobile/src/lib/`** — `fieldErrors(schema,input)`, `parseAuthDeepLink(url)`.
- **Routing** — root `_layout.tsx` (providers + `AuthGate` redirecting unauth→`/(auth)/welcome`, auth→`/(app)/(tabs)/home`; `DeepLinkHandler`), `(auth)` stack, `(app)` stack + `(tabs)` tab navigator (4 tabs).
- **CI** — `.github/workflows/ci.yml` (typecheck + vitest on PR; nightly Maestro commented TODO).
- Tag `m0c-complete`.

---

## 5. Mockup prototype validation

Internally consistent and consistent with mockup design spec. 25 screens + nav hub built (Tasks 6–32). Shared CSS/JS foundation (Tasks 1–4) defines tokens/components used by every screen; component vocabulary matches design spec §8.179. Theme picker (Task 27) is the centerpiece, switches via `_themes.js` (Task 4), 200ms cross-fade in `_shared.css` — matches §7.

Deliberate spec deviations DOCUMENTED:
- **Relative URLs** instead of `/files/<file>` (plan line 17; design spec §3.46–47 uses `/files/`). Stated as deliberate for portability across companion / plain HTTP / `file://`.
- **Gitignored output dir** `.superpowers/brainstorm/68898-1779595911/content/` — prototype files never committed; per-task commits are `--allow-empty` plan-progress markers (lines 13, 2489).

DISCREPANCIES found in mockup:
- **(minor) Push-preview copy mismatch.** Design spec §6 screen 25 says "3 items expire today: **yogurt, bread, hummus**". Prototype Task 31 renders "**Yogurt, sourdough, hummus**" and Task 33.6 verification also checks "yogurt, sourdough, hummus". Internally self-consistent (plan+its own verify), but DIVERGES from design spec wording (bread→sourdough). Trivial but flag — the per-screen task silently changed spec copy.
- **(observation) Screen 21 cross-fade fidelity.** `_themes.js` only swaps `data-theme` on `<html>` and toggles `is-selected`. The four preview cards are hardcoded inline-style miniatures (not driven by `[data-theme]` vars), so the cards themselves don't re-theme — only the page chrome/Settings-behind does. This matches design spec §7 intent ("cards each a static miniature in that theme's tokens") — acceptable, but note the miniatures are literal hardcoded styles, not token-derived.

### Mockup ↔ real-app screen alignment (flag mismatches)

| Mockup screen | Real plan counterpart | Note |
|---|---|---|
| 01 welcome | M0c H1 | ✓ |
| 02 sign-up | M0c H2 | ✓ |
| 03 sign-in | M0c H3 | ✓ |
| 04 verify-email | M0c H4 | ✓ |
| 05 forgot-password | M0c H5 | ✓ |
| 06 reset-password | M0c H6 | ✓ (mockup has it; spec §7.2 omits — consistent w/ M0c addition) |
| 07 home | M0c I1 stub (M1 fills) | ✓ shell only in M0c |
| 08 browse | M0c I1 stub (M1) | ✓ |
| 09 reviews | M0c I1 stub (M2) | ✓ |
| 10 profile | M0c I1 | ✓ |
| 11 fab-sheet | M1 | no M0c/M0c counterpart (deferred) |
| 12 scan | M1 | deferred |
| 13 scan-result | M1 | deferred |
| 14 expiry-capture | M1 | deferred |
| 15 manual-entry | M1 | deferred |
| 16 record-detail | M1 (`record/[id]`) | deferred |
| 17 product-detail | M2 (`product/[id]`) | deferred |
| 18 write-review | M2 (`product/[id]/review`) | deferred |
| 19 report-modal | M2/later (reports) | deferred |
| 20 settings (index) | NOT in M0c; spec §7.2 `settings/index.tsx` | M0c builds only `settings/theme.tsx`; settings index deferred (no plan explicitly claims it — gap) |
| 21 theme-picker | M0c I2 `settings/theme.tsx` | ✓ (real-app uses 4-card grid, not bottom sheet — visual diff, OK) |
| 22 notifications | spec §7.2 `settings/notifications.tsx` → M1 (push) | deferred |
| 23 account | spec §7.2 `settings/account.tsx` → later | deferred; mockup notes visual-only linked accounts |
| 24 empty-home | M1 (first-scan tutorial) | deferred |
| 25 push-preview | M1 (push) | deferred; mockup-only artifact |

No mockup screen lacks an eventual real-app home EXCEPT it's worth noting **settings/index (screen 20)** and **passkey-register** have no explicit owning plan in the M0c handoff or visible M1/M2 claims here — flag for the orchestrator to confirm a later milestone claims `settings/index.tsx` and passkey enrollment.

---

## 6. Top risks & decision points (brutal)

1. **Casing contract M0a/M0b ↔ M0c (HIGH).** Three concrete camelCase-vs-snake_case landmines: (a) TOTP `requiresTotp`/`challengeToken` vs spec §8.2 `requires_totp`; (b) theme token key `animation` (singular, M0c) vs spec `animations` (plural); (c) `UpdateProfile` must accept `themePreference` though §6.6 PATCH field list omits it. Plus error `code` strings must match exactly. If M0a/M0b serialize snake_case or use plural `animations`, M0c compiles but fails at runtime silently (TOTP misrouted, cross-fade crash, theme-sync 400). MUST reconcile before M0c executes.

2. **tailwind.config.js `require('...tailwind-tokens.ts')` (HIGH).** CommonJS `require` of a `.ts` source at config-eval time has no TS transpiler in scope. Likely build break on first `expo start`/metro bundle. Needs ts-node/register, a `.js` token file, or inlining. Smoke-check A3 is only `typecheck`, which won't catch the runtime require.

3. **API client refresh single-flight race (MEDIUM).** `refreshInFlight` cleared via `setTimeout(0)`; the passing concurrency test queues both 401s before the timer, masking the real race where requests 401 in later ticks and each spawn a refresh (token-rotation thrash, possible refresh-token invalidation cascade since refresh rotates). Recommend clearing `refreshInFlight` synchronously in the promise body (await-chain dedup) rather than via timer.

4. **Expo SDK / dependency version pinning (MEDIUM).** package.json pins Expo `^51.0.0`, RN `0.74.5`, `newArchEnabled: true`. Loose carets on Expo-family packages risk version skew vs the SDK51 expected set; `expo install --check` / `expo-doctor` not in the plan. New Architecture + react-native-reanimated 3.10 + NativeWind 4 is a known-fragile combo. Pin via SDK-aligned versions and run expo-doctor.

5. **Social/passkey native config is placeholder (MEDIUM).** `iosUrlScheme: 'com.googleusercontent.apps.PLACEHOLDER'`, `passkeyRpId` default `localhost`, Google client IDs from env. Passkey RP ID `localhost` won't work on device; Apple needs entitlement + real bundle id; Google needs real OAuth client + URL scheme + (Android) SHA-1. None provisioned in M0c — E2E (J1 Maestro) and any real social login are non-functional until credentials land. Plan defers EAS production to M4 but social config gap is not called out as a blocker for the J1 happy-path.

6. **(LOW) Mockup output gitignored.** Deliberate (design spec §3), but means CI/teammates can't see prototype; `--allow-empty` commits carry no artifact. Acceptable for a throwaway prototype; just confirm reviewers know to regenerate locally.

7. **(LOW) Passkey registration + settings/index unowned.** No plan in scope explicitly claims passkey enrollment UI/endpoints or `settings/index.tsx`. Confirm a later milestone owns them.

---

## CONSUMES quick-reference (the contract to cross-check)
- Tags/pkgs: `@pantry/shared`, `@pantry/theme` exist w/ M0a tags; `pnpm-workspace.yaml` has `apps/*`; `tsconfig.base.json` exists; `.github/workflows/ci.yml` absent.
- Endpoints (all `/v1`): register, login, refresh, logout, auth/me, resend-verification, forgot-password, reset-password, oauth/google, oauth/apple, passkey/login/{options,verify}, PATCH /me.
- Shapes: `AuthResult={user,tokens}`; `Tokens={accessToken,refreshToken,expiresIn}`; TOTP `{requiresTotp,challengeToken}` (vs spec snake_case!); RFC7807 `{code,status,title,detail,errors}` with codes email_not_verified/invalid_credentials/email_already_registered/token_expired/invalid_token; `User` camelCase incl `themePreference`,`role`,`status`.
- `@pantry/theme`: `aurora`,`themes`,`themeList`,`Theme`,`ThemeId`; `Theme.{id,name,colors.*,radii.*,scheme,animation.themeSwitch}` (singular `animation` vs spec plural!); names `'Aurora Glass'|'Soft Clay'|'Bento'|'Material You'`.
- `@pantry/shared`: `registerSchema,loginSchema,forgotPasswordSchema,resetPasswordSchema`; types `AuthResult,LoginInput,RegisterInput,Tokens,User,UpdateProfile` (UpdateProfile must accept themePreference).

---
Status: DONE_WITH_CONCERNS
Summary: Plans are internally coherent and faithful to spec scope, but M0c's CONSUMES contract has 3 casing/shape mismatches against the spec (TOTP snake_case, `animation` vs `animations`, `themePreference` not in §6.6 PATCH list) plus a likely tailwind-config `.ts` require break — all must be reconciled with actual M0a/M0b outputs before execution.
