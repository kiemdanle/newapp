---
title: "Mobile Connection Guard & Sync Loss Prevention Completion"
date: 2026-09-12
summary: "Completed 3-phase implementation of dual-layer connection verification, Facebook-style full-screen error notice with retry button, and automatic post-reconnection sync."
---

# Mobile Connection Guard & Sync Loss Prevention Completion

### Summary of Delivery
Implemented a complete, robust mobile connection guard to resolve the data synchronization loss problem between the local mobile SQLite database (WatermelonDB) and the backend server:

1. **Dual-Layer Health & Readiness Engine**:
   - Created `apps/mobile/src/services/network/connection-service.ts` combining NetInfo network interface verification with an active timeout-guarded (4s) HTTP health probe to `${getBaseUrl()}/health/ready`.
   - Created `apps/mobile/src/store/connectionStore.ts` tracking connection state (`'checking' | 'ready' | 'offline' | 'server_unreachable'`).
   - Subscribes to NetInfo and AppState foreground events for pure event-driven reconnection without polling battery drain.

2. **Facebook-Style Connection Notice & App-Level Gating**:
   - Created `apps/mobile/src/components/ConnectionNotice.tsx` featuring a serene, modern full-screen barrier with glowing icon halo, diagnostic status badge, headline, reassurance copy, and a prominent "Try Again" retry CTA with loading spinner.
   - Fully compliant with Expyrico design tokens across Dark (`#111512` / `#191F1B`) and Light (`#FAFAF8` / `#3A8F6F`) themes.
   - Gated `apps/mobile/src/App.tsx` on startup and during runtime, completely preventing user interactions while disconnected.

3. **Post-Reconnection State Synchronization**:
   - Wired `apps/mobile/src/db/triggers.ts` and `apps/mobile/src/App.tsx` so transitioning to `ready` immediately triggers `runSync()` and invalidates React Query caches.
   - Added cooldown protection against rapid network flapping.

### Verification
- **Unit & Integration Tests:** 19/19 tests passing (`connection-service.test.ts`, `connectionStore.test.ts`, `ConnectionNotice.test.tsx`, `connection-sync-lifecycle.test.ts`).
- **Typecheck:** 0 errors across `@expyrico/shared`, `api`, `apps/admin`, and `apps/mobile`.
- **Device Verification:** Built APK via local Gradle, installed via `adb install -r`, tested airplane mode/Wi-Fi toggle on connected device (`96d9c774`), confirmed visual rendering in both dark and light modes, verified retry button behavior and smooth post-reconnect dismissal.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
