# Pantry Limits & Future Subscription Tier Architecture

## 1. Executive Summary

Expyrico implements platform-configurable active pantry item limits per user (admin-controlled via `/settings/pantry-limits`, default 50 items, valid range 1–10,000). The architecture balances platform storage economics, prevents abusive hoarding, guarantees soft-ceiling inventory preservation, and provides a forward-compatible bridge for upcoming paid subscription tiers (`free` vs. `pro` vs. `supporter`).

---

## 2. Core Architectural Principles

### 2.1 Creator-Owned Quota Model
Active quota is calculated by counting records where `userId = user.id AND status = 'active'`.
- Applies across **both** personal records and records the user creates within shared households.
- Other household members who join or share items do **not** have their quotas consumed by items created by their peers.

### 2.2 Soft-Ceiling Invariant
When an administrator decreases the default pantry limit (e.g. from 100 to 50 items) or when an account reaches capacity:
- **No data loss**: Existing records are never deleted, hidden, or made read-only.
- **Full accessibility**: Users can freely view, edit metadata, consume, discard, or delete existing inventory.
- **Positive transition block**: Adding new active items, reactivating consumed items, or duplicating items is blocked with informative 409 responses until active inventory drops below capacity.

### 2.3 Strict Canonical Lock Ordering
To prevent deadlocks under PostgreSQL's `READ COMMITTED` isolation level across concurrent operations (`POST /records`, `POST /records/:id/duplicate`, `PATCH /records/:id`, `POST /giveaways/:id/cancel`, and offline `POST /records/sync`), locks MUST always be acquired in this exact sequence:
1. **Giveaway row lock** (`SELECT ... FROM giveaways WHERE id = ... FOR UPDATE`) [giveaway cancellation only]
2. **User Quota advisory lock** (`SELECT pg_advisory_xact_lock(hashtext(userId)::bigint)`)
3. **Household row lock** (`SELECT pg_advisory_xact_lock(...)`) [sorted in multi-household moves]
4. **Record row lock** (`SELECT ... FROM records WHERE id = ... FOR UPDATE`)

---

## 3. Future Subscription Tier Integration Bridge

### 3.1 Shared Schema Contracts
The `@expyrico/shared` package defines:
```typescript
export const USER_PANTRY_TIERS = ['free', 'pro', 'supporter'] as const;
export type UserPantryTier = (typeof USER_PANTRY_TIERS)[number];

export const pantryLimitsSettingsSchema = z.object({
  defaultUserPantryLimit: z.number().int().min(1).max(10000).default(50),
  tierLimits: z.record(z.string(), z.number().int().min(1).max(10000)).default({
    free: 50,
    pro: 500,
  }),
});
```

### 3.2 Service Resolution Hook (`api/src/services/records/pantry-limits.ts`)
The `getUserPantryLimit(userId)` resolver currently resolves the global setting:
```typescript
export async function getUserPantryLimit(
  userId: string,
  tx?: Prisma.TransactionClient | PrismaClient,
): Promise<{ limit: number; source: 'default_setting' | 'subscription_tier' }> {
  const settings = await getPantryLimits();
  return {
    limit: settings.defaultUserPantryLimit,
    source: 'default_setting',
  };
}
```

### 3.3 Zero Breaking Changes Roadmap for Billing Launch
When subscription billing launches (via Stripe, Polar, or Better Auth subscriptions):
1. **Database update**: Add an optional `tier UserPantryTier @default(free)` column to the `User` table or a `Subscription` relation.
2. **Resolver update**: In `getUserPantryLimit(userId, tx)`:
   ```typescript
   const client = tx ?? getPrisma();
   const user = await client.user.findUnique({ where: { id: userId }, select: { tier: true } });
   const userTier = user?.tier ?? 'free';
   const settings = await getPantryLimits();
   const tierLimit = settings.tierLimits?.[userTier] ?? settings.defaultUserPantryLimit;
   return { limit: tierLimit, source: 'subscription_tier' };
   ```
3. **No client or database breakage**:
   - `POST /v1/records`, `PATCH /v1/records/:id`, `duplicate`, `giveaways`, and `sync` call `assertCanAddPantryItems`, which automatically reflects the upgraded tier limit.
   - `GET /v1/me/usage` immediately returns the higher limit.
   - Mobile and web clients do not require API contract changes or offline schema migrations.

---

## 4. Deterministic Large-Inventory Delta Sync

Delta synchronization (`POST /v1/records/sync`) supports inventories up to 10,000 items without timestamp-boundary truncation:
- **Composite Cursor**: Pagination orders by `[{ updatedAt: 'asc' }, { id: 'asc' }]`.
- **Seek Predicate**:
  `(updatedAt > cursor.updatedAt) OR (updatedAt = cursor.updatedAt AND id > cursor.id)`.
- **AND-Composition**: Seek predicates and membership-visibility filters are composed using Prisma `AND: [seekCondition, visibilityCondition]` to avoid top-level `OR` key collisions.
- **Client Drainage**: The mobile client drains all pages via an in-memory `while (hasMore)` loop, advancing checkpoint `saveLastSync(initialServerTime)` only when `hasMore === false`.
