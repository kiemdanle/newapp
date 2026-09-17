---
phase: 1
title: "Database Schemas, Shared Types & Migrations"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Database Schemas, Shared Types & Migrations

## Overview
Extend database models in Prisma and shared Zod schemas to support spatial coordinates on `User` and `Giveaway`, create the `GoogleMapsApiCallLog` audit table, and define configuration and analytics schemas for distance circles and external API usage tracking.

## Requirements

### Functional
- Add nullable float coordinates `latitude` and `longitude` to the `User` model in Prisma.
- Add nullable float coordinates `latitude` and `longitude` to the `Giveaway` model in Prisma with composite index `@@index([latitude, longitude])`.
- Create `GoogleMapsApiCallLog` model in Prisma capturing `endpoint`, `latitude`, `longitude`, `status`, `httpStatus`, `durationMs`, `formattedAddress`, `countryCode`, `errorMessage`, `callerContext`, and `userId`.
- Add `giveaway_distance` setting definition with default radius (25 km), radius bounds (5 km - 200 km), and fallback mode flag.
- Export shared Zod schemas for user profile updates, giveaway creation/queries, distance settings, and Google Maps analytics.

### Non-Functional
- Strict Zod validation: coordinate ranges bounded by `-90 <= latitude <= 90` and `-180 <= longitude <= 180`.
- Zero database data loss on existing user and giveaway records.
- All column additions must be nullable to support backward compatibility with existing data.

## Architecture & Schema Changes

### 1. Prisma Schema (`api/prisma/schema.prisma`)
```prisma
model User {
  // ... existing fields ...
  latitude      Float?
  longitude     Float?
  googleMapsLogs GoogleMapsApiCallLog[]
}

model Giveaway {
  // ... existing fields ...
  latitude      Float?
  longitude     Float?

  @@index([latitude, longitude])
  @@index([country, status, createdAt(sort: Desc)])
  @@map("giveaways")
}

model GoogleMapsApiCallLog {
  id                 String   @id @default(uuid()) @db.Uuid
  endpoint           String   @db.Text
  latitude           Float
  longitude          Float
  status             String   @db.VarChar(32) // "success" | "error" | "rate_limited" | "cached"
  httpStatus         Int?     @map("http_status") @db.SmallInt
  durationMs         Int      @map("duration_ms") @db.Integer
  formattedAddress   String?  @map("formatted_address") @db.Text
  countryCode        String?  @map("country_code") @db.Char(2)
  errorMessage       String?  @map("error_message") @db.Text
  callerContext      String   @default("profile_location") @map("caller_context") @db.VarChar(32)
  userId             String?  @map("user_id") @db.Uuid
  user               User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([createdAt])
  @@index([status, createdAt])
  @@index([userId, createdAt])
  @@map("google_maps_api_call_logs")
}
```

### 2. Shared Schemas (`packages/shared/src/schemas/`)
- `packages/shared/src/schemas/user.ts`:
  ```typescript
  export const userSchema = z.object({
    // ... existing ...
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  });
  export const updateProfileSchema = z.object({
    // ... existing ...
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  });
  ```
- `packages/shared/src/schemas/giveaway.ts`:
  ```typescript
  export const giveawaySchema = z.object({
    // ... existing ...
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    distanceKm: z.number().nonnegative().nullable().optional(),
  });
  export const giveawayCreateSchema = z.object({
    // ... existing ...
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  });
  export const giveawayListQuerySchema = z.object({
    // ... existing ...
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(500).optional(),
  });
  ```
- `packages/shared/src/schemas/admin/giveaway-settings.ts`:
  ```typescript
  export const giveawayDistanceSettingsSchema = z.object({
    defaultRadiusKm: z.number().int().min(5).max(200).default(25),
    strictDistanceOnly: z.boolean().default(false),
    allowUserRadiusOverride: z.boolean().default(true),
  });
  export type GiveawayDistanceSettings = z.infer<typeof giveawayDistanceSettingsSchema>;
  export const DEFAULT_GIVEAWAY_DISTANCE_SETTINGS: GiveawayDistanceSettings = {
    defaultRadiusKm: 25,
    strictDistanceOnly: false,
    allowUserRadiusOverride: true,
  };
  ```

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `packages/shared/src/schemas/admin/giveaway-settings.ts`
- Create: `packages/shared/src/schemas/admin/google-maps-analytics.ts`
- Modify: `packages/shared/src/schemas/user.ts`
- Modify: `packages/shared/src/schemas/giveaway.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `api/src/services/admin/settings.ts`

## Implementation Steps
1. Edit `api/prisma/schema.prisma` to append `latitude`, `longitude` to `User` and `Giveaway`, and add `GoogleMapsApiCallLog`.
2. Generate migration or run `pnpm --filter @expyrico/api prisma db push` on local database.
3. Author new Zod schemas in `packages/shared/src/schemas/`.
4. Register `SETTING_KEYS.GIVEAWAY_DISTANCE = 'giveaway_distance'` in `api/src/services/admin/settings.ts`.
5. Run build on `packages/shared` so dist files and types are updated across all consuming packages.
6. Verify schema unit tests pass with `pnpm --filter @expyrico/shared test`.

## Success Criteria
- [x] `User` and `Giveaway` models contain `latitude` and `longitude` fields.
- [x] Composite spatial index `@@index([latitude, longitude])` applied to `giveaways`.
- [x] `GoogleMapsApiCallLog` table exists in PostgreSQL database.
- [x] Shared Zod validation allows valid coordinates and rejects out-of-bounds coordinates ($> 90$ or $< -90$).
- [x] `pnpm --filter @expyrico/shared build` and `pnpm --filter @expyrico/api typecheck` succeed with zero errors.

## Risk Assessment
- **Risk**: Prisma client generation under Node-ESM could fail if not using the CJS destructuring pattern.
  - **Observable Signal**: Runtime error `Named export 'PrismaClient' not found`.
  - **Mitigation**: Respect existing `api/src/db.ts` wrapper which safely imports `@prisma/client`.
- **Risk**: Stale local dist packages in `apps/mobile/local-packages/@expyrico/shared/dist/`.
  - **Observable Signal**: Mobile typecheck does not see new `latitude` fields.
  - **Mitigation**: Re-copy built `@expyrico/shared/dist` to `apps/mobile/local-packages/@expyrico/shared/dist/` as standard repository convention.
