# Red Team Review Report: Security Adversary & Adversarial Analysis

**Plan:** `plans/260825-0815-usernameless-passkey-login/`
**Target:** Usernameless 1-Tap Passkey Login
**Date:** 2026-08-25

---

## Finding 1: Missing Credential ID Normalization on Lookup in Passkey Login Verify
- **Severity:** High
- **Location:** Phase 1, section "Usernameless Assertion Verification"
- **Flaw:** `passkey-register.ts` normalizes credential IDs to unpadded base64url (`normalizeCredentialId`), but `passkey-login.ts` directly queries `authCredential.providerUserId` using `r.id` without normalization.
- **Failure scenario:** If an authenticator or client library returns standard base64 (containing `+`, `/`, `=`) instead of unpadded base64url, `prisma.authCredential.findUnique` returns `null` and throws `Unknown passkey` (401), locking out legitimate users.
- **Evidence:** `api/src/routes/auth/passkey-login.ts:46-48` vs `api/src/routes/auth/passkey-register.ts:7-20`.
- **Suggested fix:** Apply `normalizeCredentialId(r.id)` before database lookup in `passkey-login.ts`.

## Finding 2: Challenge Replay Window if Assertion Verification Fails
- **Severity:** High
- **Location:** Phase 1, section "Functional Requirements"
- **Flaw:** In `consumeAuthentication`, Redis challenge keys are only deleted *after* `verifyAuthenticationResponse` successfully verifies the signature. If verification throws or fails, the challenge remains alive in Redis until its 5-minute TTL expires.
- **Failure scenario:** An attacker who observes or causes a failed verification attempt can reuse the same challenge within the 5-minute window for subsequent attempts.
- **Evidence:** `api/src/services/auth/passkey.ts:177-194`.
- **Suggested fix:** Ensure challenge keys in Redis are deleted immediately upon retrieval (or inside a `finally` block), enforcing strict single-use semantics regardless of verification outcome.

## Finding 3: Mobile APK Hash Origin Missing from Expected Origins
- **Severity:** Critical
- **Location:** Phase 1, section "Non-Functional Requirements"
- **Flaw:** Android native passkey assertions produce `clientDataJSON.origin` of format `android:apk-key-hash:<sha256-hash>`. If the backend configuration only lists HTTPS web origins, `@simplewebauthn/server` rejects all Android native passkey assertions.
- **Failure scenario:** Every native Android passkey login fails with `Unexpected origin` error during assertion verification.
- **Evidence:** `api/src/services/auth/passkey.ts:183` (`expectedOrigin: cfg.webauthn.origins`).
- **Suggested fix:** Explicitly document and verify in Phase 1 that `webauthn.origins` in server configuration includes `android:apk-key-hash:...` for release and debug keystores.

## Finding 4: Stripping `authenticatorAttachment` Breaks Older FIDO2 Play Services
- **Severity:** High
- **Location:** Phase 2, section "Streamlined Passkey Service"
- **Flaw:** `sanitizeCreateOptions` in `apps/mobile/src/auth/passkey.ts` was deleting `authenticatorAttachment`. Older Google Play Services FIDO implementations (pre-Android 14) default to roaming/hybrid credentials when attachment is omitted, rather than storing the passkey in Google Password Manager.
- **Failure scenario:** Users on Android 10-13 register a passkey, but it is not stored as a discoverable platform key, causing subsequent 1-tap login to fail with `NoCredentials`.
- **Evidence:** `apps/mobile/src/auth/passkey.ts:29`.
- **Suggested fix:** Retain `authenticatorAttachment: 'platform'` in `sanitizeCreateOptions` so all Android versions route to Google Password Manager.

## Finding 5: Incomplete Cancellation Exception Matching in React Native
- **Severity:** High
- **Location:** Phase 2, section "Cancellation & Error Handling"
- **Flaw:** Android Credential Manager and iOS ASAuthorizationController use different exception types for cancellation (`androidx.credentials.exceptions.GetCredentialCancellationException`, `UserCancelled`, `Canceled`, `NotAllowedError`).
- **Failure scenario:** Dismissing the native sheet on Android triggers an unhandled rejection, presenting a red "Request Failed" banner instead of a mild notice.
- **Evidence:** `apps/mobile/src/auth/passkey.ts:45-88` and `apps/mobile/app/(auth)/sign-in.tsx:129-131`.
- **Suggested fix:** Implement a comprehensive `isPasskeyCancellation(e)` utility checking for all platform-specific cancellation identifiers.

## Finding 6: Rapid Double-Tap Race on "Use a passkey"
- **Severity:** Medium
- **Location:** Phase 2, section "1-Tap Passkey Sign-In"
- **Flaw:** React's asynchronous `setLoading(true)` allows rapid double-tapping on the passkey button to invoke `Passkey.get()` twice concurrently, throwing `GetCredentialInProgressException` on Android.
- **Failure scenario:** User quickly double-taps button, causing the second invocation to immediately fail and show an error.
- **Evidence:** `apps/mobile/app/(auth)/sign-in.tsx:113-115`.
- **Suggested fix:** Use an immediate mutable `inFlightRef` guard in `onPasskey()`.
