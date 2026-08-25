---
phase: 1
title: "Backend Passkey Options & WebAuthn Hardening"
status: pending
priority: P1
dependencies: []
---

# Phase 1: Backend Passkey Options & WebAuthn Hardening

<!-- Updated: Validation Session 1 - Optional email filter hint and discoverable options -->
<!-- Updated: Red Team Review - Credential ID normalization, strict single-use challenge cleanup, and Android APK hash origin verification -->

## Overview
Ensure the backend API fully implements the WebAuthn Level 2/3 discoverable credential standard for passkeys. This guarantees that registered passkeys are stored as discoverable resident keys in platform authenticators (Google Password Manager, Apple iCloud Keychain) and that authentication options and assertion verification work seamlessly without requiring prior email identification, while supporting an optional email filter hint.

## Requirements

### Functional Requirements
- **Discoverable Registration (`buildRegistrationOptions`)**:
  - Configure `authenticatorSelection` with `residentKey: 'required'`, `requireResidentKey: true`, and `authenticatorAttachment: 'platform'`.
  - Maintain `supportedAlgorithmIDs: [-7, -257]` (ES256, RS256) for broad Android/iOS platform support.
  - Set `user.id` to a stable binary user ID (`TextEncoder().encode(userId)`), `userName` to user email, and `userDisplayName` to sanitized full name.
- **Usernameless Login Options (`POST /v1/auth/passkey/login/options`)**:
  - Accept request body with or without `email` (`{ email?: string }`).
  - When `email` is absent (empty body `{}`), generate challenge with omitted/undefined `allowCredentials` (allowing client authenticator to discover all credentials belonging to `rpId`).
  - When `email` is present, look up user credentials and include them in `allowCredentials` as an optional filter hint.
  - Store the issued challenge in Redis with key `passkey:challenge:login:chal:<challenge>` with TTL of 300 seconds (5 minutes).
  - Also maintain tracking `passkey:challenge:login:anon:<ip>` or `passkey:challenge:login:user:<userId>`.
- **Usernameless Assertion Verification (`POST /v1/auth/passkey/login/verify`)**:
  - Extract credential `id` from client assertion payload and normalize using `normalizeCredentialId(r.id)` (base64url without padding) before database lookup.
  - Query `authCredential` where `type = 'passkey'` and `providerUserId = normalizedId`.
  - Retrieve the associated `user` record and ensure status is `'active'`.
  - In `consumeAuthentication`, retrieve the challenge from Redis via `chal:<challenge>` extracted from `clientDataJSON` (or `user:<id>` if available).
  - **Strict Single-Use Challenge Cleanup**: Ensure the Redis challenge keys are deleted immediately inside a `finally` block or right after retrieval, preventing challenge replay attacks even if verification throws an error.
  - Verify cryptographic assertion signature using `@simplewebauthn/server` against the stored `cred.publicKey` and `cred.counter`.
  - Update `authCredential` record with `counter = info.newCounter` and `lastUsedAt = new Date()`.
  - Issue access token and refresh session for the authenticated user.

### Non-Functional Requirements
- **Security**: Strict single-use challenge consumption, base64url credential ID normalization, and rate limiting per IP on options endpoint.
- **Origins Configuration**: Ensure `webauthn.origins` in server configuration (`getConfig().webauthn.origins`) includes both HTTPS web origins and Android native APK hash origins (`android:apk-key-hash:...`) so assertions from the mobile app are verified without origin mismatch errors.
- **Performance**: Challenge lookup in Redis ≤ 5ms; verification database query indexed on `(type, providerUserId)`.

## Architecture & Code Changes

```
┌─────────────────────────────────────────────────────────────┐
│ Fastify Server: /v1/auth/passkey                            │
├──────────────────────────────┬──────────────────────────────┤
│ POST /login/options          │ POST /login/verify           │
│                              │                              │
│ • Validate body (email opt)  │ • Parse assertionResponse    │
│ • If no email -> allowCred=[]│ • Normalize credential id    │
│ • If email -> allowCred=[ids]│ • Look up AuthCredential by  │
│ • generateAuthenticationOpts │   providerUserId (base64url) │
│ • Store in Redis:            │ • Delete Redis chal (finally)│
│   chal:<challenge> -> chal   │ • Verify with SimpleWebAuthn │
│ • Return options             │ • Check android:apk-key-hash │
│                              │ • Update counter & lastUsed  │
│                              │ • Issue JWT Tokens & Session │
└──────────────────────────────┴──────────────────────────────┘
```

## Related Code Files
- Modify: `api/src/services/auth/passkey.ts`
- Modify: `api/src/routes/auth/passkey-login.ts`
- Modify: `api/src/routes/auth/passkey-register.ts`
- Verify: `packages/shared/src/schemas/auth.ts`

## Implementation Steps
1. **Update `api/src/services/auth/passkey.ts`**:
   - In `buildRegistrationOptions`, configure `residentKey: 'required'`, `requireResidentKey: true`, and `authenticatorAttachment: 'platform'`.
   - In `buildAuthenticationOptions`, ensure `allowCredentials` is completely omitted when `allowedCredIds` is empty.
   - In `consumeAuthentication`, delete Redis challenge keys inside a `finally` block or immediately upon retrieval to eliminate any replay window on failed attempts.
2. **Update `api/src/routes/auth/passkey-login.ts`**:
   - Import `normalizeCredentialId` and normalize `r.id` before `prisma.authCredential.findUnique`.
   - Ensure `POST /passkey/login/options` handles empty/absent body gracefully without throwing validation error.
3. **Verify shared schemas & config**:
   - Check `packages/shared/src/schemas/auth.ts` to confirm `passkeyLoginOptionsSchema` allows `email: emailField.optional()`.
   - Verify `webauthn.origins` handles mobile `android:apk-key-hash:...` origins.

## Success Criteria
- [ ] `POST /v1/auth/passkey/login/options` returns valid challenge when invoked with `{}`.
- [ ] `POST /v1/auth/passkey/login/options` returns filtered credentials when invoked with `{ email: "user@example.com" }`.
- [ ] Redis challenge key is strictly single-use and deleted even if assertion signature verification fails.
- [ ] Credential IDs with base64 padding/symbols normalize correctly and look up active passkeys.
- [ ] `POST /v1/auth/passkey/register/options` generates options specifying `residentKey: 'required'`.
- [ ] `POST /v1/auth/passkey/login/verify` successfully verifies discoverable passkey assertions from both web and Android APK hash origins.

## Risk Assessment
- **Risk**: Android APK hash origin mismatch between debug and release builds.
  - **Mitigation**: Add both debug keystore and release keystore APK hashes to `webauthn.origins` or config array.
