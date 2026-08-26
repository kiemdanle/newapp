---
phase: 2
title: "Backend API Routes & Services"
status: pending
priority: P1
dependencies: ["phase-01-data-model-shared-schemas.md"]
---

# Phase 2: Backend API Routes & Services
<!-- Updated: Red Team Review - Rate limiting, dual token refresh, strict MIME allowlist, and disk cleanup -->

## Overview
This phase implements the backend endpoints and services for updating user profiles, managing passwords (change, add, and set with brute-force rate limiting and seamless dual-token refresh), and processing avatar image uploads into high-resolution 512x512 WebP assets using Sharp with strict format validation and disk cleanup.

## Requirements

### Functional Requirements
1. **Profile Updates (`PATCH /me`)**:
   - Allow authenticated users to update `firstName`, `lastName`, `address`, `country`, `avatarUrl`, and `themePreference`.
   - Update database atomically and return fresh `toApiUser(user)`.
2. **Password Management (`PUT /me/password`)**:
   - **Rate Limiting Guard**: Apply a Redis-backed rate limiter (maximum 5 failed password attempts per 15-minute window per user/IP) to prevent brute-force attacks against `currentPassword`.
   - For users with an existing password (`user.passwordHash !== null`): verify `currentPassword` before accepting `newPassword`. Return 400 `invalid_current_password` on mismatch and record failure in rate limit tracker.
   - For passwordless users (registered via Google/Apple OAuth or Passkey): allow setting a `newPassword` directly without requiring `currentPassword`.
   - Hash `newPassword` using Argon2/Scrypt via `services/auth/passwords.ts`.
   - Create or upsert `AuthCredential` record with `type: 'password'`.
   - Increment `tokenVersion` to immediately invalidate all other devices and outstanding tokens.
   - Issue and return a fresh `{ tokens: { accessToken, refreshToken }, user }` payload in the response so the initiating mobile device refreshes its persistent credentials and stays seamlessly authenticated.
3. **Avatar Upload & Processing (`POST /me/avatar`)**:
   - Accept authenticated `multipart/form-data` upload.
   - **Strict MIME Allowlist**: Accept only `image/jpeg`, `image/png`, `image/heic`, and `image/webp`. Explicitly reject `image/svg+xml` (XSS vector) and `image/gif` (CPU exhaustion vector) with 415 `unsupported_media_type`.
   - Validate file size (max 5 MB) and maximum decoded dimensions.
   - Process image with Sharp: auto-orient, square crop center, encode to **512x512 display WebP** (`quality: 90`) and **128x128 thumb WebP** (`quality: 90`) for crisp rendering on high-DPI Retina/OLED mobile displays.
   - Persist to `<MEDIA_ROOT>/public/avatars/<userId>/<uuid>.webp`.
   - Formulate public CDN URL using `publicMediaUrl` and update `user.avatarUrl`.
   - **Disk Cleanup**: Immediately unlink or enqueue media cleanup for the previous avatar file on disk if one existed, preventing storage leaks.
4. **Avatar Removal (`DELETE /me/avatar`)**:
   - Clean up existing avatar file on disk.
   - Set `user.avatarUrl = null` in the database.
   - Return updated user object.

### Non-functional Requirements
- Image processing concurrency bounded to prevent memory saturation.
- Password operations must resist timing attacks on credentials verification.
- Avatar routes must enforce authentication (`app.requireAuth`).

## Architecture & Route Design

```
                     +---------------------------------------+
                     |         Fastify App Server            |
                     +---------------------------------------+
                                         |
     +-----------------------------------+-----------------------------------+
     |                                   |                                   |
     v                                   v                                   v
+-----------------------+     +-----------------------+     +-----------------------+
|  PATCH /me            |     |  PUT /me/password     |     |  POST /me/avatar      |
|  - Validate payload   |     |  - Check rate limit   |     |  - Multipart stream   |
|  - Update User table  |     |  - If exists: verify  |     |  - Strict MIME check  |
|  - Return toApiUser   |     |  - Hash new password  |     |  - Sharp 512px crop   |
|                       |     |  - Bump tokenVersion  |     |  - Unlink old avatar  |
|                       |     |  - Reissue dual tokens|     |  - Save public WebP   |
|                       |     |  - Return tokens+user |     |  - Update avatarUrl   |
+-----------------------+     +-----------------------+     +-----------------------+
```

## Related Code Files
- Modify: `api/src/routes/me/profile.ts`
- Create: `api/src/routes/me/password.ts`
- Create: `api/src/routes/me/avatar.ts`
- Modify: `api/src/routes/me/index.ts`
- Create: `api/src/services/media/avatar-processor.ts`
- Modify: `api/src/services/users/repository.ts`

## Implementation Steps
1. Create `api/src/services/media/avatar-processor.ts` with helper `processAvatarUpload({ sourceBuffer | sourceStream, userId })` that:
   - Validates MIME type against allowlist (`jpeg`, `png`, `heic`, `webp`), rejecting SVG/GIF.
   - Uses Sharp to inspect image dimensions.
   - Normalizes orientation and crops to a square.
   - Generates 512x512 WebP (`quality: 90`) for display and 128x128 WebP (`quality: 90`) for thumbnail.
   - Writes to `<MEDIA_ROOT>/public/avatars/<userId>/<uuid>.webp`.
   - Returns the storage key and public URL.
2. Implement `POST /me/avatar` and `DELETE /me/avatar` in `api/src/routes/me/avatar.ts` with previous file unlink cleanup.
3. Implement `PUT /me/password` in `api/src/routes/me/password.ts` with Redis rate limiting, current password verification, passwordless initial setup branch, tokenVersion increment, and re-issued dual tokens (`accessToken` and `refreshToken`).
4. Update `api/src/routes/me/profile.ts` to support `address` and sanitized field updates.
5. Register `passwordRoute` and `avatarRoute` in `api/src/routes/me/index.ts`.
6. Write route tests covering profile patch, password changes, invalid current passwords, rate limiting, seamless session token updates, and avatar upload handling.

## Success Criteria
- [ ] `PATCH /me` updates `firstName`, `lastName`, `address`, `country`, and returns the updated `User`.
- [ ] `PUT /me/password` enforces rate limit after 5 failed attempts within 15 minutes.
- [ ] `PUT /me/password` rejects incorrect `currentPassword` with 400 status.
- [ ] `PUT /me/password` successfully updates password, bumps token version, and returns new access + refresh tokens.
- [ ] `POST /me/avatar` rejects SVGs and GIFs with 415 error.
- [ ] `POST /me/avatar` processes 512x512 WebP avatar, cleans up old file, and stores asset.
- [ ] `DELETE /me/avatar` clears avatar from disk and sets `avatarUrl: null`.

## Risk Assessment
- **Risk**: Decompression bomb or high-resolution upload crashing the server.
  - **Mitigation**: Reuse `maxDecodedMegapixels` and stream size ceiling checks from media processor.
- **Risk**: Stale avatar cache in CDN / client.
  - **Mitigation**: Include unique UUID in avatar path so avatar updates are cache-busted automatically.
