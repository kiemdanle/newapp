# Debug report: mobile login "Something went wrong"

Date: 2026-07-21  
Account tested: `dan9@babyponyshop.com`  
API: production VPS `https://api.linhkienkts.com`

## Executive summary

Login failed with generic **Something went wrong** because Android never baked `API_BASE_URL` into `BuildConfig`. `react-native-config` returned empty → `getBaseUrl()` threw a plain `Error('apiBaseUrl not configured')` → sign-in catch mapped it to the generic message.

After wiring `dotenv.gradle` + enabling `buildConfig`, and setting `API_BASE_URL=https://api.linhkienkts.com`, login reaches production and succeeds (home: **Your pantry**).

## Root cause

1. **Code defect (primary):** `apps/mobile/android/app/build.gradle` never applied `react-native-config`'s `dotenv.gradle`, and AGP 8 had `buildConfig` disabled by default. Result: `com.expyrico.app.BuildConfig` had no env fields; `Config.API_BASE_URL` was undefined.
2. **Config content:** `apps/mobile/.env` still had placeholder `https://api.expyrico.invalid` (unresolvable). User confirmed production host is `https://api.linhkienkts.com`.
3. **Environment (secondary, verification only):** emulator DNS was empty (IP worked, hostnames failed). Fixed by restarting AVD with `-dns-server 8.8.8.8,1.1.1.1`. Not an app code bug.

## Evidence

| Check | Result |
| --- | --- |
| UI before fix | `Something went wrong` on Sign in |
| `POST https://api.linhkienkts.com/v1/auth/login` (host curl) | `200` + tokens for test account |
| Pre-fix `BuildConfig.java` | no `API_BASE_URL` field |
| `getBaseUrl()` | throws plain `Error` when URL missing → not `ApiError` / not network TypeError |
| `handleApiError` else branch | sets `'Something went wrong'` |
| Post-fix `BuildConfig` | `API_BASE_URL = "https://api.linhkienkts.com"` |
| UI after fix + DNS fix | navigates to **Your pantry** / Home |

## Fix applied

File: `apps/mobile/android/app/build.gradle`

- `apply from: react-native-config android/dotenv.gradle` (default `.env` → `apps/mobile/.env`)
- `buildFeatures { buildConfig true }` so env fields land in `BuildConfig`

Local (gitignored) env:

- `apps/mobile/.env` → `API_BASE_URL=https://api.linhkienkts.com`

## Verification

1. Rebuild/install debug APK — `BUILD SUCCESSFUL`, env read from `.env`
2. Emulator DNS restart with public DNS
3. Automated UI login with provided credentials
4. Observed transition: Sign in → **Your pantry** / Home tabs

## Residual / follow-ups (not blockers for this login bug)

- FCM: `No Firebase App '[DEFAULT]'` — google-services not applied / no Firebase options in this build
- WatermelonDB JSI adapter warning under debugger/async fallback
- Emulator DNS: prefer always launching AVD with `-dns-server 8.8.8.8,1.1.1.1` for hostname APIs
- Optional: implement planned `src/config/runtime.ts` fail-fast schema (migration plan Task) so missing env fails at boot with a clear message

## Unresolved questions

- None for the reported login failure.
