---
phase: 5
title: "Future Tier Extensibility & End-to-End Verification"
status: pending
priority: P2
effort: "4h"
dependencies: [1, 2, 3, 4]
---

# Phase 5: Future Tier Extensibility & End-to-End Verification

## Overview
Document the architectural roadmap for upcoming paid vs. free subscription tiers, verify the extensibility contract in code without introducing premature or speculative database abstractions (KISS/YAGNI), test deterministic delta sync pagination across equal-timestamp page boundaries up to the 10,000-item ceiling, and execute end-to-end verification across the API, admin dashboard, and mobile client to guarantee zero breaking changes when billing launches.

<!-- Updated: Advisory Review Session 1 - Findings F01, F12, F16 -->

---

## Requirements

### Functional
1. **Tier Entitlement Contract (`@expyrico/shared`)**:
   - Export standard user tier types and constants:
     ```typescript
     export const USER_PANTRY_TIERS = ['free', 'pro', 'supporter'] as const;
     export type UserPantryTier = (typeof USER_PANTRY_TIERS)[number];
     ```
   - Ensure `tierLimits` in `pantryLimitsSettingsSchema` maps directly to these tiers (`{ free: 50, pro: 500, supporter: 1000 }`).
2. **Resolver Extensibility Hook (`api/src/services/records/pantry-limits.ts`)**:
   - Structure `getUserPantryLimit`:
     - Clean, focused implementation returning `{ limit: settings.defaultUserPantryLimit, source: 'default_setting' }`.
     - Document the exact integration point where a future `Subscription` or `User.tier` relation will resolve `settings.tierLimits[user.tier]`.
     - Do not add speculative user queries or fake database mutations in the present code (Red Team Finding 3).
3. **Deterministic Large Inventory Equal-Timestamp Boundary Test (HTTP Route Level)**:
   - Integration test in `delta-sync-pagination.test.ts` exercising the actual Fastify route `POST /v1/records/sync` (not merely raw database query):
     - Seed database with 1,005 records sharing the exact same `updatedAt` timestamp across the 1,000-row page threshold.
     - Verify HTTP response Page 1 delivers 1,000 records with `hasMore = true` and `nextCursor: { updatedAt, id: id_1000 }`.
     - Verify HTTP response Page 2 delivers the remaining 5 records with `hasMore = false` and `nextCursor = null`.
     - Verify mobile drainage loop retrieves all 1,005 records with zero dropped or duplicated records (Advisory Findings F01, F12).
   - Full test execution across all workspaces:
     - `@expyrico/shared`: `pnpm --filter @expyrico/shared test`
     - `apps/api`: `pnpm --filter @expyrico/api test:unit` & integration tests
     - `apps/admin`: `pnpm --filter @expyrico/admin test`
     - `apps/mobile`: `pnpm --filter @expyrico/mobile test`
   - Typecheck across workspaces:
     - `pnpm --filter @expyrico/shared typecheck`
     - `pnpm --filter @expyrico/admin typecheck`
     - `pnpm --filter @expyrico/mobile typecheck`
   - Android Build:
     - Local Gradle build verification (`assembleDebug`).

### Non-Functional
- **Zero Breaking Changes Guarantee**: Future subscription implementations (Stripe, Polar, Better Auth subscriptions) plug directly into `getUserPantryLimit` without altering record tables, sync protocols, or error schemas.

---

## Architecture: Future Subscription Integration Bridge

```
                     ┌────────────────────────────────┐
                     │   Payment Provider (Future)    │
                     │         Stripe / Polar         │
                     └───────────────┬────────────────┘
                                     │ Webhook
                                     ▼
                     ┌────────────────────────────────┐
                     │    User / Subscription Table   │
                     │    tier: 'free' | 'pro' | ...  │
                     └───────────────┬────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ getUserPantryLimit(userId) Service Function (Phase 2 & 5)                   │
│                                                                             │
│  1. Check user's active tier (default: 'free')                              │
│  2. Read Setting 'pantry_limits'                                            │
│  3. Return settings.tierLimits[user.tier] ?? settings.defaultUserPantryLimit│
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ├─► Used by POST /v1/records
                                     ├─► Used by POST /v1/records/duplicate
                                     ├─► Used by PATCH /v1/records/:id
                                     ├─► Used by POST /v1/giveaways/:id/cancel
                                     ├─► Used by POST /v1/records/sync
                                     └─► Used by GET /v1/me/usage
```

---

## Related Code Files

- Modify: `api/src/services/records/pantry-limits.ts` (extensibility hook documentation)
- Create: `api/tests/integration/delta-sync-pagination.test.ts`
- Documentation: `docs/architecture/pantry-limits-and-future-tiers.md`

---

## Implementation Steps

1. **Document Future Tier Architecture**:
   - Write `docs/architecture/pantry-limits-and-future-tiers.md` explaining how user tiers will hook into `getUserPantryLimit`.
2. **Implement Delta Sync Equal-Timestamp Pagination Test in `delta-sync-pagination.test.ts`**:
   - Seed database with 1,005 records having identical `updatedAt` timestamps and distinct UUIDs.
   - Execute request against the Fastify HTTP route `POST /v1/records/sync`:
     - Page 1 returns 1,000 rows with `hasMore: true` and `nextCursor: { updatedAt, id: id_1000 }`.
     - Page 2 returns the remaining 5 rows with `hasMore: false` and `nextCursor: null`.
     - Assert exactly 1,005 unique rows received without duplication or omission, proving end-to-end HTTP and mobile drainage convergence (Advisory Findings F01, F12).
3. **Execute Full-Stack Test Suite**:
   - Run shared, API, admin, and mobile tests.
4. **Compile Android Debug APK**:
   - Verify local Gradle build succeeds.

---

## Success Criteria

- [ ] Architectural documentation for future tier growth is committed.
- [ ] Equal-timestamp page-boundary delta sync test passes against the Fastify HTTP endpoint with 0 dropped rows.
- [ ] Android debug APK builds successfully with 0 errors.
