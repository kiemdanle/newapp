---
title: "Completed Migration: Rename Pantry Word Phrase to Stash"
date: 2026-09-18
summary: "Executed all 7 phases to migrate user-facing pantry terminology to stash across mobile, admin, and emails while strictly preserving food categories and storage location presets"
---

# Completed Migration: Rename Pantry Word Phrase to Stash

Executed all 7 phases to migrate user-facing pantry terminology to stash across mobile, admin, and emails while strictly preserving food categories and storage location presets.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Delivered Slices
1. **Shared Package (`@expyrico/shared`)**:
   - Updated Level 4 contributor tier title from `'Pantry Scout'` to `'Stash Scout'`.
   - Built and vendored distribution to `apps/mobile/local-packages/@expyrico/shared/dist/`.
   - Verified mobile resolution of Level 4 title (`title === 'Stash Scout'`).
2. **Mobile Navigation & Home (`apps/mobile`)**:
   - Navigation drawer: `'Stash'`, scope pills `'Personal Stash'`, `'All Stashes'`, `'Household Stash'`.
   - Home header: `'Stash'`, tab `'In Stock (13/20)'`, tab `'History (1)'`.
   - Empty state: `'Start your stash'`.
   - Scope toggle: `'Filter stash: ...'`.
   - Connection & sync notices: updated to reference stash.
3. **Scanner & Product Add (`apps/mobile`)**:
   - Viewfinder eyebrow: `'STASH SCAN'`.
   - Escape hatch buttons: `'Add as Private Item for My Stash'`, `'Add to Stash Manually'`.
   - Product submission confirmation: `'Add to Stash'`.
   - Draft action drawer & fast-add modal: `'Add to Stash'`.
4. **Item Detail, Giveaways & Settings (`apps/mobile`)**:
   - Item detail screen: `'Stash item'`, `'Stash Location'`, `'Back to stash'`, `'Add another to stash'`, `'Move to Personal Stash'`.
   - Giveaway creation: hero card `'Select from Your Stash'`, modal `'Select from Stash'`, `'Your stash is empty'`.
   - Deal creation: `'Select from stash'`.
   - Household settings: `'Share a stash with your people'`, `'Default Stash for New Items'`, `'Default Household Stash'`, invite share message `'Join my stash "{name}" on Expyrico...'`.
   - Auth screens: `'Keep your stash visible...'`, `'Sign in to your Expyrico stash'`, `'Start tracking stash items...'`, `'protect your stash'`.
5. **Admin Dashboard (`apps/admin`)**:
   - Sidebar nav: `'Stash limits'`, `'Stash units'`, `'Stash Items'`.
   - Overview & Analytics KPIs: `'Stash Records'`.
   - Stash limits & units settings forms: `'Maximum Active Stash Items'`, `'Stash Configuration'`.
   - Product catalogue: column `'Stash Items'`, delete modal warning `'This product is in use by stash items and cannot be deleted.'`, and merge tool copy.
   - API delete endpoint: `api/src/routes/admin/products/delete.ts` updated to return `"used by N stash items"`.
   - Stash items explorer: `'Stash Items'`, `'No stash items found.'`.
6. **Server Emails & Workers (`api`)**:
   - Email templates: `'Shared Stash Invitation'`, `'Welcome to {name}'s shared stash!'`.
   - Default SMTP sender: `'Stash <no-reply@stash.local>'`.
   - Worker comments: `'// 4. Stash record expiry notifications'`.
7. **Exclusions Strictly Preserved**:
   - Storage location preset `'Pantry'` in `DEFAULT_TOP_LOCATIONS`/`COMMON_OTHER_LOCATIONS` and Admin `LOCATION_PRESETS` (`'Fridge', 'Freezer', 'Pantry', 'Cabinet', 'Counter'`).
   - Food category quick chips in manual add forms (`'Produce', 'Dairy', 'Bakery', 'Pantry', 'Meat', 'Frozen'`).

## Verification & Deployment
- All 4 packages passed TypeScript typechecks (`tsc --noEmit`) with 0 errors.
- Unit tests passed across `@expyrico/shared`, `@expyrico/admin`, and `api`.
- Native Gradle Android debug APK built and installed via adb on physical Xiaomi MI 9.
- Live device screenshots captured confirming UI rendering across Home, Drawer, Item Details, Scanner, Location Presets, and Household.
- Production server `api.linhkienkts.com` synced with `origin/main`, services `pantry-api` and `pantry-admin` rebuilt and running.
