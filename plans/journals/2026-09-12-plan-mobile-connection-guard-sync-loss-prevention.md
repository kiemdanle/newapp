---
title: "Plan Mobile Connection Guard & Sync Loss Prevention"
date: 2026-09-12
summary: "Designed 3-phase technical implementation plan for dual-layer network and server health verification, Facebook-style connection loss notice, and post-reconnection sync reconciliation."
---

# Plan Mobile Connection Guard & Sync Loss Prevention

Designed a 3-phase technical implementation plan in `plans/260912-1153-mobile-connection-guard-sync-loss-prevention` to solve the sync lost issue between local mobile state and server:

1. **Dual-Layer Connection & Server Health Engine**:
   - Combines `@react-native-community/netinfo` interface state with an active HTTP probe to `${getBaseUrl()}/health` (4s timeout via `AbortController`).
   - Tracks state reactively in a Zustand `connectionStore`: `'checking' | 'ready' | 'offline' | 'server_unreachable'`.

2. **Facebook-Style Connection Loss Notice & App-Level Gating**:
   - Prevents interactive usage on app open and during disconnection, avoiding desynchronized local mutations.
   - Features a serene, Facebook-style full-screen notice (`ConnectionNotice.tsx`) with clear visual badge, diagnostic status breakdown, and a responsive "Try Again" retry CTA matching the Expyrico color palette.

3. **Post-Reconnection State Synchronization & Lifecycle Triggers**:
   - Automatically executes WatermelonDB `runSync()` and invalidates React Query feeds upon reconnection.
   - Re-verifies health on AppState transition to `active`.
   - Validated via unit tests, typechecks, local Gradle build, and ADB device testing.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
