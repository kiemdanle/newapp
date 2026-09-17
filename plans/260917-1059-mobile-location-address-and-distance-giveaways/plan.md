---
title: "mobile-location-address-and-distance-giveaways"
description: "Mobile coordinate capture, Google Maps reverse geocoding to auto-fill address/country, profile & giveaway coordinate persistence, distance-filtered giveaway feed, admin distance circle settings, and Google Maps API request analytics dashboard"
status: completed
priority: P1
effort: "3d"
tags: ["mobile", "api", "admin", "geolocation", "google-maps", "giveaways", "analytics"]
created: 2026-09-17
---

# Mobile Location Coordinates, Reverse Geocoding & Distance-Filtered Giveaways

## Overview

Enable users to capture their current GPS coordinates `(latitude, longitude)` on mobile via a coordinate icon in the address field, reverse geocode those coordinates via an authenticated server-side Google Maps Geocoding proxy to automatically populate the neighbourhood/city address and country, and persist coordinates to the user profile and newly created giveaways. Filter the giveaway feed by distance using an admin-configurable radius circle (with PostgreSQL bounding box pre-filtering and spherical distance calculation), and provide an administrative management dashboard for distance circle configuration and Google Maps API request analytics (request volume, daily quota gauge, latency, error tracking, request log table, and live coordinate probe tool).

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | **Database & Shared Schemas**: Add `latitude` and `longitude` to `User` and `Giveaway` models with spatial composite indexing; create `GoogleMapsApiCallLog` model; define distance setting schemas in `@expyrico/shared`. | P1 |
| 2 | **Server-Side Geocoding Service**: Implement Google Maps Geocoding proxy (`/api/v1/geo/reverse-geocode`) with in-memory coordinate-rounding caching, rate limiting, and request logging. Format address at neighbourhood and city level for user privacy. | P1 |
| 3 | **Admin Settings & API Analytics**: Build admin distance circle configuration UI under `/settings/giveaways` and API request analytics dashboard under `/system/external-apis/google-maps` with 80% warning / 95% critical quota thresholds. | P1 |
| 4 | **Giveaway Feed Distance Filtering**: Update `GET /giveaways` to compare post coordinates against viewer coordinates, pruning posts outside the admin distance circle with distance metadata returned; support empty state with 1-tap "Expand Search" button. | P1 |
| 5 | **Mobile Location Capture & Auto-Fill**: Add coordinate trigger button to Address input in `profile/edit.tsx`, auto-fill neighbourhood and country, and auto-attach coordinates to newly created giveaways in `giveaway/new.tsx` with optional per-giveaway location override. | P1 |
| 6 | **End-to-End Verification**: Complete unit, integration, and physical Android device verification over ADB, proving zero typecheck errors and accurate distance filtering. | P1 |

## Architecture & Data Flow

```
+-----------------------------------------------------------------------------------+
|                               Mobile Client (React Native)                        |
|                                                                                   |
|  [Profile Edit]                   [New Giveaway]                [Giveaway Feed]   |
|   Coordinate Icon (Tap)            Auto-populates Address       Fetches feed with |
|        |                           (Allow override via GPS)     viewer location   |
|   GPS (lat, lng)                   Attaches (lat, lng)                 |          |
|        |                           to payload (silent)                 |          |
|   GET /api/v1/geo/reverse-geocode      |                               |          |
|   (Auto-fills Neighbourhood & Country) |                               |          |
+--------|-------------------------------|-------------------------------|----------+
         |                               |                               |
         v                               v                               v
+-----------------------------------------------------------------------------------+
|                                Fastify API Server                                 |
|                                                                                   |
|  /api/v1/geo/reverse-geocode      POST /api/v1/giveaways        GET /api/v1/giveaways |
|  - Rate limiter (10 req/min)     - Persists lat, lng,          - Bounding Box     |
|  - In-memory cache (~50m)          locationText to DB            Pre-filter       |
|  - Privacy formatting                                          - Haversine Filter |
|    (neighbourhood & city)                                      - Return distanceKm|
|  - Log call to DB                                              - Fallback expand  |
+--------|---------------------------------------------------------------|----------+
         |                                                               |
         v                                                               v
+--------------------------+                               +------------------------+
| Google Maps Platform     |                               | PostgreSQL Database    |
| - Geocoding API (v3)     |                               | - User (lat, lng)      |
| - Hard-capped 1,000/day  |                               | - Giveaway (lat, lng)  |
| - $0 spend guarantee     |                               | - GoogleMapsApiCallLog |
+--------------------------+                               | - Setting (distance)   |
                                                           +------------------------+
```

## Phases

| # | Phase | File | Status | Priority | Effort |
|---|-------|------|--------|----------|--------|
| 1 | Database Schemas, Shared Types & Migrations | [phase-01-schemas-and-database-migration.md](./phase-01-schemas-and-database-migration.md) | Completed | P1 | 3h |
| 2 | Backend Geocoding Service & API Routes | [phase-02-geocoding-service-and-api-routes.md](./phase-02-geocoding-service-and-api-routes.md) | Completed | P1 | 4h |
| 3 | Admin Distance Settings & API Statistics | [phase-03-admin-distance-settings-and-api-statistics.md](./phase-03-admin-distance-settings-and-api-statistics.md) | Completed | P1 | 5h |
| 4 | Giveaway Feed Distance Filtering | [phase-04-giveaway-feed-distance-filtering.md](./phase-04-giveaway-feed-distance-filtering.md) | Completed | P1 | 4h |
| 5 | Mobile Location Capture & Address Auto-Fill | [phase-05-mobile-location-capture-and-autofill.md](./phase-05-mobile-location-capture-and-autofill.md) | Completed | P1 | 5h |
| 6 | Verification, Testing & Device Deployment | [phase-06-verification-and-device-testing.md](./phase-06-verification-and-device-testing.md) | Completed | P1 | 3h |

## Success Criteria

- [x] Tapping coordinate icon in mobile `EditProfileScreen` prompts for OS location permission and retrieves device GPS coordinates.
- [x] Backend reverse geocodes coordinates via Google Maps API, auto-populating neighbourhood/city-level address and selecting the corresponding country in the picker.
- [x] User profile persists `address`, `country`, `latitude`, and `longitude` in the database.
- [x] Giveaway creation auto-populates address and silently attaches `latitude` and `longitude` to the database record with optional "Use current GPS" location override.
- [x] Giveaway Feed filters out posts outside the admin-configured distance circle (e.g. 25 km) with bounding box pre-filtering and Haversine distance verification.
- [x] If 0 posts are within the distance radius, an empty state offers a 1-tap "Expand Search" action to widen to 50 km or nationwide.
- [x] Each giveaway card in the feed displays calculated distance (e.g. `📍 Downtown · 3.2 km away`).
- [x] Admin dashboard provides a settings form to configure the distance circle radius and toggle strict distance mode.
- [x] Admin dashboard provides an external API statistics page for Google Maps (daily quota gauge with 80% warning / 95% critical alerts, volume chart, latency, error tracking, request log table, and live coordinate probe tool).
- [x] Zero TypeScript errors across all workspaces (`shared`, `api`, `mobile`, `admin`) and all unit tests passing.
- [x] Physical Android device verified over ADB.

## Validation Log

### Session 1 — 2026-09-17
**Trigger:** User requested `/ak:plan validate` interview before coding.
**Questions asked:** 4

#### Questions & Answers

1. **[Architecture / Feed Behavior]** How should the Giveaway Feed behave if no posts exist within the active distance radius?
   - Options: Empty state with 'Expand Search' button | Auto-expand to country-wide with banner | Strict empty state only
   - **Answer:** Empty state with 'Expand Search' button
   - **Rationale:** Avoids confusing users with distant posts without warning while giving them an instant 1-tap escape hatch to discover posts in adjacent communities.

2. **[Privacy / User Experience]** Which address granularity should be auto-filled when the user taps the location coordinate button?
   - Options: Full street-level address | Neighbourhood & city level only | Confirmation picker modal
   - **Answer:** Neighbourhood & city level only
   - **Rationale:** Protects user privacy by not exposing exact house numbers in public profiles while still providing precise neighbourhood / district and city context for community interactions.

3. **[Operations / Monitoring]** What threshold should trigger the Admin Dashboard Google Maps daily quota warning?
   - Options: 80% warning / 95% critical | 70% warning / 90% critical | On-error alert only
   - **Answer:** 80% warning / 95% critical
   - **Rationale:** Aligns with standard operational monitoring; triggers a visual amber alert at 800 requests/day (80%) and critical red banner at 950 requests/day (95%) well before the 1,000 hard limit is hit.

4. **[Scope / Features]** Should users be allowed to override the pickup location for an individual giveaway?
   - Options: Allow override per giveaway | Locked to profile location only
   - **Answer:** Allow override per giveaway
   - **Rationale:** While profile address auto-fills by default for convenience, givers often hand off items at their workplace, community centre, or public transit station rather than their home.

#### Confirmed Decisions
- Feed fallback: Empty state with 1-tap "Expand Search" button (to 50 km or nationwide).
- Address formatting: Auto-fill neighbourhood/district and city only (omit precise building/house numbers).
- Quota alerts: Admin dashboard highlights quota at 80% (amber warning) and 95% (red alert).
- Giveaway location: Profile address auto-populates by default, but givers can tap "Use current GPS" or adjust address per giveaway.

#### Action Items
- [ ] Propagate neighbourhood-level address extraction to `phase-02-geocoding-service-and-api-routes.md`.
- [ ] Propagate 80%/95% quota alerting thresholds to `phase-03-admin-distance-settings-and-api-statistics.md`.
- [ ] Propagate empty-state "Expand Search" interaction to `phase-04-giveaway-feed-distance-filtering.md`.
- [ ] Propagate per-giveaway location override affordance to `phase-05-mobile-location-capture-and-autofill.md`.

### Verification Results
- Claims checked: 18
- Verified: 18 | Failed: 0 | Unverified: 0
- Tier: Full (6 phases)

### Whole-Plan Consistency Sweep
- Stale or contradictory claims: 0
- Reconciled: Address granularity updated across all files from full street number to neighbourhood & city level for privacy.
- Reconciled: Giveaway creation location override explicitly supported across all relevant phases.
- Status: Ready for implementation (`/ak:cook`).

<!-- slug: mobile-location-address-and-distance-giveaways -->
