---
phase: 2
title: "Backend Geocoding Service & API Routes"
status: pending
priority: P1
effort: "4h"
dependencies: ["phase-01-schemas-and-database-migration"]
---

# Phase 2: Backend Geocoding Service & API Routes

<!-- Updated: Validation Session 1 - Address privacy at neighbourhood & city level -->

## Overview
Build an authenticated, rate-limited reverse geocoding service that interfaces with the Google Maps Geocoding API. Incorporate in-memory coordinate-rounding caching, circuit-breaker timeout protection, database audit logging for every call, and structured error responses. Format returned addresses at the neighbourhood, district, and city level to protect user privacy.

## Requirements

### Functional
- Accept `latitude` and `longitude` query parameters via authenticated endpoint `GET /api/v1/geo/reverse-geocode`.
- Check memory cache using 4-decimal rounded coordinates (`~11m` precision). Return cached address if present, marking status as `cached`.
- On cache miss, query Google Maps Geocoding API (`https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={GOOGLE_MAPS_API_KEY}`).
- **Privacy-Preserving Address Extraction (Validation Decision)**:
  - Extract the neighbourhood, sublocality / ward, administrative district, and locality / city components (e.g. `"Ben Nghe, District 1, Ho Chi Minh City"`).
  - Omit specific premise / house numbers (`street_number`) from the auto-filled address to safeguard user privacy while preserving exact GPS coordinates for mathematical distance queries.
- Extract the 2-letter ISO country code (`short_name` of component type `country`).
- Store result in memory cache with 24-hour TTL.
- Write a record to `GoogleMapsApiCallLog` for every invocation (recording duration, status, coordinates, formatted address, country, error message, and user ID).
- Return `{ address: string, country: string, latitude: number, longitude: number, cached: boolean }`.

### Non-Functional
- Strict rate limiting: 10 reverse geocode requests per minute per user ID.
- Upstream timeout: 4,000 ms via Opossum circuit breaker.
- Resilient error handling: if Google returns `ZERO_RESULTS`, return a 404 with friendly message; if Google returns `OVER_QUERY_LIMIT` or `REQUEST_DENIED`, return 503 with retry-after header and alert log.
- Never expose `GOOGLE_MAPS_API_KEY` in response payload or client logs.

## Architecture

```
Client (Mobile)
       |
       | GET /api/v1/geo/reverse-geocode?lat=10.7769&lng=106.7009
       v
Fastify Route Handler (`api/src/routes/geo/reverse-geocode.ts`)
       |
       |-- Check Rate Limit (10/min per user)
       |-- Validate Coordinates (-90 <= lat <= 90, -180 <= lng <= 180)
       v
Geocoder Service (`api/src/services/geo/google-maps-geocoder.ts`)
       |
       |-- Check In-Memory Cache (Key: `geo:10.7769:106.7009`)
       |     |-- Hit: Return cached formattedAddress & countryCode
       |
       |-- Miss: Dispatch HTTP to Google Maps Geocoding API
       |     |-- Opossum Circuit Breaker (Timeout: 4000ms)
       |     |-- Filter out street_number -> build privacy-safe neighbourhood/city string
       |     |-- Parse country ISO
       |     |-- Save to In-Memory Cache
       v
Write Audit Log (`GoogleMapsApiCallLog` in PostgreSQL)
       v
HTTP 200 JSON Response
```

## Related Code Files
- Create: `api/src/services/geo/google-maps-geocoder.ts`
- Create: `api/src/services/geo/cache.ts`
- Create: `api/src/routes/geo/reverse-geocode.ts`
- Create: `api/src/routes/geo/index.ts`
- Modify: `api/src/app.ts` (register `/api/v1/geo` route plugin)
- Create: `api/tests/unit/google-maps-geocoder.test.ts`
- Create: `api/tests/integration/geo-reverse-geocode.test.ts`

## Implementation Steps
1. Create `api/src/services/geo/cache.ts` providing an in-memory LRU or Map cache with TTL and coordinate-rounding key generation (`lat.toFixed(4) + ':' + lng.toFixed(4)`).
2. Implement `api/src/services/geo/google-maps-geocoder.ts`:
   - Read `GOOGLE_MAPS_API_KEY` from `getConfig()`.
   - Wrap fetch call in an Opossum circuit breaker with 4-second timeout.
   - Format address without premise/house number for privacy.
   - Extract country ISO.
   - Measure request duration (`performance.now()`).
   - Write row to `prisma.googleMapsApiCallLog`.
3. Implement `api/src/routes/geo/reverse-geocode.ts`:
   - Require authentication via Fastify preValidation hook.
   - Enforce rate limit (10 requests/min).
   - Validate query params with Zod (`z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) })`).
   - Call geocoder service and return JSON.
4. Mount route in `api/src/routes/geo/index.ts` and register in `api/src/app.ts`.
5. Write unit tests mocking Google Maps HTTP responses and testing cache hits, address extraction, rate limiting, and failure states.

## Success Criteria
- [x] Valid coordinates return 200 with neighbourhood/city-level address and 2-letter country code.
- [x] Premise / exact house numbers are omitted from the address field to safeguard user privacy.
- [x] Repeated calls with identical or near-identical coordinates (<15m) hit the memory cache and do not consume Google quota.
- [x] Every call produces an audit row in `google_maps_api_call_logs`.
- [x] Out-of-bounds coordinates return 400 Bad Request.
- [x] All unit and integration tests pass via `pnpm --filter @expyrico/api test`.

## Risk Assessment
- **Risk**: Google Maps returns plus-code or vague locality instead of street address in rural areas.
  - **Observable Signal**: Response address lacks neighbourhood context.
  - **Mitigation**: Combine `sublocality_level_1`, `locality`, and `administrative_area_level_2` components to form a coherent locality label.
