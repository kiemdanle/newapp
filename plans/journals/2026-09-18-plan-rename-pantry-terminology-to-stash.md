---
title: "Plan: Rename Pantry Terminology to Stash"
date: 2026-09-18
summary: "Validated comprehensive implementation plan to rename user-facing pantry terminology to stash across mobile, admin, and emails while preserving category and location presets"
---

# Plan: Rename Pantry Terminology to Stash

Validated comprehensive implementation plan to rename user-facing pantry terminology to stash across mobile, admin, and emails while preserving category and location presets.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Context & Objectives
- Migrates all user-facing instances of "Pantry" to "Stash" across:
  - Mobile App (`apps/mobile`): Drawer navigation, headers, empty states, scanner action buttons, item detail screens, giveaway fast-fill modals, household settings, and onboarding.
  - Admin Dashboard (`apps/admin`): Sidebar nav, KPI metrics, stash limits/units configuration, catalogue protection alerts, and item explorer.
  - Email & Notifications (`api`): Household invitation/joined emails and SMTP defaults.
  - Shared Package (`@expyrico/shared`): Contributor Level 4 tier title ("Pantry Scout" → "Stash Scout").
- **Strict Exclusions**:
  - Food Category list (`Produce`, `Dairy`, `Bakery`, `Pantry`, `Meat`, `Frozen`) strictly preserves `'Pantry'`.
  - Storage Location Presets (`Fridge`, `Freezer`, `Pantry`, `Cabinet`, `Counter`) strictly preserves `'Pantry'`.
  - Admin Location Presets strictly preserves `'Pantry'`.
- **Architectural Invariants**:
  - Database schema tables (`records`, `households`, `system_settings`), columns, and constraints remain untouched.
  - API endpoints and internal SQLite/WatermelonDB storage keys (`dbName: 'pantry'`, `pantry.access_token`) remain intact.

## Validation & Critical Decisions
- Auto-scaled verification pass checked 24 sampled claims across all 7 phases with 0 failures.
- User interview confirmed:
  1. Scope pluralization: "All Stashes" (matching "Personal Stash" / "All Stashes").
  2. Home tab: Keep "In Stock" for active items, with history tab labeled "Stash history".
  3. Admin routes: Preserve existing URL paths (`/settings/pantry-limits`, `/pantry-items`) and update UI labels only.
  4. Database: Keep internal WatermelonDB database name and secure storage keys intact.
- Whole-plan consistency sweep confirmed zero unresolved contradictions.
