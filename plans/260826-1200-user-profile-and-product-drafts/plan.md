---
title: "User Profile Management and Product Drafts Enhancements"
description: "Comprehensive implementation plan for user profile management (name, address, country with app-wide locale/currency/date formatting, avatar upload, password change/creation) and product drafts creation action fixes."
status: completed
priority: P1
branch: "main"
tags: ["profile", "auth", "avatar", "locale", "currency", "drafts", "mobile", "api"]
blockedBy: []
blocks: []
created: "2026-08-26T04:09:04.538Z"
createdBy: "ck:plan"
source: skill
---

# User Profile Management and Product Drafts Enhancements

## Executive Summary & System Overview

This implementation plan delivers a production-grade user profile management system and resolves the product drafts creation flow in the Expyrico mobile and backend applications.

### Core Objectives
1. **Name & Identity**: Enable editing of first name and last name with real-time UI synchronization across session stores.
2. **Address Management**: Introduce user address storage in Prisma DB, shared Zod contracts, and mobile input fields.
3. **Country & App-wide Locale / Regional System**: Updating user country automatically triggers reactive updates to locale (`en-US`, `vi-VN`, `en-GB`, `de-DE`, `ja-JP`, etc.), currency display (`USD`, `EUR`, `VND`, `GBP`, `JPY`), date formats (`MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY/MM/DD`), and time display (12h vs 24h) across all screens.
4. **Avatar Upload & Global Reflection**: Implement authenticated multipart avatar upload (`POST /me/avatar`), Sharp image processing to WebP variants at high resolution (512x512 display and 128x128 thumb), storage under public media assets, and a reusable `Avatar` component with fallback initials that reflects instantly across the entire app.
5. **Password Management**: Support changing existing passwords (requiring current password verification) and adding/setting a new password for OAuth/Passkey-registered users who lack a password hash.
6. **Complete Profile & Security Hub**: Modernize the profile screen and settings with clean information hierarchy, theme preferences, notification settings, and email verification status.
7. **Product Drafts Creation Fix**: Resolve the missing draft creation capability on `ProductDraftsScreen` by adding prominent scan and manual code entry action triggers.

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                               Mobile Application                                  |
|                                                                                   |
|  +---------------------+   +---------------------+   +-------------------------+  |
|  |    Profile Tab      |   |  Edit Profile Screen|   | Password & Security UI  |  |
|  |  (Avatar, Info,     |-->| (Name, Address,     |   | (Change/Set Password,   |  |
|  |   Menu & Drafts)    |   |  Country, Avatar)   |   |  Passkey Management)    |  |
|  +---------------------+   +---------------------+   +-------------------------+  |
|             |                         |                           |               |
|             v                         v                           v               |
|  +-----------------------------------------------------------------------------+  |
|  |           Session Store (useSessionStore) & Regional Context (useLocale)      |  |
|  +-----------------------------------------------------------------------------+  |
|             |                         |                           |               |
+-------------|-------------------------|---------------------------|---------------+
              |                         |                           |
              | REST API / JSON         | Multipart Image           | Auth Request
              v                         v                           v
+-----------------------------------------------------------------------------------+
|                                Fastify API Backend                                |
|                                                                                   |
|  +---------------------+   +---------------------+   +-------------------------+  |
|  |   PATCH /me         |   |   POST /me/avatar   |   |   PUT /me/password      |  |
|  | (Update info/addr)  |   | (Sharp 512px WebP)  |   | (Verify/Set Password)   |  |
|  +---------------------+   +---------------------+   +-------------------------+  |
|             \                         |                          /                |
|              \                        v                         /                 |
|               \--->  +-------------------------------+  <------/                  |
|                      |  Prisma Database (User Model) |                            |
|                      |  (address, avatarUrl, country)|                            |
|                      +-------------------------------+                            |
+-----------------------------------------------------------------------------------+
```

---

## Phases Overview

| Phase | Title | Priority | Status | Key Deliverable |
|---|---|---|---|---|
| 1 | [Data Model & Shared Schemas](./phase-01-data-model-shared-schemas.md) | P1 | Completed | Prisma `User.address` field, `@expyrico/shared` user & password schemas, DTOs |
| 2 | [Backend API Routes & Services](./phase-02-backend-api-routes-services.md) | P1 | Completed | `PATCH /me`, `POST/DELETE /me/avatar` with Sharp 512px WebP pipeline, `PUT /me/password` |
| 3 | [Country Locale & Regional Formatting Engine](./phase-03-country-locale-regional-formatting-engine.md) | P1 | Completed | Reactive country metadata, currency formatting, date/time regional engine |
| 4 | [Mobile Profile & Security Screens](./phase-04-mobile-profile-security-screens.md) | P1 | Completed | Reusable `Avatar`, `ProfileScreen`, `EditProfileScreen`, `PasswordScreen` |
| 5 | [Product Drafts Creation & UX Fixes](./phase-05-product-drafts-creation-ux-fixes.md) | P1 | Completed | Header CTA, empty state actions, manual barcode/QR code entry sheet |
| 6 | [Testing Verification & Full Validation](./phase-06-testing-verification-full-validation.md) | P1 | Completed | Unit tests, integration tests, E2E flow tests, mobile build verification |

---

## Cross-Cutting Constraints & Design System

- **Expyrico Colour Palette**:
  - Fresh Sage `#4BAE8A` (Brand headers, active accents, successful avatar borders)
  - Deep Sage `#3A8F6F` (Pressed button states, high-contrast labels)
  - Mint Mist `#D6F0E6` (Soft avatar background panels, subtle highlights)
  - Warm White `#FAFAF8` (Screen and card backgrounds)
  - Honey `#F5A623` / Soft Butter `#FEEFC3` (Badges and alerts)
  - Stone `#F0F0ED` (Dividers, borders, input backgrounds)
  - Pebble `#8C8C85` (Muted labels, secondary icons)
  - Almost Black `#2C2C28` (Primary typography)
  - Alert Red `#E0442A` (Destructive actions, error states)
- **Security Mandates**:
  - Strict input validation using Zod on both client and API endpoints.
  - Argon2/Scrypt password hashing via existing `services/auth/passwords.ts`.
  - Token version incrementing on password updates to invalidate stale access tokens.
  - Image quarantine and dimension/channel bounds to prevent decompression bombs.

---

## Validation Log

### Session 1 - Critical Questions Interview (2026-08-26)
- **Session Invalidation on Password Update**: Confirmed to increment `tokenVersion` to revoke all other devices and active tokens while seamlessly issuing refreshed credentials for the initiating device so the current user stays logged in without disruption.
- **Avatar Storage & Resolution**: Confirmed local server media storage (`MEDIA_ROOT/public/avatars`) with enhanced high-resolution WebP rendering at **512x512 pixels** (display variant) and **128x128 pixels** (thumb variant) at `quality: 90` for crisp display on high-DPI Retina/OLED mobile screens.
- **Country & Regional Format Coupling**: Confirmed country selection drives app-wide currency, date layout (e.g. `DD/MM/YYYY` vs `MM/DD/YYYY`), clock format (12h/24h), and locale formatting automatically.
- **Product Drafts Initiation**: Confirmed supporting both live Camera Barcode/QR scanning and an interactive Manual Barcode/QR text entry dialog on `ProductDraftsScreen`.

---

## Red Team Review

### Session 1 — 2026-08-26
**Findings:** 8 total (8 accepted, 0 rejected)  
**Severity Breakdown:** 0 Critical, 2 High, 5 Medium, 1 Low  

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Rate limiting on `PUT /me/password` to prevent brute-force attacks on current password | High | Accept | Phase 2 |
| 2 | Dual token re-issuance returning `{ tokens, user }` and updating mobile `secureStore` | High | Accept | Phase 1, Phase 2, Phase 4 |
| 3 | Strict avatar MIME allowlist rejecting SVG (XSS) and animated GIF (CPU exhaustion) | Medium | Accept | Phase 2 |
| 4 | Avatar disk cleanup / unlink on replacement to prevent filesystem storage leaks | Medium | Accept | Phase 2 |
| 5 | Entity currency priority in `formatCurrency` preserving historical Deal/Giveaway currencies | Medium | Accept | Phase 3 |
| 6 | Hermes Intl compatibility with deterministic zero-padded pattern fallback formatters | Medium | Accept | Phase 3 |
| 7 | Client-side numeric barcode regex validation (`/^[0-9]{8,14}$/`) in manual entry modal | Medium | Accept | Phase 5 |
| 8 | Zero heavy third-party npm dependencies for country / locale metadata | Low | Accept | Phase 1, Phase 3 |

### Whole-Plan Consistency Sweep
- All 8 accepted adversarial findings have been propagated inline to their target phase files (`phase-01` through `phase-05`).
- Architecture contracts, endpoint response shapes (`passwordMutationResponseSchema`), and client-side error protections reconciled across backend and mobile specifications.
- Contradictions: **0 unresolved contradictions**.
