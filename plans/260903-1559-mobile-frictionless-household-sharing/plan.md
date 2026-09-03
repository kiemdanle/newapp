---
title: "Mobile Frictionless Household Sharing"
description: "Streamline pantry sharing: 6-character invite codes, native OS share sheet links, deep-link auto-join, pantry discovery CTA, and default household mode."
status: completed
priority: P1
effort: "2-3d"
tags: ["mobile", "household", "sharing", "deep-link", "api", "ux", "watermelondb"]
created: 2026-09-03
---

# Mobile Frictionless Household Sharing

## Overview

Enable users to share their pantry with partners, family members, or roommates in **under 15 seconds**. Replaces raw 36-character UUID inputs with human-readable 6-character invite codes and native OS share links (`expyrico://household/join?code=...`), surfaces an inviting "Share Pantry" discovery chip directly on the pantry screen for solo users, and introduces a default household mode so new groceries automatically belong to the shared kitchen.

## Problem Statement & Root Cause

1. **Member Onboarding Friction**: Currently, inviting a member requires typing their 36-character UUID string (`userId`). Regular users cannot find or type UUIDs.
2. **Feature Invisibility**: When a user belongs to 0 households, the pantry scope toggle is completely hidden. There is zero visual prompt on the home pantry screen indicating that pantry sharing exists.
3. **Item Sharing Overhead**: Groceries default to Personal. Sharing items requires opening each item's detail screen, scrolling to the bottom, tapping location, and confirming in a picker modal. Couples and families who share all groceries have to repeat this for dozens of items.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Auto-generate unique 6-character alphanumeric invite codes for households on the backend and provide a `POST /v1/households/join` endpoint. | P1 |
| 2 | Add an interactive "Invite to Kitchen" share sheet trigger (`Share.share(...)`) and 6-character code card in the mobile Household view. | P1 |
| 3 | Implement "Join Household" modal with code input and deep link auto-join (`expyrico://household/join?code=...`). | P1 |
| 4 | Add a friendly "Share Pantry" invitation chip on the home pantry screen for solo users and support a "Save new items to this household by default" setting. | P1 |

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [Backend 6-Character Invite Code and Join Route](./phase-01-start.md) | completed | P1 | 3-4h |
| 2 | [Mobile Share Sheet and Invite Code Display](./phase-02-mobile-share-sheet-and-invite-code.md) | completed | P1 | 3-4h |
| 3 | [Mobile Join Household Modal and Deep Link](./phase-03-mobile-join-household-modal-and-deep-link.md) | completed | P1 | 3-4h |
| 4 | [Home Pantry Discovery CTA and Default Household Mode](./phase-04-home-pantry-discovery-cta-and-default-mode.md) | completed | P1 | 4-5h |

## Architecture & Data Flow

```
[User A (Inviter)] ──► Tap "Invite Partner" ──► Native Share Sheet (SMS, WhatsApp, AirDrop)
                                                       │
                                            expyrico://household/join?code=KITCH8
                                                       ▼
[User B (Invitee)] ◄── Tap Link or Enter Code ── DeepLinkHandler / JoinHouseholdModal
        │
        ▼
POST /v1/households/join { code: "KITCH8" }
        │
        ├── Validate invite code & lock row
        ├── Create HouseholdMember (role: member)
        ├── Schedule new member notification reminders
        ▼
201 OK { household: { id, name, ... } }
        │
        ▼
Client triggers WatermelonDB Sync ──► Shared groceries immediately appear in "All" view!
```

## Success Criteria

- [x] Unique 6-character invite code automatically generated for every household (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
- [x] Users can join a household with 1 tap via link (`expyrico://household/join?code=...`) or by typing the 6-character code.
- [x] Native OS share sheet opens with pre-filled inviting copy and link when tapping "Invite".
- [x] Solo users see a clean Expyrico-themed chip on their pantry home screen encouraging household sharing.
- [x] Families can toggle "Default Household" so all scanned and manually added items go straight to the shared pantry.
- [x] 100% automated test coverage across backend endpoints, mobile components, and deep link routing.

## Validation Log

### Verification Results
- Claims checked: 10
- Verified: 10 | Failed: 0 | Unverified: 0
- Tier: Standard
- Pre-interview check: All model relationships, routes, navigation handlers, and store files verified against repository source.

### Interview Decisions
1. **Invite Code Lifetime**: Permanent by default until the owner explicitly taps "Regenerate Code". This prevents broken links sent over chat while giving owners full security control.
2. **Deep Link UX**: Confirmation modal before joining (`Join [Household Name]? You will share pantry items with [Owner Name]. [Join] / [Cancel]`). Prevents accidental joins if links are mis-clicked.
3. **App Launch View**: Pantry opens in unified `'All'` view to uphold Expyrico's anti-food-waste mission, while new grocery scans and manual additions automatically inherit the configured default household.

### Whole-Plan Consistency Sweep
- Status: Passed with 0 contradictions
- Cross-check:
  - Phase 1: Updated to include optional owner regeneration endpoint (`POST /v1/households/:id/regenerate-invite-code`).
  - Phase 2: Updated with "Regenerate Code" affordance in `HouseholdInviteCard`.
  - Phase 3: Confirmation card preview confirmed in `JoinHouseholdModal`.
  - Phase 4: App launch view verified to remain `'all'` while `AddRecordForm` pre-selects `defaultHouseholdId`.

<!-- slug: mobile-frictionless-household-sharing -->
