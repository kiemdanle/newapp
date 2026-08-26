---
phase: 6
title: "Testing & Verification"
status: completed
priority: P1
dependencies: ["phase-01-shared-schemas-contracts", "phase-02-backend-api-search-filters", "phase-03-mobile-api-client-hooks", "phase-04-mobile-dealfeed-search-filters", "phase-05-mobile-deal-creation-detail-flows"]
---

# Phase 6: Testing & Verification

## Overview
Perform end-to-end testing, integration testing, component regression verification, Maestro UI flow verification, and build validation across all packages (`@expyrico/shared`, `api`, `apps/mobile`, `apps/admin`).

## Requirements

### Functional Requirements
- **Backend Test Suite**:
  - Run all Vitest integration and unit tests in `api/`:
    - `api/tests/integration/deals-feed.test.ts` (Search, Filters, Sorts, Scopes)
    - `api/tests/integration/deals-crud.test.ts` (Create, Read, Update, Delete)
    - `api/tests/integration/deals-vote.test.ts` (Upvote, Downvote, Wilson Score)
    - `api/tests/integration/deals-stores.test.ts` (Store Facets)
- **Shared Schema Test Suite**:
  - Run Vitest tests in `packages/shared/`:
    - `packages/shared/src/schemas/deal.test.ts`
- **Mobile Component Test Suite**:
  - Run Jest component tests in `apps/mobile/`:
    - `apps/mobile/__tests__/DealCard.test.tsx`
    - `apps/mobile/__tests__/DealFeed.test.tsx`
    - `apps/mobile/__tests__/DealFilterModal.test.tsx`
    - `apps/mobile/__tests__/DealForm.test.tsx`
    - `apps/mobile/__tests__/DealDetailScreen.test.tsx`
    - `apps/mobile/__tests__/NewDealScreen.test.tsx`
- **Maestro E2E Flow Update**:
  - Update `.maestro/deals-flow.yaml` to cover:
    1. Opening Deals tab.
    2. Searching for a product keyword.
    3. Opening Filter modal, selecting store, applying filter.
    4. Toggling sort order.
    5. Tapping "+ Post Deal" button.
    6. Selecting a product and filling out deal details.
    7. Submitting and verifying deal card appears in the feed.
    8. Upvoting and opening detail view.
- **TypeScript Typecheck & Lint**:
  - `pnpm --filter @expyrico/shared typecheck`
  - `pnpm --filter @expyrico/api typecheck`
  - `pnpm --filter @expyrico/mobile typecheck`

### Non-Functional Requirements
- Zero TypeScript diagnostics errors.
- 100% test pass rate across all suites.
- Strict Expyrico design guidelines verification.

## Architecture
```
Test & Verification Suite
  ├── Shared Package: Vitest unit tests for schemas
  ├── Backend API: Vitest integration tests for API routes & Prisma repository
  ├── Mobile App: Jest + React Native Testing Library for UI components
  └── E2E: Maestro flow for Deals tab interactions
```

## Related Code Files
- Modify: `apps/mobile/.maestro/deals-flow.yaml`
- Verify: `packages/shared/src/schemas/deal.test.ts`
- Verify: `api/tests/integration/deals-feed.test.ts`
- Verify: `api/tests/integration/deals-crud.test.ts`
- Verify: `apps/mobile/__tests__/DealCard.test.tsx`
- Verify: `apps/mobile/__tests__/DealFeed.test.tsx`
- Verify: `apps/mobile/__tests__/DealForm.test.tsx`

## Implementation Steps
1. **Execute Shared Schema Tests:**
   - `pnpm --filter @expyrico/shared test`
2. **Execute API Integration Tests:**
   - `pnpm --filter @expyrico/api test api/tests/integration/deals*`
3. **Execute Mobile Component Tests:**
   - `pnpm --filter @expyrico/mobile test apps/mobile/__tests__/Deal*`
4. **Update Maestro E2E Test (`apps/mobile/.maestro/deals-flow.yaml`):**
   - Script full user journey from empty/loaded feed to search, filter, post deal, and detail view.
5. **Full Repository Typecheck:**
   - Run typecheck on shared, api, and mobile packages.

## Success Criteria
- [ ] All Vitest tests in `packages/shared` and `api` pass without errors.
- [ ] All Jest tests in `apps/mobile` pass with 100% coverage on new/updated components.
- [ ] Maestro flow `.maestro/deals-flow.yaml` passes end-to-end on Android device.
- [ ] Zero TypeScript errors across the repository.

## Risk Assessment
- **Risk:** Stale mock data in Jest tests failing on expanded `Deal` interface.
- **Mitigation:** Update mock factories to supply default values for new fields.
