---
phase: 5
title: "Mobile Location Capture & Address Auto-Fill"
status: pending
priority: P1
effort: "5h"
dependencies: ["phase-01-schemas-and-database-migration", "phase-02-geocoding-service-and-api-routes"]
---

# Phase 5: Mobile Location Capture & Address Auto-Fill

<!-- Updated: Validation Session 1 - Allow per-giveaway location override -->

## Overview
Equip the mobile client with device geolocation capabilities, place a location coordinate icon button in the Profile Edit address input field, reverse geocode coordinates to auto-fill the neighbourhood and country, persist coordinates to the user profile, and automatically attach user coordinates to all newly created giveaways while supporting an optional per-giveaway pickup location override.

## Requirements

### Functional
1. **Location Permissions & Geolocation Adapter**:
   - Add `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` to `apps/mobile/android/app/src/main/AndroidManifest.xml`.
   - Add `NSLocationWhenInUseUsageDescription` to `apps/mobile/ios/Expyrico/Info.plist`.
   - Install and configure `@react-native-community/geolocation` for bare React Native.
   - Create a clean wrapper `apps/mobile/src/services/location.ts` handling OS permission checks, high-accuracy GPS requests, and user-friendly error messages (e.g. GPS disabled, permission denied).
2. **Profile Edit Screen Integration (`profile/edit.tsx`)**:
   - In `apps/mobile/app/(app)/profile/edit.tsx`, enhance the Address field with a trailing coordinate action button (Ionicons `locate-outline` or `navigate-circle-outline`).
   - When tapped:
     - Display a loading spinner in the button while fetching.
     - Request location permission $\to$ acquire current device `(lat, lng)`.
     - Dispatch request to `GET /api/v1/geo/reverse-geocode?lat=...&lng=...`.
     - Automatically populate `address` field with the returned neighbourhood/city address.
     - Automatically update `country` state to the returned 2-letter country code (`countryCode`), updating the displayed country flag and currency details.
     - Retain `latitude` and `longitude` in local component state.
     - Show a subtle success checkmark badge.
   - When tapping "Save changes", call `meEndpoints.update({ firstName, lastName, address, country, latitude, longitude })`.
   - Update `useSessionStore` with the saved coordinates.
3. **Giveaway Creation Auto-Attachment & Override (`giveaway/new.tsx`) (Validation Decision)**:
   - In `apps/mobile/app/(app)/giveaway/new.tsx`:
     - **Default**: Initialize `locationText` with `user.address` and internal coordinates `(latitude, longitude)` with `(user.latitude, user.longitude)`.
     - **Per-Giveaway Override**: Provide a secondary action button next to the location field:
       `[ Use Current GPS ]`
       - Tapping it requests current GPS coordinates, calls reverse geocoding for that specific giveaway, and updates the giveaway's pickup address and coordinates.
       - If the giver types a custom location without using GPS, allow it; if coordinates were previously set, preserve or clear based on whether user cleared the text.
     - Keep coordinates strictly internal to form state (never display raw floats in the UI).
     - When user submits the giveaway, include `latitude` and `longitude` in the `giveaways.create` payload.
     - Store coordinates on the `Giveaway` database record.

### Non-Functional
- Strict UK / Commonwealth English copy in all alerts and badges (`kilometre`, `neighbourhood`, `dialogue`, `prioritise`).
- Adhere to Expyrico color palette: Fresh Sage `#4BAE8A` for icon/active state, Deep Sage `#3A8F6F` for pressed state, Alert Red `#E0442A` for error banners.
- Timeout safety: GPS request capped at 10 seconds; if GPS times out or fails, alert user gracefully and keep manual text editing available.

## UI/UX Wireframe & Interaction Flow

```
+-------------------------------------------------------------+
| Location & Regional Preferences                             |
|                                                             |
| Address (Optional)                                          |
| +---------------------------------------------------------+ |
| | Ben Nghe, District 1, Ho Chi Minh City                |O| | <-- Coordinate Icon Button
| +---------------------------------------------------------+ |     (Tapping triggers GPS -> API)
| Used for local deals, community giveaways, and delivery     |
|                                                             |
| Country & Currency                                          |
| +---------------------------------------------------------+ |
| | [VN Flag] Vietnam (VN)                                > | | <-- Auto-selected from geocoding
| | Default currency: VND (d)                               | |
| +---------------------------------------------------------+ |
|                                                             |
| [✓ GPS Location Linked]                                     | <-- Subtle confirmation badge
+-------------------------------------------------------------+
```

## Related Code Files
- Modify: `apps/mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `apps/mobile/ios/Expyrico/Info.plist`
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/src/services/location.ts`
- Create: `apps/mobile/src/services/location.test.ts`
- Modify: `apps/mobile/src/api/endpoints.ts`
- Modify: `apps/mobile/app/(app)/profile/edit.tsx`
- Modify: `apps/mobile/app/(app)/giveaway/new.tsx`
- Modify: `apps/mobile/__tests__/routes/product-new.test.tsx`

## Implementation Steps
1. Install `@react-native-community/geolocation` in `apps/mobile/` and add permissions to `AndroidManifest.xml` and `Info.plist`.
2. Implement `apps/mobile/src/services/location.ts` with `getCurrentCoordinates()` wrapping `Geolocation.getCurrentPosition` and `PermissionsAndroid.request`.
3. Add `geoEndpoints.reverseGeocode(lat, lng)` to `apps/mobile/src/api/endpoints.ts`.
4. Update `apps/mobile/app/(app)/profile/edit.tsx`:
   - Place coordinate button inside Address `TextField`.
   - Wire tap handler to `getCurrentCoordinates()` $\to$ `geoEndpoints.reverseGeocode()`.
   - Update `address`, `country`, `latitude`, `longitude` state.
   - Include coordinates in `meEndpoints.update()`.
5. Update `apps/mobile/app/(app)/giveaway/new.tsx`:
   - Read coordinates from `userSession`.
   - Add "Use current GPS" button to allow overriding pickup coordinates for this specific giveaway.
   - Pass coordinates to `giveawayCreate` payload on submit.
6. Run unit tests and verify mobile typecheck passes.

## Success Criteria
- [x] Tapping coordinate icon in Profile Edit prompts for Android location permission and retrieves GPS coordinates.
- [x] Address field automatically populates with neighbourhood/city-level address returned from the backend.
- [x] Country selector automatically switches to the correct country.
- [x] Profile save successfully stores `latitude` and `longitude` in the database.
- [x] Creating a giveaway defaults to profile coordinates, but allows overriding with current GPS.
- [x] Database record saves `latitude` and `longitude` while the UI only displays the address string.

## Risk Assessment
- **Risk**: User denies location permission or device has location services disabled.
  - **Observable Signal**: Geolocation error code `PERMISSION_DENIED` or `POSITION_UNAVAILABLE`.
  - **Mitigation**: Catch error, display friendly alert explaining why location is needed with option to open system settings, and allow user to type address manually without blocking profile save.
