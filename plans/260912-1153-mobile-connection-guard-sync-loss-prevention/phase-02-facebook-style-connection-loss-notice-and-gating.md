---
phase: 2
title: "Facebook-Style Connection Loss Notice & App-Level Gating"
status: pending
priority: P1
effort: "5h"
dependencies: ["phase-01-start.md"]
---

# Phase 2: Facebook-Style Connection Loss Notice & App-Level Gating

## Overview
Design and build a polished, Facebook-style full-screen connection loss notice component (`ConnectionNotice.tsx`) and integrate it into the root mobile app hierarchy (`App.tsx`), gating user interaction on boot and during runtime disconnection to prevent unsynchronized local changes.

## Requirements
- Functional:
  - Full-screen barrier displayed whenever `connectionStore.status !== 'ready'`. <!-- Updated: Validation Session 1 - Full-screen blocking overlay confirmed -->
  - Display informative headline ("No Internet Connection" or "Can't Connect to Expyrico Server").
  - Clear, reassuring subtitle explaining that connection is required to keep pantry items, shared households, and catalog data safely in sync.
  - Diagnostic status pill (e.g. `● Internet: Disconnected` or `● Internet: Active • Server: Unreachable`).
  - Prominent "Try Again" CTA button:
    - Displays loading spinner while retry is in flight.
    - Disabled during active retry to prevent double-taps.
  - Startup gate: `RootApp` in `apps/mobile/src/App.tsx` awaits initial connection probe before rendering `RootNavigator`. If connection fails on boot, the `ConnectionNotice` renders immediately without exposing interactive screens.
  - Runtime overlay: If connection drops while user is navigating, `ConnectionNotice` overlays the screen, preventing stale mutations until reconnected.
- Non-functional:
  - Adhere strictly to Expyrico color palette (`docs/design/expyrico-colour-palette.md`):
    - Dark mode: Charcoal background `#121A15`, elevated card `#18241D`, Fresh Sage `#4BAE8A` button, Honey `#F5A623` diagnostic badge, `#FAFAF8` text.
    - Light mode: Warm White `#FAFAF8`, Mint Mist `#D6F0E6` card accents, Deep Sage `#3A8F6F` button, Almost Black `#2C2C28` text.
  - Smooth entrance animation (subtle fade & scale) and zero layout jank.
  - Accessibility: WCAG AA contrast compliant, proper accessibility labels and hints on the Retry button.

## Architecture
- `apps/mobile/src/components/ConnectionNotice.tsx`:
  - Renders disconnected icon badge (cloud with offline diagonal slash or wifi alert), typography, diagnostic badge, and primary "Try Again" button.
  - Connects to `useConnectionStore` for status and `retry` trigger.
- `apps/mobile/src/App.tsx`:
  - Wire `useConnectionStore` into `RootApp`.
  - When `status !== 'ready'`, render `<ConnectionNotice />`.

## Related Code Files
- Create:
  - `apps/mobile/src/components/ConnectionNotice.tsx`
  - `apps/mobile/src/components/__tests__/ConnectionNotice.test.tsx`
- Modify:
  - `apps/mobile/src/App.tsx` (wire startup gate and root-level connection notice)

## Implementation Steps
1. Create `ConnectionNotice.tsx`:
   - Design layout with modern, serene Facebook-style aesthetics:
     - Top icon container with subtle pulse ring.
     - Title and message centered with generous whitespace.
     - Diagnostic pill highlighting exact network vs. server state.
     - Primary action button ("Try Again") with `ActivityIndicator`.
   - Implement dark and light mode styling via `useTheme()`.
2. Update `apps/mobile/src/App.tsx`:
   - Integrate `initConnectionMonitoring()` in `useEffect` on app mount.
   - Include `connectionChecked` in `splashReady` calculation.
   - Render `ConnectionNotice` when `connectionStore.status !== 'ready'`.
3. Write Jest component tests verifying rendering, dark/light theme tokens, diagnostic messages, and "Try Again" interaction.

## Success Criteria
- [x] User cannot access pantry, drafts, or profile screens when app is opened in airplane mode.
- [x] Facebook-style connection loss notice appears cleanly with correct theme colors.
- [x] Diagnostic status shows "No Internet Connection" when Wi-Fi/data is off.
- [x] Diagnostic status shows "Server Unreachable" when internet is active but API is blocked or offline.
- [x] "Try Again" button triggers `retry()` and displays a loading spinner during re-evaluation.
- [x] Component unit tests pass with full snapshot and interaction coverage.

## Risk Assessment
- **Risk**: Flash of connection notice during normal app startup on fast networks.
  - **Mitigation**: Keep splash screen visible (`splashReady`) while initial connection check completes (typically 50-150ms). Only reveal `ConnectionNotice` if the initial check explicitly fails.
