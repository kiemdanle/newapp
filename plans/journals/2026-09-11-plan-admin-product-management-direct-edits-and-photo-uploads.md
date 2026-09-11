---
title: "Plan: Admin Product Management Direct Edits and Photo Uploads"
date: 2026-09-11
summary: Created technical implementation plan for full product catalog editing and photo uploads in the admin console
---

# Plan: Admin Product Management Direct Edits and Photo Uploads

## Problem
Administrators in `apps/admin` needed full control over product catalog records (`/products/[id]`), including editing core catalog attributes (name, brand, category, description, barcode, shelf life) and direct photo management (uploading new photos via file picker / drag-and-drop, setting cover photo, reordering, and deleting).

## Analysis & Solution Design
1. Fastify backend already features `POST /v1/products/:id/photos`, `PATCH /v1/products/:id/photos/order`, and `DELETE /v1/products/:id/photos/:photoId`.
2. `@expyrico/shared`: `adminProductPatchSchema` needs extension to support `description` and `barcode`.
3. `api`: `adminProductsPatchRoute` needs `description` update and duplicate barcode uniqueness checks.
4. `apps/admin`: `apiServerFetch` needs `FormData` multipart support without forcing `application/json` or stringifying payloads.
5. `ProductActions` needs a complete form with multi-line description and barcode, protected by optimistic concurrency version tracking.
6. `ProductPhotoManager` needs drag-and-drop / file-picker uploads with client-side 5MB limits and a 1-click "Set as Cover" action.

## Plan Structure
Plan created at `plans/260911-0748-admin-product-edit-and-photo-management` with 5 validated phases:
- Phase 1: Schema and API Contracts for Product Edits
- Phase 2: Admin API Client & Upload Foundation
- Phase 3: Product Core Details Edit Form
- Phase 4: Photo Upload & Cover Management
- Phase 5: Integration Verification & Testing

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
