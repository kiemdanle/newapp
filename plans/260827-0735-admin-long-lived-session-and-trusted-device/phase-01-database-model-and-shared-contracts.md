---
phase: 1
title: Database Model and Shared Contracts
status: completed
priority: P1
dependencies: []
---

# Phase 1: Database Model and Shared Contracts

## Overview
Defines the database persistence schema for admin trusted devices in Prisma (`AdminTrustedDevice`), generates and applies the database migration, and updates the shared TypeScript Zod schemas in `@expyrico/shared` to support device trust flags, token exchanges, and device management listing/revocation across API and admin web tiers.

## Requirements
### Functional
- Add an `AdminTrustedDevice` table to PostgreSQL via Prisma to persist 60-day trusted device registrations.
- Extend `adminLoginRequestSchema` and `loginSchema` in `@expyrico/shared` with optional `trustedDeviceToken?: string`.
- Extend `adminTotpRequestSchema` and `totpChallengeVerifySchema` in `@expyrico/shared` with optional `trustDevice?: boolean`.
- Extend `totpChallengeVerifyResponseSchema`, `adminTotpResponseSchema`, and `authResultSchema` with optional `trustedDeviceToken?: string`.
- Define shared schemas for admin self-service trusted device management:
  - `adminTrustedDeviceRowSchema`: `{ id: string, ip: string | null, deviceInfo: Record<string, unknown> | null, createdAt: string, lastUsedAt: string | null, expiresAt: string }`
  - `adminTrustedDevicesListSchema`: `{ devices: z.array(adminTrustedDeviceRowSchema) }`
  - `adminTrustedDeviceRevokeResponseSchema`: `{ ok: true }`

<!-- Updated: Red Team Review Session 1 - Enforced strict compound indexing on [userId, tokenHash] for security isolation -->

### Non-Functional
- **Cryptographic Hashing & User-Scoped Isolation**: Device tokens must never be persisted in plaintext; the database stores `tokenHash: string` (SHA-256 hex digest). All verification queries strictly scope by `userId` and `tokenHash` to prevent cross-account token replay.
- **Index Efficiency**: Fast lookups on `tokenHash` (unique index) and `userId` (foreign key index).
- **Cascade Deletion**: Deleting an admin user cascades to their `admin_trusted_devices` records.
- **Contract Type Safety**: Complete type inference and compile-time compatibility across backend, admin web, and test suites.

## Architecture
```
+------------------------------------------------------------------+
|                     Prisma Model: AdminTrustedDevice             |
+------------------------------------------------------------------+
| - id: String (UUID, PK)                                          |
| - userId: String (UUID, FK -> User.id, Cascade Delete)           |
| - tokenHash: String (Unique, SHA-256 hex)                        |
| - deviceInfo: Json? (Browser, OS, User-Agent metadata)           |
| - ip: String? (Last observed IP address)                         |
| - expiresAt: DateTime (Expiry deadline = issuedAt + 60 days)     |
| - lastUsedAt: DateTime? (Timestamp of last successful auth)      |
| - revokedAt: DateTime? (Timestamp when explicitly invalidated)   |
| - createdAt: DateTime (Default NOW)                              |
+------------------------------------------------------------------+
```

## Related Code Files
- Modify: `api/prisma/schema.prisma` (Add `AdminTrustedDevice` model and relation to `User`)
- Create: `api/prisma/migrations/20260827_admin_trusted_devices/migration.sql`
- Modify: `packages/shared/src/schemas/auth.ts` (Add `trustedDeviceToken`, `trustDevice` fields)
- Modify: `packages/shared/src/schemas/admin.ts` (Add `trustedDeviceToken`, `trustDevice`, `adminTrustedDevicesListSchema`)
- Modify: `packages/shared/src/index.ts` (Re-export new contracts)

## Implementation Steps
1. **Prisma Schema Definition**:
   - In `api/prisma/schema.prisma`, add model `AdminTrustedDevice`:
     ```prisma
     model AdminTrustedDevice {
       id         String    @id @default(uuid()) @db.Uuid
       userId     String    @db.Uuid
       tokenHash  String    @unique
       deviceInfo Json?
       ip         String?
       expiresAt  DateTime
       lastUsedAt DateTime?
       revokedAt  DateTime?
       createdAt  DateTime  @default(now())

       user User @relation(fields: [userId], references: [id], onDelete: Cascade)

       @@index([userId])
       @@map("admin_trusted_devices")
     }
     ```
   - Add `trustedDevices AdminTrustedDevice[]` to `model User`.
2. **Generate Database Migration**:
   - Run `npx prisma migrate dev --name admin_trusted_devices --create-only` in `api/`.
   - Verify generated SQL includes table creation, unique constraint on `token_hash`, and foreign key constraint.
   - Run migration against local test database.
3. **Update Shared Contracts**:
   - In `packages/shared/src/schemas/admin.ts`:
     - Update `adminLoginRequestSchema`:
       ```typescript
       export const adminLoginRequestSchema = z.object({
         email: z.string().trim().toLowerCase().email().max(254),
         password: passwordField,
         trustedDeviceToken: z.string().min(1).optional(),
       });
       ```
     - Update `adminTotpRequestSchema`:
       ```typescript
       export const adminTotpRequestSchema = z.object({
         challengeToken: z.string().min(1),
         code: z.string().regex(/^\d{6}$/),
         trustDevice: z.boolean().optional(),
       });
       ```
     - Add `adminTrustedDeviceRowSchema` and `adminTrustedDevicesListSchema`.
   - In `packages/shared/src/schemas/auth.ts`:
     - Update `loginSchema` with optional `trustedDeviceToken?: string`.
     - Update `totpChallengeVerifySchema` with optional `trustDevice?: boolean`.
     - Update `authResultSchema` with optional `trustedDeviceToken?: string`.
4. **Compile and Build Shared Package**:
   - Run `npm run build` in `packages/shared` to produce type declarations and distribution artifacts.

## Success Criteria
- [ ] Prisma schema validates without warnings via `npx prisma validate`.
- [ ] Migration applies cleanly without data loss.
- [ ] `@expyrico/shared` builds with TypeScript zero errors.
- [ ] Schema unit tests in `packages/shared` pass for new device management and auth fields.

## Risk Assessment
- **Migration Drift**: Ensure migration follows existing Prisma migration conventions and naming.
- **Breaking API Payload Changes**: All new fields must be `.optional()` so existing mobile client requests and test suites without `trustedDeviceToken` or `trustDevice` continue functioning unchanged.
