---
title: "Community Contributor Levels, Admin Level Editor & Product Templates"
description: "Introduce a Google Maps Local Guides-style 10-tier community contributor ranking and leveling system with seeded defaults, customizable and toggleable via the Admin Dashboard, separate 'My Contributed Products' from personal 'Product Templates', and enable full Edit/Add/Delete slide-left actions across all templates."
status: pending
priority: P1
effort: "8h"
tags: [mobile, admin, api, shared, gamification, contributor-levels, profile, templates, pantry]
created: 2026-09-10
---

# Community Contributor Levels, Admin Level Editor & Product Templates

## Overview

This plan establishes a complete end-to-end community contribution and progression system across `@expyrico/shared`, `api`, `apps/admin`, and `apps/mobile`:

1. **Google Maps-Style 10-Tier Contributor Ranking System**:
   - Seeded with 10 recommended default levels ("Novice Scout" to "Expyrico Champion").
   - Points earned from products added (+10 pts), packaging photos (+5 pts), catalog approvals (+10 bonus pts), and accepted edits (+5 pts).
2. **Admin Dashboard Control & Level Customizer (`apps/admin`)**:
   - Master toggle: **Enable / Disable contributor levels on user profiles**.
   - Interactive 10-tier level editor under **Settings > Contributor levels** allowing admins to adjust Level Titles, Points Required, Products Required, Badge Icons, Badge Colors, and Perks.
   - "Reset to Recommended Defaults" button to restore seeded configuration.
   - Fully persisted in `Setting` table with audit logging.
3. **Profile Gamification (`apps/mobile`)**:
   - Hero Contributor card in `profile.tsx` with medal icon, level title, and animated progress bar to the next level ("180 / 300 pts • 12 products to Level 5 Catalog Explorer").
   - Tapping opens the 10-Level Roadmap modal.
   - Cleanly hidden when disabled by admin in the dashboard.
4. **Clean Domain Separation**:
   - **"Community Contributions" Screen**: Dedicated history listing all products the user has contributed to the community catalog (`active`, `pending`, `changes_required`, `report_hidden`), showing review statuses and timestamps.
   - **"Product Templates" Screen**: Redesigned template restocker where **every single item** features slide-left **Edit**, **Add to Pantry**, and **Delete** (where deleting dismisses the item from the user's template list without deleting public catalog products).

---

## Seeded Default Contributor Levels (Google Maps Local Guides Model)

| Level | Badge Icon | Level Title | Products Req. | Total Points | Unlocks & Community Perks |
|:---:|:---:|:---|:---:|:---:|:---|
| **Lv. 1** | 🌱 Seedling | **Novice Scout** | 1 product | 10 pts | Unlocks "Community Contributions" section in profile |
| **Lv. 2** | 🥉 Bronze Star | **Junior Contributor** | 3 products | 30 pts | Bronze profile badge, community contributor flair |
| **Lv. 3** | 🥉 Bronze Star+ | **Active Contributor** | 7 products | 70 pts | Priority review queue in admin moderation |
| **Lv. 4** | 🥈 Silver Star | **Pantry Scout** | 15 products | 150 pts | Silver badge, special contributor spotlight tag |
| **Lv. 5** | 🥈 Silver Star+ | **Catalog Explorer** | 30 products | 300 pts | Direct edit suggestion rights, Explorer profile border |
| **Lv. 6** | 🥇 Gold Star | **Senior Contributor** | 60 products | 600 pts | Gold badge, Community Hero tag on public giveaways/deals |
| **Lv. 7** | 🥇 Gold Star+ | **Catalog Pioneer** | 120 products | 1,200 pts | Catalog Pioneer profile banner, boosted review weight |
| **Lv. 8** | 💎 Emerald Gem | **Master Contributor** | 250 products | 2,500 pts | Emerald badge, featured in Monthly Community Leaderboard |
| **Lv. 9** | 👑 Sapphire Crown | **Catalog Legend** | 500 products | 5,000 pts | Sapphire Crown medal, exclusive beta features & tester role |
| **Lv. 10** | 🌟 Diamond Starburst | **Expyrico Champion** | 1,000+ products | 10,000 pts | Animated golden starburst badge, permanent Hall of Fame |

### Point Formula
* **Add new product (name + barcode/QR)**: +10 pts
* **Add clear packaging photo**: +5 pts
* **Product approved into canonical catalog**: +10 bonus pts
* **Accepted product edit/correction**: +5 pts

---

## Phases

| # | Phase | Status | Summary |
|---|-------|--------|---------|
| 1 | [Phase 1: Shared Contributor Levels & Seeding](./phase-01-start.md) | Pending | Define seeded 10-tier levels, Zod schemas, progression formula, and admin setting schemas in `@expyrico/shared`. |
| 2 | [Phase 2: Admin Dashboard Level Editor & Toggle](./phase-02-backend-contributions-api.md) | Pending | Build Settings > Contributor levels page in `apps/admin` with master toggle, 10-tier editor, and audit logging. |
| 3 | [Phase 3: Backend Contributions API & Template Dismissal](./phase-03-profile-contributor-card-and-progress.md) | Pending | Implement `GET /v1/me/contributions` reading admin-configured levels, and add `isDismissedFromTemplates` to allow deleting templates safely. |
| 4 | [Phase 4: Profile Contributor Card & Next-Level Progress](./phase-04-community-contributions-screen.md) | Pending | Add Hero Contributor card, progress bar to next level, and 10-level Roadmap modal in `profile.tsx` (gated by admin toggle). |
| 5 | [Phase 5: Community Contributions Screen](./phase-05-fast-add-product-templates-and-swipe-menu.md) | Pending | Build `CommunityContributionsScreen` listing all contributed catalog products with review statuses and timestamps. |
| 6 | [Phase 6: Fast-Add Product Templates & Swipe Actions](./phase-06-testing-and-verification.md) | Pending | Unify Product Templates screen so every item reveals Edit, Add to Pantry, and Delete (dismissal) actions on swipe-left. |
| 7 | [Phase 7: Testing, Build & Device Verification](./phase-07-admin-dashboard-feature-flag-toggle.md) | Pending | Unit & integration tests across shared/admin/api/mobile, local Gradle APK build, and ADB install & check on device `96d9c774`. |

## Success Criteria

- [ ] `@expyrico/shared` exports seeded `DEFAULT_CONTRIBUTOR_LEVELS`, `computeContributorProgression`, and admin settings schemas.
- [ ] Admin dashboard under **Settings > Contributor levels** provides a master enable/disable toggle and an interactive editor for all 10 levels.
- [ ] Admins can edit titles, points, badge icons, and colors, or reset to recommended defaults, with full audit logging.
- [ ] `GET /v1/me/contributions` returns computed contributor level, total points, next level progress, and contributed catalog products.
- [ ] User profile (`profile.tsx`) features an interactive Contributor Level card with medal icon, title, and animated progress bar to next level (hidden when disabled by admin).
- [ ] Tapping the Contributor card opens the `ContributorLevelRoadmapModal` showcasing all 10 levels and unlocked perks.
- [ ] "Community Contributions" screen displays all user-created catalog items with status badges (`Catalog Active`, `Awaiting Review`, `Changes Requested`).
- [ ] "Product Templates" screen allows fast pantry re-adds and reveals **Edit**, **Add to Pantry**, and **Delete** on **every** item.
- [ ] Deleting an active template removes it from the user's template list without deleting or breaking the public community catalog product.
- [ ] All automated test suites pass across `packages/shared`, `api`, `apps/admin`, and `apps/mobile`.
- [ ] Debug APK builds cleanly via Gradle and installs via ADB on device `96d9c774`.

<!-- slug: mobile-contributor-levels-and-product-templates -->
