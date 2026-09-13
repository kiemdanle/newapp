---
phase: 4
title: "Admin Dashboard Redesign & Management UI"
status: pending
priority: P1
effort: "8h"
dependencies: [1, 2, 3]
---

# Phase 4: Admin Dashboard Redesign & Management UI

<!-- Updated: Validation Session 1 - Manual refresh default with 15s/30s toggle, retentionDays settings input, callerContext filter in request table -->

## Overview
Redesign `/system/external-apis` in `apps/admin` from a static table into a high-density, real-time **Provider Command Center**. This phase equips administrators with interactive KPI cards (reflecting organic user traffic), daily quota consumption progress bars (specifically managing UPCitemdb's 100/day trial tier limit based on authoritative dispatched counts), time-series volume charts, a searchable granular request inspector with lazy-loaded JSON diagnostics via `GET /requests/:id`, a live barcode diagnostic probe tool, and per-provider management controls (enable/disable switches, timeout configuration, configurable log retention, and one-click cooldown/breaker resets).

## Requirements
- **Functional:**
  - **Header & Controls:** Time-range selector (`24h`, `7d`, `30d`), overall operational status badge, manual refresh button by default with optional auto-refresh toggle (Off / 15s / 30s), and prominent "Test Barcode Probe" button.
  - **Global KPI Cards:**
    - Total API Requests (strictly organic user traffic, excluding admin probes).
    - Global Hit Rate % (percentage of organic queries that resolved product data).
    - Rate Limits & Outages (count of 429s, 5xx errors, and timeouts).
    - Latency Performance (average response time and p95 latency in ms).
  - **Provider Command Center Grid:**
    - Dedicated cards for OpenFoodFacts and UPCitemdb (and future providers).
    - Provider health badge: `Healthy`, `Degraded`, `In Cooldown`, `Circuit Open`, `Disabled`.
    - Real-time Quota Progress Bar: visual progress indicating today's authoritative dispatched calls vs daily quota limit (e.g. `UPCitemdb: 42 / 100 calls (42%) - 58 remaining today`). Cooldown skips are reported separately as non-quota-consuming events.
    - Provider metric tiles: Total Calls, Hit Rate %, 429s, Timeouts, Avg Latency (ms), p95 Latency.
    - Quick actions: Enable/Disable switch, "Reset Cooldown / Breaker" button, and "Configure" settings modal.
  - **Visual Activity Charts:**
    - Time-series stacked bar/area chart showing call volume over time by provider (OFF vs UPCitemdb).
    - Outcome distribution breakdown (Hits vs Misses vs 429s vs Timeouts/Errors vs Cooldown Skips).
  - **Live Barcode Diagnostic Probe Tool (Modal):**
    - Allows admin to input any barcode (e.g. `8934677038016`) and trigger an instant parallel test.
    - Displays side-by-side comparison: latency in ms, HTTP response code, response size, and parsed product fields (name, brand, category, photo).
    - Saves probe execution to call log with `callerContext: 'admin_probe'` for subsequent inspection.
  - **Granular Request Log Table:**
    - Filterable by Provider (`All`, `OpenFoodFacts`, `UPCitemdb`), Status (`All`, `Hit`, `Miss`, `Rate Limited 429`, `Timeout`, `Error`, `Cooldown Skip`), and Caller Context (`All`, `Mobile App (sync_lookup)`, `Backfill Worker`, `Admin Probe`).
    - Search input for querying specific barcodes with instant filtering.
    - Displays: Timestamp, Provider badge, Barcode (monospace with copy button), Status pill, HTTP Code, Latency badge (green < 500ms, amber < 2000ms, red > 2000ms), and Caller Context badge.
    - Clickable rows that open a JSON Diagnostic Inspector modal: fetches detailed diagnostics via `serverAdminApi.system.externalApiRequestDetail(id)`, displaying the full request URL, HTTP request/response headers, error trace, and raw response payload preview.
  - **Provider Settings Modal:**
    - Admin form to adjust timeout budgets (ms), set daily quota warning caps, toggle active state, and set **Log Retention Period** (number input in days, minimum 7, with "Unlimited / Never prune" checkbox).
- **Non-functional:**
  - Compliance with Expyrico Color Palette (`#4BAE8A` Fresh Sage, `#3A8F6F` Deep Sage, `#D6F0E6` Mint Mist, `#FAFAF8` Warm White, `#F5A623` Honey, `#E0442A` Alert Red).
  - Accessible touch targets ($\ge 44\text{dp}$) and responsive mobile/desktop layout.
  - Smooth optimistic UI updates on toggle and reset actions via React Server Actions and `useTransition`.

## Architecture
```
[ apps/admin/src/app/(admin)/system/external-apis/ ]
├── page.tsx (Server Component fetching initial stats & range)
├── external-apis-dashboard.tsx (Client orchestrator with manual refresh & optional 15s/30s toggle)
├── components/
│   ├── kpi-hero.tsx (Global KPIs: Total, Hit Rate, 429s, Latency — excludes admin_probe)
│   ├── provider-card.tsx (Health badge, Quota progress bar, Quick actions)
│   ├── volume-chart.tsx (Time-series volume & outcome charts)
│   ├── request-log-table.tsx (Filterable by provider, status, callerContext, and barcode)
│   ├── request-detail-modal.tsx (Lazy-loads raw JSON & headers via requestDetail)
│   ├── barcode-probe-modal.tsx (Live diagnostic tester for any barcode)
│   └── provider-settings-modal.tsx (Timeout, quota, toggle, and retentionDays editor)
```

## Related Code Files
- Create:
  - `apps/admin/src/app/(admin)/system/external-apis/external-apis-dashboard.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/kpi-hero.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/provider-card.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/volume-chart.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/request-log-table.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/request-detail-modal.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/barcode-probe-modal.tsx`
  - `apps/admin/src/app/(admin)/system/external-apis/components/provider-settings-modal.tsx`
- Modify:
  - `apps/admin/src/app/(admin)/system/external-apis/page.tsx`
  - `apps/admin/src/lib/admin-api.ts`
  - `apps/admin/src/lib/actions.ts`

## Implementation Steps
1. Extend `apps/admin/src/lib/admin-api.ts`:
   - Add `serverAdminApi.system.externalApiStats(range)`.
   - Add `serverAdminApi.system.externalApiRequests(query)`.
   - Add `serverAdminApi.system.externalApiRequestDetail(id)`.
   - Add `serverAdminApi.system.probeBarcode(barcode, providers)`.
   - Add `serverAdminApi.system.updateExternalApiConfig(body)`.
   - Add `serverAdminApi.system.resetExternalApi(provider)`.
2. Implement Server Actions in `apps/admin/src/lib/actions.ts`:
   - `updateExternalApiConfigAction(patch)`: Calls API and triggers `revalidatePath('/system/external-apis')`.
   - `resetExternalApiAction(provider)`: Calls API reset and revalidates path.
   - `probeBarcodeAction(barcode, providers)`: Executes probe and returns structured diagnostic result.
   - `fetchRequestDetailAction(id)`: Fetches diagnostic headers and raw preview for modal.
3. Build UI Components:
   - `kpi-hero.tsx`: High-contrast KPI cards using `KpiCard` component and Lucide icons.
   - `provider-card.tsx`: Status indicator, Quota progress bar (colored green when <70%, amber when >70%, red when 100%), metric tiles, toggle switch, and reset button.
   - `volume-chart.tsx`: SVG/CSS responsive chart displaying volume trends over time.
   - `request-log-table.tsx`: Filter bar with `callerContext` pills, search input, status badges, latency badges, and row selection.
   - `request-detail-modal.tsx`: Lazy-loads detail on open; monospace formatted JSON viewer with copy-to-clipboard for raw error and payload inspection.
   - `barcode-probe-modal.tsx`: Interactive form with barcode input, provider checkboxes, loading spinner, and side-by-side product card preview.
   - `provider-settings-modal.tsx`: Form for timeout, quota limit, priority, and `retentionDays`.
4. Integrate `external-apis-dashboard.tsx` and rewrite `page.tsx`:
   - Fetch initial data on server with range from search params (`24h`, `7d`, `30d`).
   - Wire manual refresh default with 15s/30s polling toggle.

## Success Criteria
- [x] Dashboard displays comprehensive metrics for OpenFoodFacts and UPCitemdb.
- [x] Daily quota consumption progress bar accurately reflects authoritative dispatched calls and remaining limit.
- [x] Admins can toggle a provider on/off with immediate UI feedback and backend persistence.
- [x] Clicking "Reset Cooldown / Breaker" clears active cooldowns and restores healthy status.
- [x] Barcode Probe tool successfully runs live queries against external APIs and renders timing and product preview.
- [x] Request log table filters by provider, status, and callerContext, searches by barcode, and opens JSON details modal on click (loading full headers and preview).
- [x] Provider settings dialog supports editing `retentionDays` (or selecting unlimited).
- [x] Design strictly follows Expyrico colour palette and touch targets ($\ge 44\text{dp}$).

## Risk Assessment
- **Risk:** Auto-refresh generates excessive API traffic.
- **Mitigation:** Default auto-refresh to off; when enabled by admin, enforce minimum 15-second interval matching server cache TTL.
- **Risk:** Large JSON payloads in request logs degrade modal rendering.
- **Mitigation:** Truncate raw response previews in the list view; load full payload only on modal open.
