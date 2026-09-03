---
title: "Global and Per-User Product Approval Configuration"
description: "Implement admin controls to globally enable/disable new product approval and configure per-user approval requirements to prevent spam."
status: pending
priority: P1
effort: "2d"
tags: [admin, products, moderation, spam-prevention, settings]
created: 2026-09-03
---

# Global and Per-User Product Approval Configuration

## Overview

Currently, whenever a mobile app user submits a newly scanned product draft, the system unconditionally places the product into `status: 'pending'` and records a moderation notification event for manual review in the admin queue (`/products/pending`).

This plan implements a two-tier configuration system requested by the product team:
1. **Global Setting**: An admin toggle to enable or disable new product approval globally. When disabled, newly submitted community products are immediately approved and published to the active catalog without waiting in the moderation queue.
2. **Per-User Configuration (Anti-Spam Override)**: An admin toggle on each individual user profile specifying whether that user requires product approval. The default for all users is `requireProductApproval: false` (allowed to publish without manual review under the global auto-approval policy). If a specific user starts posting spam, admins can flag that user with `requireProductApproval: true`, forcing all their future submissions into the moderation queue even when global auto-approval is active.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Extend `@expyrico/shared` and Prisma with global `requireApproval` setting and per-user `requireProductApproval` flag | P1 |
| 2 | Build backend auto-approval engine in `api` that automatically promotes submitted products, publishes photos, and sets `imageUrl` when approval is not required | P1 |
| 3 | Enforce anti-spam priority: user-level `requireProductApproval: true` strictly overrides global auto-approval to prevent spam abuse | P1 |
| 4 | Add Global Product Approval toggle to Admin Settings (`/settings/feature-flags`) with clean audit logging | P1 |
| 5 | Add per-user product approval controls, indicators, and actions on Admin User Detail (`/users/[id]`) and User Directory (`/users`) | P1 |
| 6 | Comprehensive test suite covering auto-approval, photo promotion, permission overrides, and admin management | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Shared Schemas, Database Model & Migration](./phase-01-start.md) | Pending |
| 2 | [Phase 2: Backend Auto-Approval Engine & API Service](./phase-02-backend-auto-approval-engine.md) | Pending |
| 3 | [Phase 3: Admin Global Approval Settings UI](./phase-03-admin-global-settings-ui.md) | Pending |
| 4 | [Phase 4: Admin Per-User Approval Configuration UI](./phase-04-admin-per-user-approval-ui.md) | Pending |
| 5 | [Phase 5: Verification, Integration Testing & Runbook](./phase-05-verification-and-testing.md) | Pending |

## Architectural Decision: Approval Resolution Logic

When a user submits a product draft (`POST /v1/products/drafts/:id/submit`), the backend determines whether manual review is required according to this strict precedence:

```
                  ┌────────────────────────────────────────┐
                  │ User submits product draft             │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │ Is user.requireProductApproval == true?│
                  └─────────┬────────────────────┬─────────┘
                            │ Yes                │ No (Default)
                            ▼                    ▼
             ┌─────────────────────────┐   ┌──────────────────────────────┐
             │ FORCED MODERATION:      │   │ Is global requireApproval ON?│
             │ Status: 'pending'       │   └───────┬──────────────┬───────┘
             │ Enter moderation queue  │           │ Yes          │ No (Default)
             └─────────────────────────┘           ▼              ▼
                                     ┌──────────────────┐   ┌──────────────────────┐
                                     │ MODERATION:      │   │ AUTO-APPROVED:       │
                                     │ Status: 'pending'│   │ Status: 'active'     │
                                     │ Enter queue      │   │ Publish photos       │
                                     └──────────────────┘   │ Immediate in catalog │
                                                            └──────────────────────┘
```

Formula:
```typescript
const needsApproval = user.requireProductApproval === true || globalSettings.requireApproval === true;
```

This guarantees:
1. When global approval is **disabled** (`requireApproval: false`): Standard users experience instant publishing (`active`), while spam-flagged users are caught in moderation (`pending`).
2. When global approval is **enabled** (`requireApproval: true`): All users require moderation before catalog release.

## Success Criteria

- [ ] Prisma migration cleanly adds `require_product_approval` to `users` table with default `false`.
- [ ] `@expyrico/shared` exports updated schemas for settings and admin user endpoints.
- [ ] `submitDraft` automatically activates products and promotes private media to public storage when approval is disabled.
- [ ] Flagging a user in Admin sets `requireProductApproval: true`, successfully redirecting their submissions to `/products/pending`.
- [ ] Admin Settings page exposes a toggle to switch global approval on and off with immediate effect.
- [ ] Admin User detail page displays current approval status and allows toggling with confirmation and audit logging.
- [ ] All unit and integration tests across `@expyrico/shared`, `api`, and `apps/admin` pass cleanly.

## Validation Log

### Session 1 — 2026-09-03
**Trigger:** User-initiated critical questions validation interview (`/ak:plan validate`)
**Questions asked:** 4

#### Verification Results
- **Tier:** Full (5 phases)
- **Claims checked:** 16
- **Verified:** 16 | **Failed:** 0 | **Unverified:** 0
- **Evidence:**
  - `submitDraft` in `api/src/services/products/product-drafts.ts:245` (VERIFIED)
  - `SETTING_KEYS.PRODUCT_CREATION` in `api/src/services/admin/settings.ts:34` (VERIFIED)
  - `adminUsersPatchRoute` in `api/src/routes/admin/users/patch.ts:10` (VERIFIED)
  - `FlagsForm` in `apps/admin/src/app/(admin)/settings/feature-flags/flags-form.tsx:19` (VERIFIED)
  - `UserActions` in `apps/admin/src/app/(admin)/users/[id]/user-actions.tsx:21` (VERIFIED)
  - `publishProductPhoto` in `api/src/services/products/product-moderation.ts:175` (VERIFIED)

#### Questions & Answers

1. **[Architecture]** When a community product is auto-approved, how should admins be alerted?
   - Options: Audit log only (Silent) (Recommended) | Notify admins on auto-publish
   - **Answer:** Audit log only (Silent)
   - **Rationale:** Prevents noise in admin notification channels and inboxes; auto-approved events are recorded in structured audit logs.

2. **[Anti-Spam Scope]** When an admin marks a user as 'Approval Required' (anti-spam), how should past submissions be treated?
   - Options: Future submissions only (Recommended) | Future submissions + flag recent products
   - **Answer:** Future submissions only
   - **Rationale:** Ensures clean, predictable state transitions without retroactive mutations on historical active catalog rows.

3. **[Mobile App UX]** How should the mobile app inform the creator after submitting a product?
   - Options: Distinct status messages (Recommended) | Generic status message
   - **Answer:** Distinct status messages
   - **Rationale:** Provides transparent feedback to legitimate creators ("Published to catalog") while cleanly informing restricted/moderated users ("Submitted for review").

4. **[Admin Permissions]** Which admin role should be permitted to flag users for mandatory product approval?
   - Options: All admin users (Recommended) | Super-admins only
   - **Answer:** All admin users
   - **Rationale:** Empowers all support and moderation staff to respond immediately to active spam runs without privilege bottlenecks.

#### Confirmed Decisions
- **Admin alerting on auto-approval**: Audit log only (silent, no admin notification spam).
- **Spam flag scope**: Future submissions only (no retroactive catalog mutations).
- **Mobile client submission response**: Distinct status messaging based on post-submit status (`active` vs `pending`).
- **RBAC permissions**: All authenticated admin users can toggle approval requirements.

#### Action Items
- [ ] Phase 2: In `api/src/services/products/auto-approval.ts`, omit admin notification events on auto-approval, recording only structured audit log (`product.auto_approve`).
- [ ] Phase 2: Ensure `submitDraft` returns the post-transition product (`status: 'active'` or `status: 'pending'`) so mobile clients can display distinct success dialogs.
- [ ] Phase 4: Ensure `requireAdmin` allows all admin users to toggle `requireProductApproval`.

#### Impact on Phases
- Phase 2: Explicitly specify silent auto-approval (audit log only, no admin notification spam) and distinct API return status.
- Phase 4: Confirmed standard admin RBAC for toggling approval flags.

### Whole-Plan Consistency Sweep
- **Files reread:** `plan.md`, `phase-01-start.md`, `phase-02-backend-auto-approval-engine.md`, `phase-03-admin-global-settings-ui.md`, `phase-04-admin-per-user-approval-ui.md`, `phase-05-verification-and-testing.md`
- **Decision deltas checked:** 4
- **Reconciled stale references:** 0
- **Unresolved contradictions:** 0

## Red Team Review

### Session 1 — 2026-09-03
**Findings:** 5 (5 accepted, 0 rejected)
**Severity breakdown:** 0 Critical, 2 High, 3 Medium

| # | Finding | Severity | Disposition | Applied To | Codebase Evidence |
|---|---------|----------|-------------|------------|-------------------|
| 1 | Unbounded Submission Cycling Under Auto-Approval | High | Accept | Phase 2 | `api/src/services/products/product-creation-quotas.ts:40` |
| 2 | Two-Phase Media Lease & Photo Promotion Atomicity | High | Accept | Phase 2 | `api/src/services/products/product-moderation.ts:175-215` |
| 3 | Unhandled Zero-Photo Product Auto-Approval | Medium | Accept | Phase 2 | `api/src/services/products/product-moderation.ts:139-169` |
| 4 | Missing/Null Creator User Fail-Safe | Medium | Accept | Phase 2 | `api/src/services/products/product-drafts.ts:78,245` |
| 5 | User Directory List Query & Schema Alignment | Medium | Accept | Phase 1, Phase 4 | `api/src/routes/admin/users/list.ts:25`, `packages/shared/src/schemas/admin/users.ts:8` |

#### Key Risk Mitigations Applied
1. **Submission Velocity Throttling**: Added a daily auto-approved submission cap per user in Redis (`product-creation:auto-approved-count:${actorId}:${utcDay}`). Submissions beyond the cap gracefully divert to the `pending` moderation queue instead of flooding the active catalog.
2. **Atomic Media Promotion**: Mirrored the two-phase commit pattern from `product-moderation.ts`: photos are published under a `publish_public` media lease before the database row transitions to `active`.
3. **Zero-Photo Handling**: Added explicit branching for products without photos, bypassing the media lease and updating the product atomically.
4. **Fail-Closed User Resolution**: If creator record is null or missing, system fails closed (`needsApproval = true`).
5. **Admin List Query Alignment**: Added `requireProductApproval` to both `adminUserRowSchema` and the Prisma select in `api/src/routes/admin/users/list.ts`.

### Whole-Plan Consistency Sweep (Post-Red Team)
- **Files reread:** `plan.md`, `phase-01-start.md`, `phase-02-backend-auto-approval-engine.md`, `phase-03-admin-global-settings-ui.md`, `phase-04-admin-per-user-approval-ui.md`, `phase-05-verification-and-testing.md`
- **Decision deltas checked:** 5
- **Reconciled stale references:** 0
- **Unresolved contradictions:** 0
