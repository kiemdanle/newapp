---
phase: 2
title: "Mobile Discoverable Passkey & UI Streamlining"
status: pending
priority: P1
dependencies: [1]
---

# Phase 2: Mobile Discoverable Passkey & UI Streamlining

<!-- Updated: Validation Session 1 - Optional email hint, mild cancellation notice, and post-signup prompt -->
<!-- Updated: Red Team Review - Preserve platform attachment, comprehensive cancellation matching, and double-tap inFlight guard -->

## Overview
Remove the artificial email requirement from the mobile app's passkey login flow, streamline the interaction with native passkey authenticators via `react-native-passkey`, preserve platform attachment for older Android Play Services, prevent rapid double-tap race conditions, ensure clear and mild cancellation feedback when the user dismisses the biometric sheet, and add post-signup passkey enrollment prompts to boost adoption.

## Requirements

### Functional Requirements
- **1-Tap Passkey Sign-In (`onPasskey` in `sign-in.tsx`)**:
  - Tapping "Use a passkey" (`testID="sign-in-passkey"`) immediately triggers passkey authentication without requiring any text in the Email field.
  - If the user has already entered an email in the field, pass it as an optional hint to `signInWithPasskey(email?.trim() || undefined)`; if the field is empty, invoke `signInWithPasskey(undefined)` directly.
  - Remove the error guard `if (!trimmed || !trimmed.includes('@')) { setFormError(...); return; }`.
  - **In-Flight Double-Tap Guard**: Add an immediate mutable ref check `inFlightRef.current` to prevent rapid double-tapping from launching concurrent `Passkey.get()` requests (avoiding Android `GetCredentialInProgressException`).
- **Streamlined Passkey Service (`apps/mobile/src/auth/passkey.ts`)**:
  - In `sanitizeCreateOptions`: Preserve `residentKey: 'required'` / `'preferred'` and `authenticatorAttachment: 'platform'` so created credentials become discoverable passkeys in Google Password Manager across all Android versions.
  - In `sanitizeGetOptions`: Ensure `allowCredentials` is deleted when empty or undefined so native Credential Manager / ASAuthorizationController performs discoverable passkey discovery.
  - In `signInWithPasskey(email?: string)`: Make `email` an optional parameter. Call `authEndpoints.passkeyLoginOptions(email)`.
- **Comprehensive Cancellation & Error Handling**:
  - Implement `isPasskeyCancellation(e: unknown): boolean` checking for:
    - iOS: `UserCancelled`, `The operation was cancelled by the user`
    - Android: `androidx.credentials.exceptions.GetCredentialCancellationException`, `CreateCredentialCancellationException`, `Canceled`, `NotAllowedError`
  - On cancellation, display a mild, non-blocking notice (e.g. "Passkey sign-in cancelled") and reset `loading: false` without showing a destructive/red error banner.
  - On genuine errors (e.g. `NoCredentials`, invalid signature, network timeout), display actionable guidance.
- **Post-Signup Passkey Enrollment Prompt**:
  - Offer an optional prompt/banner upon completing signup / email verification: "Add a passkey for instant, passwordless sign-in next time".
  - Allow user to tap "Create a passkey" (which calls `registerPasskey()`) or "Skip for now".

### Non-Functional Requirements
- **User Experience**: Fast, frictionless 1-tap sign-in matching iOS and Android system standards.
- **Theme & Styling**: Adhere strictly to Expyrico palette (Fresh Sage `#4BAE8A`, Honey `#F5A623`, Almost Black `#2C2C28`, Mint Mist `#D6F0E6`).

## Architecture & Interaction Flow

```
[User on SignIn Screen]
           │
           │ (Taps "Use a passkey")
           ▼
   onPasskey()
   ├── Check inFlightRef.current (guard rapid double-taps)
   ├── Set inFlightRef.current = true, loading = true, formError = null
   ├── Call signInWithPasskey(email || undefined)
   │     ├── Fetch options from /v1/auth/passkey/login/options
   │     ├── Passkey.get(sanitizedOptions)
   │     │     │
   │     │     ├─► User cancels (GetCredentialCancellationException / UserCancelled)
   │     │     │   └─► Show mild notice ("Passkey sign-in cancelled"), reset loading
   │     │     │
   │     │     └─► Biometric verified -> Returns assertion
   │     │
   │     └── POST /v1/auth/passkey/login/verify
   │           └── Returns AuthResult { user, tokens }
   │
   ├── signIn(result) -> Session updated
   └── Navigation automatically transitions to App Stack
```

## Related Code Files
- Modify: `apps/mobile/app/(auth)/sign-in.tsx`
- Modify: `apps/mobile/src/auth/passkey.ts`
- Modify: `apps/mobile/src/api/endpoints.ts`
- Modify: `apps/mobile/app/(auth)/verify-email.tsx` (or post-signup prompt component)

## Implementation Steps
1. **Update `apps/mobile/src/auth/passkey.ts`**:
   - Implement `isPasskeyCancellation(e: unknown): boolean`:
     ```ts
     export function isPasskeyCancellation(e: unknown): boolean {
       if (!e || typeof e !== 'object') return false;
       const err = e as { error?: string; message?: string; code?: string };
       const str = `${err.error || ''} ${err.message || ''} ${err.code || ''}`.toLowerCase();
       return (
         str.includes('usercancelled') ||
         str.includes('canceled') ||
         str.includes('getcredentialcancellationexception') ||
         str.includes('createcredentialcancellationexception') ||
         str.includes('notallowederror') ||
         str.includes('operation was cancelled')
       );
     }
     ```
   - In `sanitizeCreateOptions`, retain `authenticatorAttachment: 'platform'` and do not overwrite `requireResidentKey`.
   - In `sanitizeGetOptions`, cleanly omit `allowCredentials` when absent.
   - Update `signInWithPasskey` signature to accept optional `email?: string`.
2. **Update `apps/mobile/app/(auth)/sign-in.tsx`**:
   - Add `inFlightRef = useRef(false)`.
   - Update `onPasskey()` to guard against double-taps and handle cancellations gracefully:
     ```ts
     async function onPasskey() {
       if (loading || inFlightRef.current) return;
       inFlightRef.current = true;
       setFormError(null);
       const trimmed = email.trim().toLowerCase();
       setLoading(true);
       try {
         const result = await signInWithPasskey(trimmed && trimmed.includes('@') ? trimmed : undefined);
         if (result) {
           await signIn(result);
         }
       } catch (e) {
         if (isPasskeyCancellation(e)) {
           setFormNotice('Passkey sign-in cancelled.');
           return;
         }
         handleApiError(e);
       } finally {
         inFlightRef.current = false;
         setLoading(false);
       }
     }
     ```
3. **Add Post-Signup Passkey Promotion**:
   - In `apps/mobile/app/(auth)/verify-email.tsx` or post-signup flow, offer a prompt to register a passkey immediately.

## Success Criteria
- [ ] Tapping "Use a passkey" without typing an email opens the OS passkey prompt immediately.
- [ ] If email is typed in the email field, it filters credentials accordingly.
- [ ] Rapid double-tapping does not cause unhandled concurrent request exceptions.
- [ ] Cancelling/dismissing the OS passkey prompt displays a mild notice and resets loading state cleanly without a red error banner.
- [ ] Created passkeys retain `authenticatorAttachment: 'platform'` and save to Google Password Manager on Android 10+.

## Risk Assessment
- **Risk**: Device has no passkeys configured or passkey provider unavailable.
  - **Mitigation**: `NoCredentials` error code from native layer is caught and transformed into a friendly message directing user to Google Password Manager / Apple iCloud Keychain or to sign in with password first.
