---
phase: 2
title: "Admin Dashboard Level Editor & Toggle"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Admin Dashboard Level Editor & Toggle

<!-- Updated: Validation Session 1 - Admin Flag Scope (Hide Gamification Only) -->
<!-- Updated: Red Team Review Session 1 - getSetting Fallback & Palette Token Picker -->

## Overview

Build the Admin Dashboard page under **Settings > Contributor levels** (`apps/admin/src/app/(admin)/settings/contributor-levels/`) with a master enable/disable toggle and an interactive editor for all 10 contributor levels. Implement the admin settings routes in `api` with audit logging.

## Requirements

### Admin API Endpoints
- `GET /v1/admin/settings/contributor-levels`:
  - Returns `contributorLevelsSettingSchema`: `{ enabled: boolean, levels: ContributorLevelTier[] }`.
  - Fallback in `getSetting`: if no setting row exists in DB, `getSetting(SETTING_KEYS.CONTRIBUTOR_LEVELS, ...)` returns `{ enabled: true, levels: DEFAULT_CONTRIBUTOR_LEVELS }` without throwing.
- `PATCH /v1/admin/settings/contributor-levels`:
  - Authenticated admin only (`onRequest: app.requireAuth`, role: `admin`).
  - Validates body against `contributorLevelsSettingSchema` (enforcing ascending points and Expyrico palette tokens).
  - Persists to `Setting` table under key `SETTING_KEYS.CONTRIBUTOR_LEVELS`.
  - Records an audit log entry in `AdminAuditLog` (`settings.contributor_levels.update`).

### Admin UI (`apps/admin`)
1. **Sidebar Navigation**:
   - Add `{ label: 'Contributor levels', href: '/settings/contributor-levels', icon: 'Award' }` to `apps/admin/src/lib/nav.ts`.
2. **Page & Form Component (`page.tsx` + `levels-editor-form.tsx`)**:
   - Header with Award icon, title **"Contributor Levels & Ranking"**, subtitle *"Configure gamified contributor tiers, point requirements, and profile visibility."*
   - **Master Toggle Card**:
     - Switch: *"Enable contributor levels on user profiles"*.
     - When toggled off, profile level cards and progress meters are hidden for all mobile users.
   - **Interactive Levels Table / Cards**:
     - Displays all 10 tiers in order (Lv 1 to Lv 10).
     - Each tier row allows editing:
       - **Level Title**: text input (e.g. "Novice Scout").
       - **Products Required**: number input (e.g. 1).
       - **Points Required**: number input (e.g. 10).
       - **Badge Icon**: dropdown selector (`seedling`, `bronze_star`, `silver_star`, `gold_star`, `emerald_gem`, `sapphire_crown`, `diamond_starburst`).
       - **Badge Color**: Expyrico palette token selector (`fresh_sage`, `deep_sage`, `mint_mist`, `honey`, `soft_butter`, `pebble`, `almost_black`) with live visual color chip preview. Free-form arbitrary hex inputs are rejected by server schema validation.
       - **Perks / Unlocks Description**: text input.
   - **Action Buttons**:
     - **"Reset to Recommended Defaults"**: Restores the 10 seeded default levels into the form.
     - **"Save Changes"**: Submits via Server Action and displays success toast.

## Related Code Files
- Modify: `api/src/services/admin/settings.ts`
- Create: `api/src/routes/admin/settings/contributor-levels.ts`
- Modify: `api/src/routes/admin/index.ts`
- Modify: `apps/admin/src/lib/nav.ts`
- Modify: `apps/admin/src/lib/admin-api.ts`
- Modify: `apps/admin/src/lib/actions.ts`
- Create: `apps/admin/src/app/(admin)/settings/contributor-levels/page.tsx`
- Create: `apps/admin/src/app/(admin)/settings/contributor-levels/levels-editor-form.tsx`
- Create: `api/tests/integration/admin-contributor-levels-settings.test.ts`

## Implementation Steps
1. Add `CONTRIBUTOR_LEVELS: 'contributor_levels'` to `SETTING_KEYS` in `api/src/services/admin/settings.ts`.
2. Implement admin routes `GET` and `PATCH /v1/admin/settings/contributor-levels` with audit logging.
3. Add server action `saveContributorLevelsAction` in `apps/admin/src/lib/actions.ts`.
4. Build `levels-editor-form.tsx` with toggle, tier editing inputs, reset button, and save handling.
5. Create `page.tsx` loading initial settings via `serverAdminApi`.
6. Add integration tests verifying default return, custom updates, validation rejection on invalid tiers, and audit logging.

## Success Criteria
- [ ] Admin can navigate to `/settings/contributor-levels` from sidebar.
- [ ] Admin can toggle contributor levels on/off.
- [ ] Admin can edit level titles, point thresholds, product requirements, and badge icons.
- [ ] "Reset to Recommended Defaults" restores the seeded 10-tier ladder.
- [ ] Changes persist to DB and write an audit log entry.
- [ ] Tests pass cleanly.
