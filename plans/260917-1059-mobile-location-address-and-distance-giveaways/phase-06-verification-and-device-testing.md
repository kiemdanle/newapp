---
phase: 6
title: "Verification, Testing & Device Deployment"
status: pending
priority: P1
effort: "3h"
dependencies: ["phase-01-schemas-and-database-migration", "phase-02-geocoding-service-and-api-routes", "phase-03-admin-distance-settings-and-api-statistics", "phase-04-giveaway-feed-distance-filtering", "phase-05-mobile-location-capture-and-autofill"]
---

# Phase 6: Verification, Testing & Device Deployment

## Overview
Perform comprehensive automated testing across all workspaces (`shared`, `api`, `mobile`, `admin`), deploy database migrations and backend services to the production API server (`api.linhkienkts.com`), compile the mobile Android APK via local Gradle, and verify end-to-end functionality on a physical Android device over ADB with screenshot evidence.

## Requirements

### Functional
- Execute full test suites for geocoder caching, Haversine distance math, Zod schema constraints, and mobile UI components.
- Run complete TypeScript typechecks across all 4 monorepo workspaces with 0 errors.
- Deploy Prisma schema updates and restart `pantry-api.service` on `api.linhkienkts.com`.
- Exercise full user flow on physical Android device:
  1. Open Profile Edit $\to$ tap coordinate icon $\to$ verify GPS retrieval $\to$ verify address and country auto-population $\to$ save profile.
  2. Open New Giveaway $\to$ verify address auto-filled $\to$ submit giveaway $\to$ verify coordinates saved in PostgreSQL database.
  3. Open Giveaway Feed $\to$ verify distance chips rendered (e.g. `📍 2.4 km away`) $\to$ verify posts outside admin distance circle are pruned.
  4. Open Admin Dashboard $\to$ verify distance circle setting updates and Google Maps API request analytics reflect the live test requests.

### Non-Functional
- Zero regressions in existing 54 mobile unit tests.
- Local Gradle compilation completed with `BUILD SUCCESSFUL`.
- Fast response time: distance query execution $< 15\text{ ms}$ on PostgreSQL.

## Related Code Files
- Test: `packages/shared/src/schemas/giveaway.test.ts`
- Test: `api/tests/unit/google-maps-geocoder.test.ts`
- Test: `api/tests/unit/distance-filter.test.ts`
- Test: `api/tests/integration/geo-reverse-geocode.test.ts`
- Test: `apps/mobile/src/services/location.test.ts`
- Test: `apps/mobile/__tests__/routes/product-new.test.tsx`
- Test: `apps/mobile/__tests__/GiveawayDetailScreen.test.tsx`

## Implementation Steps
1. **Automated Unit & Integration Tests**:
   - Run `pnpm --filter @expyrico/shared test`.
   - Run `pnpm --filter @expyrico/api test`.
   - Run `pnpm --filter @expyrico/mobile test`.
2. **Monorepo Typecheck**:
   - Run `pnpm typecheck` or `tsc --noEmit` across all projects.
3. **Database Migration on Production**:
   - Apply Prisma migrations to `api.linhkienkts.com` via SSH:
     `ssh dan@api.linhkienkts.com "cd /opt/newapp/api && npx prisma db push"`
   - Restart service: `ssh dan@api.linhkienkts.com "sudo systemctl restart pantry-api"`.
4. **Android Build & Device Deployment**:
   - Compile debug APK with local Gradle:
     `cd apps/mobile && JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME="$HOME/Library/Android/sdk" ../../node_modules/@react-native/gradle-plugin/gradlew -p android :app:assembleDebug`
   - Install to physical device: `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
5. **Physical Device Walkthrough & Proof Collection**:
   - Launch app: `adb shell am start -n com.expyrico.app/.MainActivity`.
   - Navigate to Profile Edit and tap coordinate icon; verify address and country auto-populate.
   - Capture device screenshot to `/tmp/geo_profile_edit.png`.
   - Create a giveaway and capture `/tmp/geo_giveaway_created.png`.
   - View Giveaway Feed and capture `/tmp/geo_distance_feed.png`.
   - Verify Admin Dashboard analytics at `https://admin.linhkienkts.com/system/external-apis/google-maps`.

## Success Criteria
- [x] All automated unit and integration tests passing.
- [x] 0 TypeScript type errors across all packages.
- [x] Live API server responds with 200 on `/api/v1/geo/reverse-geocode`.
- [x] Physical Android device smoothly executes location capture, address auto-fill, and distance-filtered feed browsing.
- [x] Admin dashboard accurately logs all Google Maps API calls and manages distance settings.

## Risk Assessment
- **Risk**: Remote production database schema drift.
  - **Observable Signal**: Prisma query failure `column "latitude" does not exist`.
  - **Mitigation**: Run `prisma db push` or check database columns via `psql` before restarting `pantry-api.service`.
