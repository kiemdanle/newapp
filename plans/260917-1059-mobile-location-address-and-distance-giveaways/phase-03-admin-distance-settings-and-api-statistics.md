---
phase: 3
title: "Admin Distance Settings & API Statistics Dashboard"
status: pending
priority: P1
effort: "5h"
dependencies: ["phase-01-schemas-and-database-migration", "phase-02-geocoding-service-and-api-routes"]
---

# Phase 3: Admin Distance Settings & API Statistics Dashboard

<!-- Updated: Validation Session 1 - 80% warning / 95% critical quota alerts -->

## Overview
Create the administrative interface for managing the giveaway distance circle radius and provide comprehensive operational statistics for Google Maps Geocoding API usage (volume, daily quota gauge with multi-stage alerts, latency, error tracking, request log table, and live coordinate probe tool).

## Requirements

### Functional
1. **Giveaway Distance Circle Configuration**:
   - Create Admin Page at `apps/admin/src/app/(admin)/settings/giveaways/page.tsx`.
   - Provide interactive setting form (`giveaway-distance-form.tsx`) to configure:
     - `defaultRadiusKm`: Default search radius circle (preset buttons: 10 km, 25 km, 50 km, 100 km, or custom slider/input between 5 km and 200 km).
     - `strictDistanceOnly`: Boolean toggle (when true, only posts within radius are shown; when false, offers 1-tap expansion).
     - `allowUserRadiusOverride`: Boolean toggle (allows mobile users to expand their search radius).
   - API Endpoints: `GET /api/v1/admin/settings/giveaways` and `PUT /api/v1/admin/settings/giveaways`.
   - Record admin audit logs for changes to this setting.

2. **Google Maps API Analytics & Quota Management**:
   - Create Admin Page at `apps/admin/src/app/(admin)/system/external-apis/google-maps/page.tsx` (linked in navigation next to Barcode APIs).
   - API Endpoint: `GET /api/v1/admin/analytics/google-maps` supporting `?timeRange=24h|7d|30d&page=1&limit=25`.
   - Metrics displayed:
     - **Multi-Tier Daily Quota Gauge (Validation Decision)**:
       - Normal state ($<800$ reqs / $<80\%$): Fresh Sage `#4BAE8A` progress bar.
       - **Warning Alert Banner ($\ge 80\%$ / $\ge 800$ requests today)**: Amber Honey `#F5A623` banner stating *"Daily Google Maps quota approaching limit (80% used). Consider reviewing rate limits."*
       - **Critical Alert Banner ($\ge 95\%$ / $\ge 950$ requests today)**: Alert Red `#E0442A` high-priority banner stating *"Daily Google Maps quota almost exhausted (95% used). Hard-stop limit imminent at 1,000 requests."*
     - **Monthly Spend Estimator**: Total monthly requests vs. 40,000 free tier limit (`$0.00 billed`).
     - **Performance Metrics**: Average latency (ms), p95 latency, and total calls.
     - **Cache Efficiency**: Cache hit percentage (`%` of requests resolved without consuming Google quota).
     - **Volume Chart**: Daily request volume bar chart showing successes, cache hits, and errors over the selected time range.
     - **Request Log Table**: Filterable list showing Timestamp, User, Coordinates `(lat, lng)`, Formatted Address, HTTP Status, Latency (ms), and Status badge (`success`, `cached`, `error`).
     - **Interactive Coordinate Probe**: Modal / form allowing admins to enter test coordinates, execute a test reverse-geocode query, and inspect the raw response and latency in real-time.

### Non-Functional
- Page load time $< 500\text{ ms}$ via optimized database index queries on `google_maps_api_call_logs`.
- Follow established Expyrico Admin UI design language (warm white panels, Fresh Sage `#4BAE8A` accents, Honey `#F5A623` warnings, Alert Red `#E0442A` errors).
- Zero client-side bundle bloat: use Next.js server components with lightweight interactive client forms.

## Architecture

```
Admin Dashboard (Next.js)
       |
       |-- /settings/giveaways (Distance Circle Form)
       |     |--> PUT /api/v1/admin/settings/giveaways
       |     |--> Writes to `Setting` table (key: 'giveaway_distance')
       |     |--> Emits Admin Audit Log
       |
       |-- /system/external-apis/google-maps (Analytics Dashboard)
             |--> GET /api/v1/admin/analytics/google-maps?timeRange=7d
             |--> Calculates 80% (warning) & 95% (critical) quota conditions
             |--> Aggregates `GoogleMapsApiCallLog` via Prisma
             |--> Renders Multi-Tier Quota Gauge, Latency Cards, Volume Chart & Log Table
```

## Related Code Files
- Create: `api/src/routes/admin/settings/giveaways.ts`
- Create: `api/src/routes/admin/analytics/google-maps.ts`
- Modify: `api/src/routes/admin/settings/index.ts`
- Modify: `api/src/routes/admin/analytics/index.ts`
- Create: `apps/admin/src/app/(admin)/settings/giveaways/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/giveaways/giveaway-distance-form.tsx`
- Create: `apps/admin/src/app/(admin)/system/external-apis/google-maps/page.tsx`
- Create: `apps/admin/src/app/(admin)/system/external-apis/google-maps/components/google-maps-dashboard.tsx`
- Create: `apps/admin/src/app/(admin)/system/external-apis/google-maps/components/quota-gauge-card.tsx`
- Create: `apps/admin/src/app/(admin)/system/external-apis/google-maps/components/request-log-table.tsx`
- Create: `apps/admin/src/app/(admin)/system/external-apis/google-maps/components/coordinate-probe-modal.tsx`
- Modify: `apps/admin/src/lib/admin-api.ts` (typed API client methods)

## Implementation Steps
1. Implement `api/src/routes/admin/settings/giveaways.ts`:
   - Add `GET` and `PUT` handlers verifying admin session and calling `getSetting` / `putSetting` with `giveawayDistanceSettingsSchema`.
2. Implement `api/src/routes/admin/analytics/google-maps.ts`:
   - Compute aggregate counts: total, cached, errors, avg duration, daily counts grouped by `date_trunc('day', created_at)`.
   - Check daily request count against 800 (80%) and 950 (95%) thresholds.
   - Fetch recent paginated log entries from `prisma.googleMapsApiCallLog`.
3. Add API client definitions in `apps/admin/src/lib/admin-api.ts`.
4. Build the distance settings page at `apps/admin/src/app/(admin)/settings/giveaways/`:
   - Include preset radius pills (`10 km`, `25 km`, `50 km`, `100 km`), validation bounds, and save confirmation toast.
5. Build the analytics dashboard at `apps/admin/src/app/(admin)/system/external-apis/google-maps/`:
   - Display quota card with amber 80% and red 95% alerts, volume chart, request table with status pills, and coordinate probe dialog.
6. Verify via browser and run typechecks on both `api` and `admin` workspaces.

## Success Criteria
- [x] Admin can update the default distance radius and toggle strict distance mode; updates persist immediately to the database.
- [x] Changes to distance settings produce an entry in `admin_audit_logs`.
- [x] The Google Maps analytics dashboard accurately reports daily requests, quota usage percentage, latency, and cache hit ratio.
- [x] Quota alert banner renders in amber at 80% and in red at 95% consumption.
- [x] Test coordinate probe executes a reverse-geocode call and displays formatted address and latency in the admin UI.
- [x] `pnpm --filter @expyrico/admin build` and `pnpm --filter @expyrico/api typecheck` succeed.

## Risk Assessment
- **Risk**: Aggregate queries over hundreds of thousands of log records could cause latency.
  - **Observable Signal**: Slow response on analytics dashboard load ($>1\text{s}$).
  - **Mitigation**: Database queries leverage existing composite index `@@index([status, createdAt])` and restrict historical time windows to 30 days max.
