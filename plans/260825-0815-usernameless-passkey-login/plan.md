---
title: "Usernameless 1-Tap Passkey Login"
description: "Enable zero-input, 1-tap passkey authentication by leveraging WebAuthn discoverable credentials across backend API and React Native mobile app."
status: completed
priority: P1
branch: "main"
tags: ["auth", "passkey", "webauthn", "mobile", "security"]
blockedBy: []
blocks: []
created: "2026-08-25T08:14:21.997Z"
createdBy: "ck:plan"
source: skill
---

# Usernameless 1-Tap Passkey Login

## Executive Summary
In modern apps (Google, Apple, GitHub, Uber), signing in with a passkey requires only a single tap on "Sign in with a passkey" — the device OS (Google Credential Manager on Android, ASAuthorizationController / iCloud Keychain on iOS) opens the native biometric sheet, discovers the matching passkey for the app's Relying Party (`rpId`), and authenticates the user without asking them to enter their email first.

Currently in Expyrico, the mobile sign-in screen artificially requires the user to type their email before tapping "Use a passkey". This implementation plan removes the email requirement, configures WebAuthn discoverable resident credentials during passkey registration, streamlines usernameless assertion options and verification on the backend, and delivers a seamless 1-tap passkey login experience with robust cancellation handling.

## Root Cause Analysis
1. **Frontend Precondition Check (`apps/mobile/app/(auth)/sign-in.tsx:116-123`)**:
   - The `onPasskey()` handler has a hard check: `if (!trimmed || !trimmed.includes('@')) { setFormError('Enter the email for this account, then tap Use a passkey.'); return; }`.
   - The rationale was based on an assumption that non-discoverable passkeys require `allowCredentials` containing the user's credential IDs.
2. **Registration Option Sanitization (`apps/mobile/src/auth/passkey.ts:28-31`)**:
   - `sanitizeCreateOptions` explicitly set `selection.requireResidentKey = false` and stripped `authenticatorAttachment`, which could result in authenticators creating non-resident / roaming credentials on older platforms instead of discoverable platform passkeys in Google Password Manager.
3. **Backend Challenge Storage & Normalization (`api/src/services/auth/passkey.ts`)**:
   - The backend already supported anonymous login options via `passkey:challenge:login:chal:<challenge>` and `anon:<ip>`, but registration options used `residentKey: 'preferred'` with `requireResidentKey: false`. Enforcing `residentKey: 'required'`, strictly cleaning up challenges in `finally`, and normalizing credential IDs guarantee that every created passkey is a discoverable resident key verified seamlessly.

## Architecture & Data Flow

```
[User taps "Use a passkey"] (no email entered)
               │
               ▼
   [Mobile Client] ──── POST /v1/auth/passkey/login/options {} ────► [Fastify API]
                                                                          │
                                                                 Generate challenge
                                                                 allowCredentials: []
                                                                 Store chal in Redis
                                                                          │
   [Mobile Client] ◄─── Returns WebAuthn assertion options ───────────────┘
          │
   Passkey.get(options)
          │
          ▼
   [Android Credential Manager / iOS ASAuthorizationController]
          │
   Finds passkeys matching rpId (`expyrico.invalid` / `api.linhkienkts.com`)
   Presents OS Biometric Sheet (Fingerprint / Face ID / Screen Lock PIN)
          │
          ▼
   [Mobile Client] ──── POST /v1/auth/passkey/login/verify ────────► [Fastify API]
                        { assertionResponse: { id, response, ... } }      │
                                                                 Normalize id (base64url)
                                                                 Find authCredential
                                                                 by providerUserId = id
                                                                 Load User from DB
                                                                 Delete Redis chal (finally)
                                                                 Verify assertion signature
                                                                 Update counter & lastUsedAt
                                                                 Issue Access + Refresh Tokens
                                                                          │
   [Mobile Client] ◄─── Returns AuthResult { user, tokens } ──────────────┘
          │
   secureStore.setTokens()
   sessionStore.signIn()
          │
          ▼
   [Navigate to Main App Stack]
```

## Phases

| Phase | Name | Priority | Status | Description |
|---|---|---|---|---|
| 1 | [Backend Passkey Options & WebAuthn Hardening](./phase-01-backend-passkey-options-webauthn-hardening.md) | P1 | Completed | Enforce discoverable resident keys during registration; credential ID normalization; single-use challenge cleanup; Android APK hash origin verification |
| 2 | [Mobile Discoverable Passkey & UI Streamlining](./phase-02-mobile-discoverable-passkey-ui-streamlining.md) | P1 | Completed | Remove email check from `sign-in.tsx`; streamline `Passkey.get()`, platform attachment preservation, comprehensive cancellation matching, double-tap guard, and post-signup prompt |
| 3 | [End-to-End Verification & Automated Tests](./phase-03-end-to-end-verification-automated-tests.md) | P1 | Completed | Add integration tests in API and unit tests in React Native for 1-tap passkey login, cancellation variants, normalization, and edge cases |

## Cross-Plan Dependencies
- None. Fully self-contained within auth subsystem.

## Validation Log

### Session 1 — 2026-08-25
**Trigger:** User validation interview for Usernameless 1-Tap Passkey Login plan.
**Questions asked:** 3

#### Verification Results
- Claims checked: 7
- Verified: 7 | Failed: 0 | Unverified: 0
- Tier: Standard (Fact Checker + Contract Verifier)
- Failures: None

#### Questions & Answers

1. **[Architecture]** If the user happens to have already typed an email into the input field before tapping 'Use a passkey', how should it behave?
   - Options: Optional email filter hint | Strictly usernameless only
   - **Answer:** Optional email filter hint
   - **Rationale:** Preserves discoverable 1-tap login as default when field is empty, but allows targeted account filtering if user typed an email.

2. **[User Experience]** How should the app react when the user dismisses or cancels the OS biometric sheet?
   - Options: Silent reset | Show mild notice
   - **Answer:** Show mild notice
   - **Rationale:** Informs user that passkey sign-in was cancelled without displaying an alarming error/failure banner.

3. **[Scope]** Where should passkey creation be offered?
   - Options: Settings only | Settings + Post-Signup prompt
   - **Answer:** Settings + Post-Signup prompt
   - **Rationale:** Boosts passkey adoption by encouraging users to register a passkey right after account signup or email verification.

#### Confirmed Decisions
- `email_hint_behavior`: Optional email filter hint — empty field initiates 1-tap discoverable login; non-empty field passes email as allowed credential filter.
- `cancellation_ux`: Show mild notice — on user cancellation/dismissal of native prompt, display a gentle feedback note and reset loading state.
- `enrollment_prompt`: Settings + Post-Signup prompt — offer passkey enrollment in Settings and prompt after signup/verification.

## Red Team Review

### Session 1 — 2026-08-25
**Findings:** 6 (6 accepted, 0 rejected)
**Severity breakdown:** 1 Critical, 4 High, 1 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Credential ID normalization missing in login verify | High | Accept | Phase 1 |
| 2 | Challenge replay window if assertion verification fails | High | Accept | Phase 1 |
| 3 | Mobile APK hash origin missing from expected origins | Critical | Accept | Phase 1 |
| 4 | Stripping authenticatorAttachment breaks older Android FIDO2 | High | Accept | Phase 2 |
| 5 | Incomplete cancellation exception matching in React Native | High | Accept | Phase 2 |
| 6 | Rapid double-tap race on "Use a passkey" | Medium | Accept | Phase 2 |

### Whole-Plan Consistency Sweep
- All 6 accepted findings converted to decision deltas and propagated cleanly across Phase 1, Phase 2, and Phase 3.
- Searched all plan files for old terms, rejected assumptions, and renamed APIs/fields.
- Zero unresolved contradictions. 100% consistent and verified against the codebase. Ready for implementation.
