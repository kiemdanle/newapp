---
title: "Product Edit Suggestions and Admin Moderation Pipeline"
description: "Enable authenticated mobile users to suggest edits for any product (name, description, brand, category, default shelf life days, note/reason, and up to 5 photos), route suggestions to the unified admin moderation queue, and atomically apply approved suggestions to the live product catalog."
status: completed
priority: P1
effort: L
branch: "main"
tags: [products, moderation, product-edits, mobile, admin, api, shared-schemas]
blockedBy: []
blocks: []
created: "2026-08-27T04:09:39.895Z"
createdBy: "ck:plan"
source: skill
---

# Product Edit Suggestions and Admin Moderation Pipeline

## Executive Summary

This plan delivers a comprehensive, end-to-end product edit suggestion and moderation subsystem. Any authenticated mobile user can view any active catalog product on the Product Detail screen and suggest corrections for inaccurate or incomplete details—including **Product Name**, **Description**, **Brand**, **Category** (freeform text input), **Default Shelf Life Days**, **Reason/Notes for Moderators**, and **Product Photos** (up to 5 photos: retain, add, remove, and reorder).

Submitted suggestions immediately populate the **Unified Admin Moderation Queue** in the Admin Dashboard (`/products/pending`). Administrators can inspect side-by-side visual diffs (live vs. proposed metadata, submitter rationale card, and live vs. proposed photo sets), approve suggestions (which atomically publishes new media, writes audit logs, records notification outbox events, and updates the live product catalog), or request changes with actionable moderation notes.

## Problem Statement & Scope

1. **Information Inaccuracy in Community Catalog**: Products scanned from barcodes or seeded from external providers may have missing descriptions, wrong categories, outdated shelf lives, or poor-quality photos.
2. **Missing Product Fields in Edit DTOs**: While `Product` contains `defaultShelfLifeDays` and `ProductEdit` has a `notes` column in PostgreSQL, `ProductEditRow`, `ProductEditMetadataPatchRequest`, and `approveEdit` currently omit `defaultShelfLifeDays` and submitter rationale.
3. **Submitter Rationale**: Users can attach an optional explanation note (max 1000 chars) explaining why the information is wrong (e.g., "The packaging label states 14 days shelf life, not 30 days").
4. **Admin Moderation Surface Completeness**: The Admin comparison view displays the complete spectrum of product metadata changes (including shelf life and submitter notes) alongside photo reordering and additions.

## Architectural Design

```
+-----------------------------------------------------------------------------------+
|                                  MOBILE CLIENT                                    |
|  Product Detail Screen (product/[id].tsx)                                         |
|                                       │                                           |
|                             [Suggest an Edit]                                     |
|                                       │                                           |
|                                       ▼                                           |
|                           ProductEditScreen (edit.tsx)                            |
|                 ┌──────────────────────────────────────────────┐                  |
|                 │ • ProductEditForm:                           │                  |
|                 │   - Name (required, max 200 chars)           │                  |
|                 │   - Description (optional, max 2000 chars)   │                  |
|                 │   - Brand (optional, max 120 chars)          │                  |
|                 │   - Category (freeform text, max 120 chars)  │                  |
|                 │   - Default Shelf Life (1-3650 days)         │                  |
|                 │   - Submitter Reason/Notes (max 1000 chars)  │                  |
|                 │ • ProductPhotoEditor (0-5 Photos)            │                  |
|                 │ • EditSubmitPanel (Submit with idempotency)  │                  |
|                 └──────────────────────────────────────────────┘                  |
+---------------------------------------┬-------------------------------------------+
                                        │
                         POST /products/:id/edits (Create/Resume)
                         PATCH /product-edits/:editId (Metadata)
                         POST /product-edits/:editId/photos (Upload)
                         POST /product-edits/:editId/submit (Submit)
                                        │
                                        ▼
+-----------------------------------------------------------------------------------+
|                                   BACKEND API                                     |
|  Fastify 4 + Prisma 5 + PostgreSQL + VPS Media Pipeline                           |
|                                       │                                           |
|  1. product-edits.ts: createOrResumeProductEdit seeds all product fields          |
|  2. patchProductEditMetadata: updates proposed JSON & notes on ProductEdit        |
|  3. submitProductEdit: sets status='pending', records notification event          |
|  4. approveEdit: transactional lock, publishes staged photos to public CDN,       |
|     atomically updates Product (name, desc, brand, category, shelf life, photos), |
|     writes AdminAuditLog, sets ProductEdit status='approved', records outbox.     |
|  5. requestChangesOnEdit: sets status='changes_required', records admin feedback. |
+---------------------------------------┬-------------------------------------------+
                                        │
                         GET /api/admin/products/pending
                         GET /api/admin/products/pending/:editId
                         PATCH /api/admin/products/pending/:editId
                                        │
                                        ▼
+-----------------------------------------------------------------------------------+
|                                ADMIN DASHBOARD                                    |
|  Next.js 15 Unified Moderation Queue (/products/pending)                          |
|                                       │                                           |
|  • RevisionDetail (/products/pending/[editId])                                    |
|  • Submitter Reason Card (revision.notes context)                                 |
|  • RevisionComparison (Side-by-side Live vs Proposed table: Name, Brand,          |
|    Category, Description, Shelf Life Days, and Photos)                           |
|  • PendingActions (Approve / Request Changes with note)                           |
+-----------------------------------------------------------------------------------+
```

## Global Constraints & Standards

- **Expyrico Brand Palette**: Follow `docs/design/expyrico-colour-palette.md` strictly (#4BAE8A Fresh Sage, #3A8F6F Deep Sage, #D6F0E6 Mint Mist, #FAFAF8 Warm White, #F5A623 Honey, #FEEFC3 Soft Butter, #F0F0ED Stone, #8C8C85 Pebble, #2C2C28 Almost Black, #E0442A Alert Red for destructive/expired only).
- **Optimistic Concurrency**: Both ProductEdit and Product mutations enforce version tokens (`version` and `baseProductVersion`) to prevent lost updates under concurrency.
- **Atomic Cutover**: `approveEdit` executes in a single database transaction with row locks, ensuring catalog updates, photo promotions, audit logging, and edit status transitions succeed or fail together.
- **Media Safety**: Quarantined upload processing via Sharp, stripped EXIF metadata, max 5 photos (index 0 is cover), WebP format.

## Phase Roadmap

| Phase | Name | Scope | Key Deliverables |
|---|---|---|---|
| 1 | [Shared schemas and data contracts](./phase-01-shared-schemas-and-data-contracts.md) | `@expyrico/shared` | `ProductEditRow`, `ProductEditMetadataPatchRequest`, `defaultShelfLifeDays`, submitter `notes` |
| 2 | [Backend API and moderation engine](./phase-02-backend-api-and-moderation-engine.md) | `api` | `product-edits.ts`, `approveEdit` atomic application of all fields, audit logging, outbox notification dispatch |
| 3 | [Admin moderation console](./phase-03-admin-moderation-console.md) | `apps/admin` | `RevisionComparison.tsx`, `RevisionDetailPage`, Submitter Note Card, shelf life diff, approval actions |
| 4 | [Mobile edit suggestion UI and touchpoints](./phase-04-mobile-edit-suggestion-ui-and-touchpoints.md) | `apps/mobile` | `ProductEditForm.tsx`, `EditEditor.tsx`, `ProductEditScreen`, Product Detail screen "Suggest an edit" flow |
| 5 | [Verification and testing](./phase-05-verification-and-testing.md) | Monorepo | Integration tests, mobile component tests, admin tests, monorepo typecheck, build validation |

## Validation Log

### Verification Results
- Claims checked: 18
- Verified: 18 | Failed: 0 | Unverified: 0
- Tier: Full (Fact Checker, Contract Verifier, Pattern Police, Failure Mode Analyst)
- Failures: None

### Interview Decisions
1. **Submitter Rationale**: Include Submitter Reason/Notes. Submitter notes are stored in `ProductEdit.notes` (max 1000 chars) and rendered as a dedicated callout card in the Admin Moderation Console.
2. **Category Input UX**: Freeform Text Only. Category input in `ProductEditForm` remains a clean text input with live comparison caption, matching existing catalog conventions.
3. **Touchpoint Scope**: Product Detail Screen Focused. The primary "Suggest an edit" button is positioned on the Product Detail screen (`product/[id].tsx`). Pantry records already contain the catalog link to navigate to Product Details.
4. **Resolution Feedback Policy**: Outbox Notifications + In-App State Banners. Approving or requesting changes emits notification outbox events and updates the in-app suggestion status banner when viewed by the user.

## Red Team Review

### Session — 2026-08-27
**Findings:** 8 (8 accepted, 0 rejected)
**Severity breakdown:** 2 Critical, 4 High, 2 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `createOrResumeProductEdit` 409 error blocks read-only pending summary view | Critical | Accept | Phase 2, Phase 4 |
| 2 | Missing `defaultShelfLifeDays` fallback in `approveEdit` proposed JSON | Critical | Accept | Phase 2 |
| 3 | Submitter notes length bounds and empty string validation | High | Accept | Phase 1 |
| 4 | Stale base rebase/supersede logic missing `defaultShelfLifeDays` and `notes` | High | Accept | Phase 2 |
| 5 | `ProductEditForm` numeric string sanitization & NaN prevention | High | Accept | Phase 4 |
| 6 | Shelf life numeric bounds & formatting in mobile inputs | High | Accept | Phase 4 |
| 7 | Admin `RevisionComparison` diff highlighting accuracy for formatted shelf life | Medium | Accept | Phase 3 |
| 8 | Admin audit log missing `defaultShelfLifeDays` and `notes` before/after diffs | Medium | Accept | Phase 2 |

### Whole-Plan Consistency Sweep
- Files reread: `plan.md`, `phase-01-shared-schemas-and-data-contracts.md`, `phase-02-backend-api-and-moderation-engine.md`, `phase-03-admin-moderation-console.md`, `phase-04-mobile-edit-suggestion-ui-and-touchpoints.md`, `phase-05-verification-and-testing.md`
- Decision deltas checked: 8
- Reconciled stale references: 8
- Unresolved contradictions: 0

## Success Criteria

- [x] Users can trigger "Suggest an edit" from the Product Detail screen.
- [x] Users can edit Product Name, Description, Brand, Category, Default Shelf Life Days, add Submitter Notes, and manage up to 5 photos.
- [x] Submitting a suggestion updates its state to `pending` and queues it in the Admin Dashboard moderation queue.
- [x] Pending suggestions can be inspected by the creator in read-only mode without hitting 409 conflict errors.
- [x] Admin dashboard displays clear side-by-side diffs of all product attributes, submitter rationale card, and photo sets.
- [x] Admin approval atomically updates the live `Product` catalog item, publishes media, writes audit logs, and marks the edit `approved`.
- [x] Admin request for changes provides feedback to the user, allowing them to resume and correct their suggestion.
- [x] Stale revisions can be rebased or superseded while preserving shelf life and notes.
- [x] All automated unit, integration, and typecheck test suites pass across `@expyrico/shared`, `api`, `apps/mobile`, and `apps/admin`.
