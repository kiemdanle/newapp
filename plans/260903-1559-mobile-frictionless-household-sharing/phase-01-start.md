---
phase: 1
title: "Backend 6-Character Invite Code and Join Route"
status: completed
priority: P1
effort: "3-4h"
dependencies: []
---

# Phase 1: Backend 6-Character Invite Code and Join Route

## Overview
Generate unique 6-character human-readable invite codes for households and introduce a fast `POST /v1/households/join` endpoint, replacing the raw UUID member-addition requirement.

## Requirements
- Functional:
  - Generate a 6-character uppercase alphanumeric invite code for each household using visually unambiguous characters (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`).
  - Add `inviteCode` column to `Household` model in `api/prisma/schema.prisma` (`String? @unique @map("invite_code")`).
  - Ensure `createHouseholdRoute` generates and assigns a unique `inviteCode` upon creation.
  - Lazily backfill or generate an invite code if an older household lacks one.
  - Implement `POST /v1/households/join`:
    - Accepts `{ code: string }`.
    - Sanitizes input (`trim().toUpperCase()`).
    - Validates caller authentication.
    - Locks row with pg advisory lock during member addition to avoid race conditions.
    - Adds caller as `member` in `HouseholdMember`.
    - Calls `scheduleNewMemberReminders(userId, householdId)`.
    - Returns joined `Household` object with `memberCount` and `myRole: 'member'`.
    - Support code regeneration via `POST /v1/households/:id/regenerate-invite-code` (owner only) to cycle code when needed.
  - Expose `inviteCode` in `toApiHousehold` response repository.
  - Update `@expyrico/shared` schemas (`householdSchema` with `inviteCode`, `householdJoinSchema`).
- Non-functional:
  - Rate limiting on join endpoint (prevent brute force enumeration of 6-character codes).
  - High performance: indexed lookup on `invite_code`.

## Architecture
```
POST /v1/households/join
Body: { "code": "KITCH8" }
        │
        ▼
Lookup Household where inviteCode == "KITCH8"
        │
        ├── If missing: 404 HOUSEHOLD_NOT_FOUND ("Invalid or expired invite code")
        ├── If already in household: 409 CONFLICT ("You are already a member of this household")
        ├── Transaction:
        │     1. Advisory lock on household
        │     2. Create HouseholdMember { householdId, userId, role: 'member' }
        │     3. Trigger scheduleNewMemberReminders
        ▼
Return 200 OK with Household payload (ready for client cache hydration)
```

## Related Code Files
- Modify: `api/prisma/schema.prisma`
- Create: `api/src/services/households/invite-code.ts`
- Modify: `api/src/services/households/repository.ts`
- Modify: `api/src/routes/households/create.ts`
- Create: `api/src/routes/households/join.ts`
- Modify: `api/src/routes/households/index.ts`
- Modify: `packages/shared/src/schemas/household.ts`
- Create: `api/tests/routes/households-join.test.ts`

## Implementation Steps
1. Add `inviteCode String? @unique @map("invite_code")` to `Household` in `api/prisma/schema.prisma` and run `prisma generate`.
2. Update `packages/shared/src/schemas/household.ts` to include `inviteCode: z.string().optional()` in `householdSchema`, and add `householdJoinSchema = z.object({ code: z.string().trim().toUpperCase().min(4).max(12) })`.
3. Create `api/src/services/households/invite-code.ts` implementing `generateUniqueHouseholdInviteCode()`.
4. Update `toApiHousehold` in `api/src/services/households/repository.ts` to include `inviteCode`.
5. Update `createHouseholdRoute` to populate `inviteCode` on creation.
6. Implement `POST /v1/households/join` in `api/src/routes/households/join.ts` with rate-limiting and conflict protection.
7. Register route in `api/src/routes/households/index.ts`.
8. Implement `POST /v1/households/:id/regenerate-invite-code` (owner only) to generate and save a fresh unique invite code.
9. Write comprehensive backend unit and integration tests in `api/tests/routes/households-join.test.ts`.

<!-- Updated: Validation Session 1 - Permanent code with owner regenerate endpoint -->

## Success Criteria
- [x] New households receive a unique 6-character invite code upon creation.
- [x] `POST /v1/households/join` successfully joins a user with a valid code.
- [x] Invalid codes return 404 with helpful error messages.
- [x] Duplicate join attempts return 409 conflict cleanly.
- [x] 100% test pass rate for all household join scenarios.

## Risk Assessment
- **Risk**: 6-character codes might collide or be vulnerable to brute-force enumeration.
- **Mitigation**: Using a 32-character alphabet gives $32^6 \approx 1.07 \times 10^9$ combinations. Pair this with Fastify rate limiting (e.g. 10 attempts / min per IP/user) to make brute force impossible.
- **Observable Signal**: Rapid 404 responses on `/households/join`.
- **Pre-decided Response**: Apply strict rate limiter to the join endpoint.
